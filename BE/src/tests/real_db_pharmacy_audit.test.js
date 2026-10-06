/**
 * NeuroScan AI - Real Database Integration Test Suite
 * Validates Phase 3 Pharmacy Workflows against LIVE MongoDB Replica Set:
 * 1. Webhook Concurrency Race Test (Promise.all)
 * 2. Post-Payment Stock Shortage Transaction Rollback & Outside-Session Persistence
 * 3. Recovery Path ("Lối thoát") for Stuck Processing Invoices
 * 4. Expired Drug Dispense Blocker
 * 5. Role Authorization & Anti-Self-Verify Choke-point
 * 6. ACUTE_EMERGENCY Scope (Payment Guard Enforced, 24h Post-Hoc SLA)
 * 7. PARTIALLY_DISPENSED Workflow
 */

import mongoose from "mongoose";
import assert from "assert";
import dotenv from "dotenv";
import { Hospital } from "../models/hospital.model.js";
import { User } from "../models/user.model.js";
import { Drug } from "../modules/pharmacy/models/drug.model.js";
import { Prescription } from "../modules/pharmacy/models/prescription.model.js";
import { Invoice } from "../modules/billing/models/invoice.model.js";
import payos from "../utils/payos.js";
import { 
  handlePayOSWebhook, 
  resolveProcessingInvoice,
  getStuckProcessingInvoices,
  refundInvoice
} from "../modules/billing/invoice.controller.js";
import {
  verifyPrescription,
  dispensePrescription,
  postHocReviewPrescription,
  getDoctorOverrideStats
} from "../modules/pharmacy/drug.controller.js";
import { addPatientPrescription } from "../controllers/patient.controller.js";
import { reconcilePayOSInventory } from "../scripts/reconcile_payos_inventory.js";
import { tenantStorage } from "../middlewares/tenant.middleware.js";

dotenv.config();

const TEST_MONGO_URI = process.env.TEST_MONGO_URI || process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/neuro_test";

function maskMongoUri(uri) {
  if (!uri) return "";
  return uri.replace(/\/\/[^:]+:[^@]+@/, "//***:***@");
}

console.log("\n======================================================================");
console.log("   NEUROSCAN AI: LIVE MONGODB PHARMACY WORKFLOW & ACID AUDIT SUITE    ");
console.log("======================================================================\n");

function createMockReqRes({ body = {}, params = {}, query = {}, user = null } = {}) {
  const req = { body, params, query, user };
  let statusCode = 200;
  let responseData = null;
  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      responseData = data;
      return res;
    },
    send(data) {
      responseData = data;
      return res;
    }
  };
  return {
    req,
    res,
    getStatus: () => statusCode,
    getData: () => responseData
  };
}

let passed = 0;
let failed = 0;

const runTest = async (title, fn) => {
  try {
    await fn();
    console.log(`  ✔ [PASS] ${title}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${title}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
};

async function main() {
  await mongoose.connect(TEST_MONGO_URI);
  console.log(`Connected to MongoDB at ${maskMongoUri(TEST_MONGO_URI)}\n`);

  // Chốt chặn an toàn: BẮT BUỘC DB kiểm thử phải kết thúc bằng '_test' hoặc là DB 'test'
  const dbName = mongoose.connection.name;
  if ((!dbName.endsWith("_test") && dbName !== "test") || process.env.NODE_ENV === "production") {
    throw new Error(`[BẢO MẬT TEST CHỐT CHẶN] Từ chối chạy test trên DB '${dbName}'. Test chỉ được phép chạy trên cơ sở dữ liệu kiểm thử có tên kết thúc bằng '_test' (ví dụ: 'neuro_test', 'mri_test') và không được chạy ở production.`);
  }
  console.log(`[BẢO MẬT TEST CHỐT CHẶN] Đã xác thực cơ sở dữ liệu kiểm thử an toàn biệt lập: '${dbName}'\n`);

  // Setup Test Tenant
  const testHospital = await Hospital.create({
    name: "BV Đại Học Y Dược - Audit DB",
    code: `HOSP_AUDIT_${Date.now()}`,
    isActive: true
  });

  const doctorUser = await User.create({
    email: `dr.test.${Date.now()}@hospital.vn`,
    passwordHash: "dummy_hash",
    role: "doctor",
    hospitalId: testHospital._id,
    departmentId: "KUTN-ICU",
    emergencyDuty: {
      isAssigned: true,
      assignedAt: new Date(),
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      shiftType: "day_shift"
    },
    profile: { name: "BS. Nguyễn Văn A (ICU)", department: "Khoa Hồi Sức Cấp Cứu" }
  });

  const outpatientDoctorUser = await User.create({
    email: `dr.outpatient.${Date.now()}@hospital.vn`,
    passwordHash: "dummy_hash",
    role: "doctor",
    hospitalId: testHospital._id,
    departmentId: "KUTN-CLI",
    emergencyDuty: {
      isAssigned: false,
      expiresAt: null
    },
    profile: { name: "BS. Lê Ngoại Trú", department: "Phòng khám Ngoại trú" }
  });

  const adminUser = await User.create({
    email: `admin.test.${Date.now()}@hospital.vn`,
    passwordHash: "dummy_hash",
    role: "hospital_admin",
    hospitalId: testHospital._id,
    profile: { name: "Ban Giám Đốc Bệnh Viện" }
  });

  const pharmacistUser = await User.create({
    email: `pharm.test.${Date.now()}@hospital.vn`,
    passwordHash: "dummy_hash",
    role: "pharmacist",
    hospitalId: testHospital._id,
    profile: { name: "DS. Trần Thị B (Quầy phát)" }
  });

  const pharmacist2User = await User.create({
    email: `pharm2.test.${Date.now()}@hospital.vn`,
    passwordHash: "dummy_hash",
    role: "pharmacist",
    hospitalId: testHospital._id,
    profile: { name: "DS. Hoàng Thị Mai (Lâm sàng độc lập)" }
  });

  const patientUser = await User.create({
    email: `pt.test.${Date.now()}@hospital.vn`,
    passwordHash: "dummy_hash",
    role: "patient",
    hospitalId: testHospital._id,
    profile: { name: "BN. Lê Văn C", medicalId: `MED_${Date.now()}` }
  });

  // Mock PayOS webhook verification so we can trigger webhooks in test without remote payos server
  const originalVerify = payos.webhooks.verify;
  payos.webhooks.verify = (data) => {
    return {
      code: "00",
      orderCode: data.data?.orderCode || data.orderCode,
      amount: data.data?.amount || data.amount,
      desc: "Thanh toán thành công"
    };
  };

  try {
    // ── TEST 1: Webhook Concurrency Race Test (Promise.all) ──────────
    await runTest("1. Webhook Concurrency (Promise.all): Hai request song song cùng orderCode chỉ trừ kho 1 lần", async () => {
      const testDrug = await Drug.create({
        hospitalId: testHospital._id,
        name: `Temozolomide Test Race ${Date.now()}`,
        activeIngredient: "Temozolomide",
        strength: "100mg",
        dosageForm: "Capsule",
        stock: { quantity: 20, unit: "Viên", minStock: 5 },
        price: 150000
      });

      const orderCode = Math.floor(100000000 + Math.random() * 900000000);
      const invoice = await Invoice.create({
        hospitalId: testHospital._id,
        patientId: patientUser._id,
        orderCode: orderCode,
        status: "chờ thanh toán",
        totalAmount: 750000,
        items: [
          {
            description: testDrug.name,
            drugId: testDrug._id,
            drugName: testDrug.name,
            quantity: 5,
            unitPrice: 150000,
            amount: 750000,
            type: "drug"
          }
        ]
      });

      const webhookPayload = {
        code: "00",
        orderCode: orderCode,
        data: { orderCode: orderCode, amount: 750000 }
      };

      const m1 = createMockReqRes({ body: webhookPayload });
      const m2 = createMockReqRes({ body: webhookPayload });

      // Gửi đồng thời hai request đến cùng một webhook
      await Promise.all([
        handlePayOSWebhook(m1.req, m1.res),
        handlePayOSWebhook(m2.req, m2.res)
      ]);

      // Kiểm tra trong CSDL thật
      const updatedDrug = await Drug.findById(testDrug._id);
      const updatedInvoice = await Invoice.findById(invoice._id);

      assert.strictEqual(updatedInvoice.status, "đã thanh toán", "Hóa đơn phải chuyển sang 'đã thanh toán'");
      assert.strictEqual(updatedInvoice.stockDeductionStatus, "DEDUCTED", "Cờ trừ kho phải là 'DEDUCTED'");
      // Tồn ban đầu: 20. Trừ 5 -> phải còn chính xác 15. Nếu bị race condition trừ đúp sẽ còn 10!
      assert.strictEqual(updatedDrug.stock.quantity, 15, `Tồn kho phải là 15, không được trừ lặp (Hiện tại: ${updatedDrug.stock.quantity})`);
      assert.strictEqual(updatedDrug.stockMovements.length, 1, "Chỉ được tạo duy nhất 1 bản ghi stockMovement");
      assert.strictEqual(updatedDrug.stockMovements[0].balanceAfter, 15, "balanceAfter trong movement phải ghi nhận 15");
    });

    // ── TEST 2: Stock Shortage Rollback & Outside-Session Persistence ──────────
    await runTest("2. Stock Shortage Rollback: Giao dịch rollback khi thiếu kho, cờ SHORTAGE_FLAGGED lưu độc lập ngoài transaction", async () => {
      const testDrugShortage = await Drug.create({
        hospitalId: testHospital._id,
        name: `Cisplatin Test Shortage ${Date.now()}`,
        activeIngredient: "Cisplatin",
        strength: "50mg",
        stock: { quantity: 3, unit: "Lọ", minStock: 2 },
        price: 250000
      });

      const orderCodeShortage = Math.floor(100000000 + Math.random() * 900000000);
      const invoice = await Invoice.create({
        hospitalId: testHospital._id,
        patientId: patientUser._id,
        orderCode: orderCodeShortage,
        status: "chờ thanh toán",
        totalAmount: 2500000,
        items: [
          {
            description: testDrugShortage.name,
            drugId: testDrugShortage._id,
            drugName: testDrugShortage.name,
            quantity: 10, // Cần 10 nhưng kho chỉ có 3 -> thiếu kho
            unitPrice: 250000,
            amount: 2500000,
            type: "drug"
          }
        ]
      });

      const webhookPayload = {
        code: "00",
        orderCode: orderCodeShortage,
        data: { orderCode: orderCodeShortage, amount: 2500000 }
      };

      const m = createMockReqRes({ body: webhookPayload });
      await handlePayOSWebhook(m.req, m.res);

      const dbInvoice = await Invoice.findById(invoice._id);
      const dbDrug = await Drug.findById(testDrugShortage._id);

      // Điểm mấu chốt: Status phải là "đang xử lý", KHÔNG bị quay về "chờ thanh toán" vì cập nhật ngoài transaction
      assert.strictEqual(dbInvoice.status, "đang xử lý", "Hóa đơn phải giữ trạng thái 'đang xử lý' để đối soát");
      assert.strictEqual(dbInvoice.stockDeductionStatus, "SHORTAGE_FLAGGED", "Phải gắn cờ 'SHORTAGE_FLAGGED'");
      assert.ok(dbInvoice.paymentNotes.includes("thiếu tồn kho"), "Ghi chú thanh toán phải chứa thông báo thiếu kho");
      // Tồn kho không được suy giảm
      assert.strictEqual(dbDrug.stock.quantity, 3, "Tồn kho phải được bảo toàn nguyên vẹn 3 lọ");
    });

    // ── TEST 3: Recovery Path ("Lối thoát") for Stuck Invoices ──────────
    await runTest("3. Recovery Path: Dược sĩ bổ sung kho và gọi retry_deduct chuyển hóa đơn sang 'đã thanh toán'", async () => {
      // Tìm lại hóa đơn thiếu kho ở Test 2
      const stuckInvoice = await Invoice.findOne({ hospitalId: testHospital._id, status: "đang xử lý", stockDeductionStatus: "SHORTAGE_FLAGGED" });
      assert.ok(stuckInvoice, "Phải tìm thấy hóa đơn kẹt ở Test 2");

      // Bổ sung tồn kho thuốc cho đủ số lượng (từ 3 lên 50)
      const drugItem = stuckInvoice.items[0];
      await Drug.findByIdAndUpdate(drugItem.drugId, { $set: { "stock.quantity": 50 } });

      const mResolve = createMockReqRes({
        params: { id: stuckInvoice._id.toString() },
        body: { action: "retry_deduct", note: "Đã nhập thêm 50 lọ thuốc, trừ kho bù thành công" },
        user: pharmacistUser
      });

      await resolveProcessingInvoice(mResolve.req, mResolve.res);

      assert.strictEqual(mResolve.getStatus(), 200, "Xử lý thành công phải trả mã 200");

      const resolvedInvoice = await Invoice.findById(stuckInvoice._id);
      const resolvedDrug = await Drug.findById(drugItem.drugId);

      assert.strictEqual(resolvedInvoice.status, "đã thanh toán", "Hóa đơn phải được gỡ kẹt sang 'đã thanh toán'");
      assert.strictEqual(resolvedInvoice.stockDeductionStatus, "DEDUCTED", "Cờ trừ kho phải chuyển sang 'DEDUCTED'");
      // Tồn kho 50 trừ 10 -> còn 40
      assert.strictEqual(resolvedDrug.stock.quantity, 40, `Tồn kho sau khi trừ bù phải là 40 (Hiện tại: ${resolvedDrug.stock.quantity})`);
    });

    // ── TEST 4: Expired Drug Dispense Blocker ──────────
    await runTest("4. Expired Drug Blocker: Chặn tuyệt đối quầy Dược phát thuốc hết hạn sử dụng", async () => {
      const expiredDrug = await Drug.create({
        hospitalId: testHospital._id,
        name: `Methotrexate Test Expired ${Date.now()}`,
        activeIngredient: "Methotrexate",
        expiryDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Hết hạn từ hôm qua
        stock: { quantity: 100, unit: "Lọ", minStock: 10 },
        price: 80000
      });

      const prescription = await Prescription.create({
        hospitalId: testHospital._id,
        patient_id: patientUser._id,
        patient_name: patientUser.profile.name,
        diagnosis: "U não ác tính",
        dispenseStatus: "PENDING_DISPENSE",
        drugs: [
          {
            name: expiredDrug.name,
            dosage: "2.5mg",
            frequency: "1 lần/tuần",
            duration: "4 tuần",
            quantity: 4
          }
        ]
      });

      const m = createMockReqRes({
        params: { id: prescription._id.toString() },
        body: { pharmacistId: pharmacistUser._id.toString(), pharmacistName: pharmacistUser.profile.name },
        user: pharmacistUser
      });

      await dispensePrescription(m.req, m.res);

      assert.strictEqual(m.getStatus(), 400, "Phát thuốc hết hạn phải bị từ chối với status 400");
      assert.ok(m.getData().message.includes("đã hết hạn sử dụng"), "Thông báo phải chỉ rõ thuốc đã hết hạn sử dụng");
    });

    // ── TEST 5: Role Authorization & Anti-Self-Verify ──────────
    await runTest("5. Anti-Self-Verify: Bác sĩ kê đơn không được phép tự thẩm định đơn thuốc của chính mình", async () => {
      const validDrug = await Drug.create({
        hospitalId: testHospital._id,
        name: `Valid Drug AntiSelf ${Date.now()}`,
        activeIngredient: "ValidActive",
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        stock: { quantity: 100, unit: "Viên", minStock: 10 },
        price: 50000
      });

      const prescription = await Prescription.create({
        hospitalId: testHospital._id,
        doctorId: doctorUser._id,
        doctor_name: doctorUser.profile.name,
        patient_id: patientUser._id,
        patient_name: patientUser.profile.name,
        diagnosis: "Glioblastoma",
        dispenseStatus: "AWAITING_PHARMACY_VERIFICATION",
        clinicalSafety: {
          requiresDualSign: true,
          dualSignStatus: "PENDING_PHARMACY_VERIFICATION",
          warnings: [{ level: "CRITICAL", message: "Suy tủy nặng cần thẩm định kép" }]
        },
        drugs: [{ name: validDrug.name, quantity: 10 }]
      });

      // Bác sĩ kê đơn tự thẩm định -> phải bị 403
      const mDoctorSelf = createMockReqRes({
        params: { id: prescription._id.toString() },
        body: { pharmacistId: doctorUser._id.toString(), pharmacistName: doctorUser.profile.name },
        user: doctorUser
      });
      await verifyPrescription(mDoctorSelf.req, mDoctorSelf.res);
      assert.strictEqual(mDoctorSelf.getStatus(), 403, "Bác sĩ tự duyệt đơn của mình phải trả về 403 Forbidden");

      // Dược sĩ độc lập thẩm định -> thành công 200
      const mPharmacist = createMockReqRes({
        params: { id: prescription._id.toString() },
        body: { pharmacistId: pharmacistUser._id.toString(), pharmacistName: pharmacistUser.profile.name, note: "Đã kiểm tra tương tác an toàn" },
        user: pharmacistUser
      });
      await verifyPrescription(mPharmacist.req, mPharmacist.res);
      assert.strictEqual(mPharmacist.getStatus(), 200, "Dược sĩ độc lập thẩm định phải thành công 200");

      const verifiedPrescription = await Prescription.findById(prescription._id);
      assert.strictEqual(verifiedPrescription.clinicalSafety.dualSignStatus, "VERIFIED");
      assert.strictEqual(verifiedPrescription.dispenseStatus, "READY");
    });

    // ── TEST 6: ACUTE_EMERGENCY & Separation of Duties ──────────
    await runTest("6. ACUTE_EMERGENCY & Separation of Duties: Ưu tiên phát thuốc cấp cứu trước viện phí (Luật KCB), SLA hậu kiểm 24h & Chặn Dược sĩ tự hậu kiểm", async () => {
      const emergencyDrug = await Drug.create({
        hospitalId: testHospital._id,
        name: `Emergency Mannitol ${Date.now()}`,
        activeIngredient: "Mannitol",
        expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        stock: { quantity: 100, unit: "Chai", minStock: 10 },
        price: 120000
      });

      // Tạo hóa đơn CHƯA THANH TOÁN
      const unpaidInvoice = await Invoice.create({
        hospitalId: testHospital._id,
        patientId: patientUser._id,
        status: "chờ thanh toán",
        totalAmount: 240000,
        items: [{ description: emergencyDrug.name, drugId: emergencyDrug._id, quantity: 2, amount: 240000, type: "drug" }]
      });

      const emergencyPrescription = await Prescription.create({
        hospitalId: testHospital._id,
        doctorId: doctorUser._id,
        patient_id: patientUser._id,
        invoiceId: unpaidInvoice._id,
        diagnosis: "Phù não cấp cứu",
        dispenseStatus: "AWAITING_PHARMACY_VERIFICATION",
        clinicalSafety: {
          requiresDualSign: true,
          dualSignStatus: "PENDING_PHARMACY_VERIFICATION",
          overrideCategory: "ACUTE_EMERGENCY",
          overrideReason: "Bệnh nhân phù não cấp đe dọa tính mạng cần dùng Mannitol ngay lập tức"
        },
        drugs: [{ name: emergencyDrug.name, quantity: 2 }]
      });

      // Theo Luật KCB 2023: Đơn cấp cứu được quầy dược phát thuốc ưu tiên cứu người trước, viện phí quyết toán sau
      const mEmergencyDispense = createMockReqRes({
        params: { id: emergencyPrescription._id.toString() },
        body: { pharmacistId: pharmacistUser._id.toString(), pharmacistName: pharmacistUser.profile.name },
        user: pharmacistUser
      });
      await dispensePrescription(mEmergencyDispense.req, mEmergencyDispense.res);
      assert.strictEqual(mEmergencyDispense.getStatus(), 200, "Đơn cấp cứu được ưu tiên phát thuốc trước cứu người theo Luật KCB");

      const dispensedPres = await Prescription.findById(emergencyPrescription._id);
      assert.strictEqual(dispensedPres.dispenseStatus, "DISPENSED");
      assert.strictEqual(dispensedPres.postHocReviewRequired, true, "Phải kích hoạt cờ hậu kiểm bắt buộc");
      assert.ok(dispensedPres.postHocDeadline, "Phải có thời hạn hậu kiểm SLA 24h");

      // 1. Phân nhiệm độc lập: Dược sĩ đã phát thuốc tự hậu kiểm -> PHẢI BỊ 403 (Separation of Duties)
      const mPostHocSelf = createMockReqRes({
        params: { id: emergencyPrescription._id.toString() },
        body: { note: "Dược sĩ phát thuốc tự hậu kiểm" },
        user: pharmacistUser
      });
      await postHocReviewPrescription(mPostHocSelf.req, mPostHocSelf.res);
      assert.strictEqual(mPostHocSelf.getStatus(), 403, "Dược sĩ đã phát thuốc cố tình tự hậu kiểm phải bị từ chối 403 Forbidden");

      // 2. Dược sĩ lâm sàng độc lập hậu kiểm -> Thành công 200
      const mPostHocIndependent = createMockReqRes({
        params: { id: emergencyPrescription._id.toString() },
        body: { note: "Đã hậu kiểm lâm sàng độc lập: Hồ sơ cấp cứu phù hợp phác đồ chống phù não cấp." },
        user: pharmacist2User
      });
      await postHocReviewPrescription(mPostHocIndependent.req, mPostHocIndependent.res);
      assert.strictEqual(mPostHocIndependent.getStatus(), 200, "Dược sĩ độc lập hậu kiểm thành công phải trả về 200");

      const reviewedPres = await Prescription.findById(emergencyPrescription._id);
      assert.strictEqual(reviewedPres.postHocReviewRequired, false, "Cờ hậu kiểm phải được giải phóng sau khi dược sĩ độc lập ký");
    });

    // ── TEST 7: PARTIALLY_DISPENSED Support ──────────
    await runTest("7. PARTIALLY_DISPENSED: Hỗ trợ quầy Dược phát thuốc từng phần khi thiếu một phần cơ số", async () => {
      const normalDrug = await Drug.create({
        hospitalId: testHospital._id,
        name: `Partial Drug Test ${Date.now()}`,
        activeIngredient: "Paracetamol",
        expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        stock: { quantity: 100, unit: "Viên", minStock: 10 },
        price: 2000
      });

      const settledInvoice = await Invoice.create({
        hospitalId: testHospital._id,
        patientId: patientUser._id,
        status: "đã thanh toán",
        totalAmount: 20000,
        items: [{ description: normalDrug.name, drugId: normalDrug._id, quantity: 10, amount: 20000, type: "drug" }]
      });

      const partialPrescription = await Prescription.create({
        hospitalId: testHospital._id,
        doctorId: doctorUser._id,
        patient_id: patientUser._id,
        invoiceId: settledInvoice._id,
        diagnosis: "Đau đầu căng thẳng",
        dispenseStatus: "PENDING_DISPENSE",
        drugs: [{ name: normalDrug.name, quantity: 10 }]
      });

      const mPartial = createMockReqRes({
        params: { id: partialPrescription._id.toString() },
        body: { 
          pharmacistId: pharmacistUser._id.toString(), 
          pharmacistName: pharmacistUser.profile.name,
          partiallyDispensed: true,
          note: "Chỉ phát trước 5 viên do tạm hết vỉ 10 viên"
        },
        user: pharmacistUser
      });

      await dispensePrescription(mPartial.req, mPartial.res);
      assert.strictEqual(mPartial.getStatus(), 200);

      const dbPres = await Prescription.findById(partialPrescription._id);
      assert.strictEqual(dbPres.dispenseStatus, "PARTIALLY_DISPENSED", "Trạng thái phải là PARTIALLY_DISPENSED");
    });

    // ── TEST 8: Reconcile Script Idempotency & Safeguard ──────────
    await runTest("8. Script Đối Soát: Chống âm kho khi thiếu thuốc và đảm bảo tính lặp lại (Idempotent)", async () => {
      const reconDrug = await Drug.create({
        hospitalId: testHospital._id,
        name: `Recon Drug Test ${Date.now()}`,
        activeIngredient: "ReconTest",
        stock: { quantity: 2, unit: "Hộp", minStock: 1 },
        price: 100000
      });

      const reconInvoice = await Invoice.create({
        hospitalId: testHospital._id,
        patientId: patientUser._id,
        orderCode: Math.floor(100000000 + Math.random() * 900000000),
        status: "đã thanh toán",
        paymentMethod: "vietqr",
        totalAmount: 500000,
        items: [{ description: reconDrug.name, drugId: reconDrug._id, quantity: 5, amount: 500000, type: "drug" }]
      });

      // Chạy --fix khi kho không đủ (cần 5 mà kho chỉ có 2)
      const resAudit = await reconcilePayOSInventory({ dryRun: false });
      
      const checkDrug = await Drug.findById(reconDrug._id);
      // Tồn kho không được bị âm!
      assert.strictEqual(checkDrug.stock.quantity, 2, "Kho thiếu thuốc không được trừ bù âm, phải giữ nguyên 2");

      // Bổ sung kho lên 10
      await Drug.findByIdAndUpdate(reconDrug._id, { $set: { "stock.quantity": 10 } });

      // Chạy bù lần 1
      await reconcilePayOSInventory({ dryRun: false });
      const checkDrugAfterFix = await Drug.findById(reconDrug._id);
      assert.strictEqual(checkDrugAfterFix.stock.quantity, 5, "Kho sau khi bù phải còn 5 (10 - 5)");

      // Chạy bù lần 2 (Kiểm tra Idempotency)
      await reconcilePayOSInventory({ dryRun: false });
      const checkDrugSecondRun = await Drug.findById(reconDrug._id);
      assert.strictEqual(checkDrugSecondRun.stock.quantity, 5, "Chạy lần 2 không được trừ đúp, kho vẫn phải là 5");
    });

    // ── TEST 9: Multi-Tenant Isolation (BOLA/IDOR Protection) ──────────
    await runTest("9. Tenant Isolation: Bệnh viện B không thể truy vấn hoặc can thiệp hóa đơn của Bệnh viện A", async () => {
      const hospitalB = await Hospital.create({
        name: "Bệnh viện Chợ Rẫy - Tenant B Audit",
        code: `HOSP_B_${Date.now()}`,
        isActive: true
      });

      const orderCodeHospitalA = Math.floor(100000000 + Math.random() * 900000000);
      const invoiceA = await Invoice.create({
        hospitalId: testHospital._id,
        patientId: patientUser._id,
        orderCode: orderCodeHospitalA,
        status: "chờ thanh toán",
        totalAmount: 150000,
        items: [{ description: "Khám bệnh", amount: 150000, type: "exam" }]
      });

      // Thực thi truy vấn trong ngữ cảnh Tenant B
      let queryResultHospitalB = null;
      await tenantStorage.run({ hospitalId: hospitalB._id.toString(), role: "hospital_admin" }, async () => {
        queryResultHospitalB = await Invoice.findOne({ orderCode: orderCodeHospitalA });
      });

      // Tenant B tuyệt đối không thể nhìn thấy hóa đơn của Tenant A
      assert.strictEqual(queryResultHospitalB, null, "Tenant B truy vấn orderCode của Tenant A phải trả về NULL");

      // Dọn dẹp hospitalB
      await Hospital.findByIdAndDelete(hospitalB._id);
    });

    // ── TEST 10: Anti-Ghost Inventory on Refund ──────────
    await runTest("10. Anti-Ghost Inventory: Hoàn tiền hóa đơn chưa từng trừ kho không được cộng tồn kho ma", async () => {
      const ghostTestDrug = await Drug.create({
        hospitalId: testHospital._id,
        name: `Anti Ghost Drug ${Date.now()}`,
        activeIngredient: "GhostCheck",
        stock: { quantity: 50, unit: "Viên", minStock: 5 },
        price: 30000
      });

      // Hóa đơn bị thiếu kho (SHORTAGE_FLAGGED), tức là kho CHƯA BỊ TRỪ
      const shortageInvoice = await Invoice.create({
        hospitalId: testHospital._id,
        patientId: patientUser._id,
        status: "đang xử lý",
        stockDeductionStatus: "SHORTAGE_FLAGGED",
        totalAmount: 150000,
        items: [{ description: ghostTestDrug.name, drugId: ghostTestDrug._id, quantity: 5, amount: 150000, type: "drug" }]
      });

      // Gọi refundInvoice
      const mRefund = createMockReqRes({
        params: { id: shortageInvoice._id.toString() },
        body: { refundReason: "Khách hàng hủy đơn do thiếu kho" },
        user: pharmacistUser
      });
      await refundInvoice(mRefund.req, mRefund.res);

      const checkDrugAfterRefund = await Drug.findById(ghostTestDrug._id);
      // Tồn kho phải giữ nguyên 50, TUYỆT ĐỐI KHÔNG được nhảy lên 55!
      assert.strictEqual(checkDrugAfterRefund.stock.quantity, 50, `Tồn kho phải giữ nguyên 50 (Hiện tại: ${checkDrugAfterRefund.stock.quantity})`);
    });

    // ── TEST 11: No Double Deduction on Dispense ──────────
    await runTest("11. No Double Deduction: Quầy Dược phát thuốc (dispense) KHÔNG được trừ kho lần 2", async () => {
      const noDoubleDrug = await Drug.create({
        hospitalId: testHospital._id,
        name: `No Double Deduct Drug ${Date.now()}`,
        activeIngredient: "NoDouble",
        expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        stock: { quantity: 90, unit: "Viên", minStock: 10 }, // Đã trừ 10 lúc thanh toán (100 -> 90)
        price: 5000
      });

      const settledInvoice = await Invoice.create({
        hospitalId: testHospital._id,
        patientId: patientUser._id,
        status: "đã thanh toán",
        stockDeductionStatus: "DEDUCTED",
        totalAmount: 50000,
        items: [{ description: noDoubleDrug.name, drugId: noDoubleDrug._id, quantity: 10, amount: 50000, type: "drug" }]
      });

      const presToDispense = await Prescription.create({
        hospitalId: testHospital._id,
        doctorId: doctorUser._id,
        patient_id: patientUser._id,
        invoiceId: settledInvoice._id,
        diagnosis: "Sốt xuất huyết",
        dispenseStatus: "PENDING_DISPENSE",
        drugs: [{ name: noDoubleDrug.name, quantity: 10 }]
      });

      // Dược sĩ phát thuốc
      const mDisp = createMockReqRes({
        params: { id: presToDispense._id.toString() },
        body: { pharmacistId: pharmacistUser._id.toString(), pharmacistName: pharmacistUser.profile.name },
        user: pharmacistUser
      });
      await dispensePrescription(mDisp.req, mDisp.res);
      assert.strictEqual(mDisp.getStatus(), 200, "Phát thuốc thành công phải trả về 200");

      const checkDrugAfterDisp = await Drug.findById(noDoubleDrug._id);
      // Tồn kho vẫn phải là 90, không được bị trừ lần 2 thành 80!
      assert.strictEqual(checkDrugAfterDisp.stock.quantity, 90, `Tồn kho sau khi phát vẫn phải là 90 (Hiện tại: ${checkDrugAfterDisp.stock.quantity})`);
    });

    // ── TEST 12: Context Loss Defense (No-Store orderCode Query Blocked) ──
    await runTest("12. Context Loss Protection: Truy vấn orderCode ngoài ngữ cảnh tenant không có bypassTenancy phải bị chặn", async () => {
      const orderCodeContextLoss = Math.floor(100000000 + Math.random() * 900000000);
      await Invoice.create({
        hospitalId: testHospital._id,
        patientId: patientUser._id,
        orderCode: orderCodeContextLoss,
        status: "chờ thanh toán",
        totalAmount: 100000,
        items: [{ description: "Khám chuyên khoa", amount: 100000, type: "exam" }]
      });

      // Truy vấn ngoài tenantStorage (store là undefined), không dùng bypassTenancy
      // Plugin tenancy fail-safe phải ép điều kiện {_id: null} và trả về null
      const leakAttempt = await Invoice.findOne({ orderCode: orderCodeContextLoss });
      assert.strictEqual(leakAttempt, null, "Truy vấn orderCode khi mất ngữ cảnh tenant phải trả về NULL (chống đọc xuyên viện)");

      // Ngược lại, truy vấn tường minh với bypassTenancy: true (dành riêng cho Webhook/Job) thì cho phép
      const explicitBypass = await Invoice.findOne({ orderCode: orderCodeContextLoss }, null, { bypassTenancy: true });
      assert.ok(explicitBypass, "Truy vấn tường minh với bypassTenancy: true phải tìm được hóa đơn");
    });

    // ── TEST 13: Emergency Immediate Inventory Deduction ──
    await runTest("13. Emergency Immediate Deduction: Cấp cứu phát thuốc trước phải trừ kho ngay và không trừ lặp khi thanh toán", async () => {
      const emerDrug = await Drug.create({
        hospitalId: testHospital._id,
        name: `Emergency Adrenaline ${Date.now()}`,
        activeIngredient: "Epinephrine",
        stock: { quantity: 50, unit: "Ống", minStock: 5 },
        price: 15000
      });

      const emerInvoice = await Invoice.create({
        hospitalId: testHospital._id,
        patientId: patientUser._id,
        status: "chờ thanh toán",
        stockDeductionStatus: "PENDING",
        orderCode: Math.floor(100000000 + Math.random() * 900000000),
        totalAmount: 150000,
        items: [{ description: emerDrug.name, drugId: emerDrug._id, quantity: 10, amount: 150000, type: "drug" }]
      });

      const emerPres = await Prescription.create({
        hospitalId: testHospital._id,
        doctorId: doctorUser._id,
        patient_id: patientUser._id,
        invoiceId: emerInvoice._id,
        diagnosis: "Sốc phản vệ nguy kịch",
        dispenseStatus: "PENDING_DISPENSE",
        clinicalSafety: {
          requiresDualSign: true,
          dualSignStatus: "PENDING_PHARMACY_VERIFICATION",
          overrideCategory: "ACUTE_EMERGENCY" // Cấp cứu đe dọa tính mạng
        },
        drugs: [{ name: emerDrug.name, quantity: 10 }]
      });

      // Dược sĩ phát thuốc cấp cứu trước khi thanh toán viện phí
      const mEmerDisp = createMockReqRes({
        params: { id: emerPres._id.toString() },
        body: { pharmacistId: pharmacistUser._id.toString(), pharmacistName: pharmacistUser.profile.name },
        user: pharmacistUser
      });
      await dispensePrescription(mEmerDisp.req, mEmerDisp.res);
      assert.strictEqual(mEmerDisp.getStatus(), 200, "Phát thuốc cấp cứu phải thành công 200");

      // 1. Tồn kho phải bị trừ ngay tại thời điểm phát thuốc (50 -> 40)
      const drugAfterEmerDisp = await Drug.findById(emerDrug._id);
      assert.strictEqual(drugAfterEmerDisp.stock.quantity, 40, `Tồn kho sau khi phát cấp cứu phải trừ ngay còn 40 (Hiện tại: ${drugAfterEmerDisp.stock.quantity})`);

      // 2. Hóa đơn phải được đánh dấu DEDUCTED
      const invAfterEmerDisp = await Invoice.findById(emerInvoice._id);
      assert.strictEqual(invAfterEmerDisp.stockDeductionStatus, "DEDUCTED", "Hóa đơn cấp cứu phải được đánh dấu DEDUCTED");
      assert.strictEqual(invAfterEmerDisp.status, "chờ thanh toán", "Trạng thái hóa đơn vẫn là chờ thanh toán");

      // 3. Sau đó bệnh nhân thanh toán qua PayOS Webhook
      const mEmerPay = createMockReqRes({
        body: {
          code: "00",
          desc: "Thanh toán viện phí sau",
          data: { orderCode: emerInvoice.orderCode, amount: 150000 }
        }
      });
      await handlePayOSWebhook(mEmerPay.req, mEmerPay.res);
      assert.strictEqual(mEmerPay.getStatus(), 200, "Webhook thanh toán phải thành công 200");

      // 4. Kiểm tra chống trừ đúp: Tồn kho vẫn là 40, KHÔNG ĐƯỢC trừ thành 30!
      const drugAfterWebhook = await Drug.findById(emerDrug._id);
      assert.strictEqual(drugAfterWebhook.stock.quantity, 40, `Tồn kho sau khi thanh toán PayOS vẫn phải là 40 (Không trừ đúp, Hiện tại: ${drugAfterWebhook.stock.quantity})`);

      const finalInv = await Invoice.findById(emerInvoice._id);
      assert.strictEqual(finalInv.status, "đã thanh toán", "Hóa đơn chuyển sang đã thanh toán");
      assert.strictEqual(finalInv.stockDeductionStatus, "DEDUCTED", "Hóa đơn giữ trạng thái DEDUCTED");
    });

    // ── TEST 14: Webhook Transient Error Handling (HTTP 500 & Auto-Revert) ──
    await runTest("14. Webhook 5xx Transient Error: Lỗi hạ tầng DB phải trả về HTTP 500 và khôi phục trạng thái chờ thanh toán", async () => {
      const infraOrderCode = Math.floor(100000000 + Math.random() * 900000000);
      const infraInvoice = await Invoice.create({
        hospitalId: testHospital._id,
        patientId: patientUser._id,
        orderCode: infraOrderCode,
        status: "chờ thanh toán",
        stockDeductionStatus: "PENDING",
        totalAmount: 200000,
        items: [{ description: "Chụp MRI", amount: 200000, type: "mri" }]
      });

      // Tạo tình huống lỗi hạ tầng giả lập bằng cách ghi đè tạm thời Invoice.findById ném lỗi DB Network Timeout
      const originalFindById = Invoice.findById;
      let injectError = true;
      Invoice.findById = function(...args) {
        if (injectError && args[0]?.toString() === infraInvoice._id.toString()) {
          const err = new Error("MongoNetworkTimeoutError: connection timed out during transaction");
          err.code = "ETIMEDOUT";
          throw err;
        }
        return originalFindById.apply(this, args);
      };

      try {
        const mInfra = createMockReqRes({
          body: {
            code: "00",
            desc: "Thanh toán",
            data: { orderCode: infraOrderCode, amount: 200000 }
          }
        });

        await handlePayOSWebhook(mInfra.req, mInfra.res);

        // Phải trả về HTTP 500 để PayOS tự động gửi lại (retry)
        assert.strictEqual(mInfra.getStatus(), 500, `Lỗi hạ tầng phải trả HTTP 500 (Nhận: ${mInfra.getStatus()})`);
      } finally {
        injectError = false;
        Invoice.findById = originalFindById;
      }

      // Hóa đơn phải được khôi phục về 'chờ thanh toán' để đón nhận retry từ PayOS
      const checkReverted = await Invoice.findById(infraInvoice._id);
      assert.strictEqual(checkReverted.status, "chờ thanh toán", "Hóa đơn phải được khôi phục về 'chờ thanh toán'");
      assert.ok(checkReverted.paymentNotes.includes("Lỗi hạ tầng"), "Phải có ghi chú lỗi hạ tầng trong hóa đơn");
    });

    // ── TEST 15: Buggy 0 VND Standard Invoice Blocked at Pharmacy ──
    await runTest("15. Zero-Price Defense: Hóa đơn 0 đồng thiếu thông tin BHYT/tài trợ bị chặn tại quầy Dược", async () => {
      const bugDrug = await Drug.create({
        hospitalId: testHospital._id,
        name: `Zero Bug Drug ${Date.now()}`,
        activeIngredient: "ZeroCheck",
        expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        stock: { quantity: 20, unit: "Viên", minStock: 2 },
        price: 0 // Lỗi cấu hình dữ liệu 0đ
      });

      // Hóa đơn standard có tổng tiền = 0 và bệnh nhân trả = 0 nhưng KHÔNG CÓ BHYT hay Từ thiện
      const zeroBugInvoice = await Invoice.create({
        hospitalId: testHospital._id,
        patientId: patientUser._id,
        status: "chờ thanh toán",
        stockDeductionStatus: "PENDING",
        totalAmount: 0,
        patientPayAmount: 0,
        billingType: "standard", // Chuẩn nhưng giá 0đ
        items: [{ description: bugDrug.name, drugId: bugDrug._id, quantity: 5, amount: 0, type: "drug" }]
      });

      const zeroPres = await Prescription.create({
        hospitalId: testHospital._id,
        doctorId: doctorUser._id,
        patient_id: patientUser._id,
        invoiceId: zeroBugInvoice._id,
        diagnosis: "Viêm họng hạt",
        dispenseStatus: "PENDING_DISPENSE",
        drugs: [{ name: bugDrug.name, quantity: 5 }]
      });

      const mZero = createMockReqRes({
        params: { id: zeroPres._id.toString() },
        body: { pharmacistId: pharmacistUser._id.toString(), pharmacistName: pharmacistUser.profile.name },
        user: pharmacistUser
      });

      await dispensePrescription(mZero.req, mZero.res);
      assert.strictEqual(mZero.getStatus(), 400, "Hóa đơn 0đ không có BHYT/tài trợ phải bị chặn tại quầy (400)");
      assert.strictEqual(zeroPres.dispenseStatus, "PENDING_DISPENSE", "Đơn thuốc không được chuyển sang DISPENSED");
    });

    // ── TEST 16: Negative Test - Outpatient Doctor Forbidden from ACUTE_EMERGENCY ──
    await runTest("16. Negative Test: Bác sĩ ngoại trú kê đơn gán ACUTE_EMERGENCY bị từ chối 403 Forbidden", async () => {
      const mOutpatient = createMockReqRes({
        params: { patientId: patientUser._id.toString() },
        body: {
          doctor_name: outpatientDoctorUser.profile.name,
          diagnosis: "Đau nửa đầu",
          drugs: [{ name: "Paracetamol 500mg", quantity: 10, unit: "Viên" }],
          overrideCategory: "ACUTE_EMERGENCY",
          overrideReason: "Cố tình lách quy định cấp cứu"
        },
        user: outpatientDoctorUser
      });

      await addPatientPrescription(mOutpatient.req, mOutpatient.res);
      assert.strictEqual(mOutpatient.getStatus(), 403, "Bác sĩ ngoại trú không có thẩm quyền cấp cứu phải bị từ chối 403");
      const respData = mOutpatient.getData();
      assert.ok(respData?.message?.includes("Thẩm quyền từ chối"), "Thông báo phải chỉ rõ lý do từ chối thẩm quyền");
    });

    // ── TEST 17: Zero-Price Anti-Fraud Defense ──
    await runTest("17. Zero-Price Defense: Gõ 'từ thiện' vào ghi chú tự do hoặc số thẻ BHYT giả/hết hạn bị chặn tại quầy (400)", async () => {
      const normalDrug = await Drug.create({
        hospitalId: testHospital._id,
        name: `Anti-Fraud Drug ${Date.now()}`,
        activeIngredient: "AntiFraud",
        expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        stock: { quantity: 50, unit: "Viên", minStock: 5 },
        price: 50000
      });

      // Ca 1: Gõ chữ "từ thiện" vào ô ghi chú tự do nhưng không có phê duyệt cấu trúc charityApproval
      const fakeCharityInv = await Invoice.create({
        hospitalId: testHospital._id,
        patientId: patientUser._id,
        status: "chờ thanh toán",
        stockDeductionStatus: "PENDING",
        totalAmount: 100000,
        patientPayAmount: 0,
        billingType: "standard", // Cố tình để standard
        paymentNotes: "Bệnh nhân được từ thiện tài trợ tiền viện phí", // Ô ghi chú tự do
        items: [{ description: normalDrug.name, drugId: normalDrug._id, quantity: 2, amount: 100000, type: "drug" }]
      });

      const fakePres = await Prescription.create({
        hospitalId: testHospital._id,
        doctorId: doctorUser._id,
        patient_id: patientUser._id,
        invoiceId: fakeCharityInv._id,
        diagnosis: "Sốt xuất huyết",
        dispenseStatus: "PENDING_DISPENSE",
        drugs: [{ name: normalDrug.name, quantity: 2 }]
      });

      const mFraud = createMockReqRes({
        params: { id: fakePres._id.toString() },
        body: { pharmacistId: pharmacistUser._id.toString(), pharmacistName: pharmacistUser.profile.name },
        user: pharmacistUser
      });

      await dispensePrescription(mFraud.req, mFraud.res);
      assert.strictEqual(mFraud.getStatus(), 400, "Ghi chú tự do 'từ thiện' không có cấu trúc phê duyệt phải bị chặn phát thuốc (400)");

      // Ca 2: Thẻ BHYT hết hạn
      const expiredBhytInv = await Invoice.create({
        hospitalId: testHospital._id,
        patientId: patientUser._id,
        status: "chờ thanh toán",
        stockDeductionStatus: "PENDING",
        totalAmount: 100000,
        patientPayAmount: 0,
        billingType: "standard",
        bhytInfo: {
          cardNumber: "DN4791234567890",
          coverageRate: 100,
          cardExpiryDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Đã hết hạn hôm qua
          isCardValid: true
        },
        items: [{ description: normalDrug.name, drugId: normalDrug._id, quantity: 2, amount: 100000, type: "drug" }]
      });

      const expiredPres = await Prescription.create({
        hospitalId: testHospital._id,
        doctorId: doctorUser._id,
        patient_id: patientUser._id,
        invoiceId: expiredBhytInv._id,
        diagnosis: "Viêm phế quản",
        dispenseStatus: "PENDING_DISPENSE",
        drugs: [{ name: normalDrug.name, quantity: 2 }]
      });

      const mExpired = createMockReqRes({
        params: { id: expiredPres._id.toString() },
        body: { pharmacistId: pharmacistUser._id.toString(), pharmacistName: pharmacistUser.profile.name },
        user: pharmacistUser
      });

      await dispensePrescription(mExpired.req, mExpired.res);
      assert.strictEqual(mExpired.getStatus(), 400, "Thẻ BHYT hết hạn phải bị chặn phát thuốc (400)");
    });

    // ── TEST 18: Emergency Stock Variance (Life-Saving Priority) ──
    await runTest("18. Emergency Stock Variance: Kho DB = 0 không chặn cứu người, ghi nhận biến động lệch kho và cảnh báo khẩn cấp", async () => {
      const emergencyShortDrug = await Drug.create({
        hospitalId: testHospital._id,
        name: `Adrenaline Auto-Injector ${Date.now()}`,
        activeIngredient: "Epinephrine",
        expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        stock: { quantity: 0, unit: "Ống", minStock: 5 }, // Sổ sách tồn kho đang bằng 0!
        price: 250000
      });

      const zeroStockInvoice = await Invoice.create({
        hospitalId: testHospital._id,
        patientId: patientUser._id,
        status: "chờ thanh toán",
        stockDeductionStatus: "PENDING",
        orderCode: Math.floor(100000000 + Math.random() * 900000000),
        totalAmount: 500000,
        items: [{ description: emergencyShortDrug.name, drugId: emergencyShortDrug._id, quantity: 2, amount: 500000, type: "drug" }]
      });

      const acutePrescription = await Prescription.create({
        hospitalId: testHospital._id,
        doctorId: doctorUser._id,
        patient_id: patientUser._id,
        invoiceId: zeroStockInvoice._id,
        diagnosis: "Sốc phản vệ độ IV - Ngừng tuần hoàn",
        dispenseStatus: "AWAITING_PHARMACY_VERIFICATION",
        clinicalSafety: {
          requiresDualSign: true,
          dualSignStatus: "PENDING_PHARMACY_VERIFICATION",
          overrideCategory: "ACUTE_EMERGENCY",
          overrideReason: "Bệnh nhân sốc phản vệ nguy kịch tính mạng, phải tiêm Adrenaline ngay lập tức!"
        },
        drugs: [{ name: emergencyShortDrug.name, quantity: 2 }]
      });

      const mDispenseZero = createMockReqRes({
        params: { id: acutePrescription._id.toString() },
        body: { pharmacistId: pharmacistUser._id.toString(), pharmacistName: pharmacistUser.profile.name },
        user: pharmacistUser
      });

      await dispensePrescription(mDispenseZero.req, mDispenseZero.res);
      assert.strictEqual(mDispenseZero.getStatus(), 200, "Cấp cứu đe dọa tính mạng không được chặn phát thuốc vì tồn kho sổ sách");

      const checkPres = await Prescription.findById(acutePrescription._id);
      assert.strictEqual(checkPres.dispenseStatus, "DISPENSED", "Đơn thuốc cấp cứu phải được chuyển sang DISPENSED");

      // Kiểm tra biến động kho: Phải ghi nhận lệch kho
      const checkDrug = await Drug.findById(emergencyShortDrug._id);
      assert.strictEqual(checkDrug.stock.quantity, 0, "Tồn kho DB giữ ở mức 0");
      const movements = checkDrug.stockMovements || [];
      const varianceMovement = movements.find(m => m.reason && m.reason.includes("Cấp cứu khẩn cấp - Lệch kho"));
      assert.ok(varianceMovement, "Phải ghi nhận stockMovement lý do [Cấp cứu khẩn cấp - Lệch kho]");
    });

    // ── TEST 19: Permanent Error Classification (HTTP 200 to break PayOS loop) ──
    await runTest("19. Webhook Permanent Error: Lỗi dữ liệu/danh mục vĩnh viễn không trả 500 mà gắn cờ PERMANENT_ERROR_FLAGGED và trả 200", async () => {
      const permOrderCode = Math.floor(100000000 + Math.random() * 900000000);
      const permInvoice = await Invoice.create({
        hospitalId: testHospital._id,
        patientId: patientUser._id,
        orderCode: permOrderCode,
        status: "chờ thanh toán",
        stockDeductionStatus: "PENDING",
        totalAmount: 300000,
        items: [{ description: "Thuốc đã xóa khỏi hệ thống", amount: 300000, type: "drug" }] // Thuốc không có trong danh mục
      });

      const mPerm = createMockReqRes({
        body: {
          code: "00",
          desc: "Thanh toán",
          data: { orderCode: permOrderCode, amount: 300000 }
        }
      });

      await handlePayOSWebhook(mPerm.req, mPerm.res);
      assert.strictEqual(mPerm.getStatus(), 200, "Lỗi vĩnh viễn phải trả 200 để ngắt retry loop của PayOS");

      const checkPerm = await Invoice.findById(permInvoice._id);
      assert.strictEqual(checkPerm.status, "đang xử lý", "Hóa đơn phải giữ trạng thái 'đang xử lý' chờ can thiệp thủ công");
      assert.strictEqual(checkPerm.stockDeductionStatus, "PERMANENT_ERROR_FLAGGED", "Phải được gắn cờ PERMANENT_ERROR_FLAGGED");
    });

  } finally {
    // Dọn dẹp dữ liệu kiểm thử (Clean up test data an toàn tuyệt đối)
    try {
      if (!testHospital?._id) {
        throw new Error("testHospital._id không tồn tại, hủy lệnh xóa dọn dẹp để đảm bảo an toàn!");
      }
      await tenantStorage.run({ hospitalId: testHospital._id.toString(), bypassTenancy: true }, async () => {
        await User.deleteMany({ hospitalId: testHospital._id });
        await Drug.deleteMany({ hospitalId: testHospital._id });
        await Invoice.deleteMany({ hospitalId: testHospital._id });
        await Prescription.deleteMany({ hospitalId: testHospital._id });
        await Hospital.findByIdAndDelete(testHospital._id);
      });
      console.log("🧹 Đã dọn dẹp sạch sẽ toàn bộ dữ liệu kiểm thử theo hospitalId cụ thể.");
    } catch (cleanErr) {
      console.warn("Lỗi dọn dẹp:", cleanErr.message);
    }

    // Restore payos verification
    payos.webhooks.verify = originalVerify;
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }

  console.log("\n======================================================================");
  console.log(`   INTEGRATION TEST SUMMARY: ${passed} PASSED / ${failed} FAILED`);
  console.log("======================================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
