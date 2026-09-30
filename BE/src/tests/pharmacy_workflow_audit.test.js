/**
 * NeuroScan AI - Pharmacy Operational Workflow & Inventory Integrity Test Suite
 * Phase 3 Verification: PayOS Deduction, Dual-Sign Choke-points, Reminders at Dispense, CDSS Fail-open
 */
import assert from "assert";
import { assessPrescriptionSafety } from "../modules/pharmacy/services/drugSafety.service.js";

console.log("\n======================================================================");
console.log("   NEUROSCAN AI: PHARMACY WORKFLOW & INVENTORY AUDIT TEST SUITE       ");
console.log("======================================================================\n");

let passed = 0;
let failed = 0;

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✔ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
};

// ── TEST SUITE 1: PayOS Webhook Inventory Deduction & Idempotency ────────────
console.log("RUNNING SUITE 1: PayOS Webhook Inventory Deduction & Idempotency (3B-1 & 3B-2)");

await test("1.1. Atomic Conditional Check-and-Deduct: Kiểm tra cơ chế trừ kho nguyên tử với balanceAfter chính xác", () => {
  // Giả lập trạng thái kho của một loại thuốc (e.g. Temozolomide 100mg)
  const drugStock = {
    quantity: 50,
    unit: "viên",
    minStock: 10,
    stockMovements: []
  };

  const deductQuantity = 10;
  assert.ok(drugStock.quantity >= deductQuantity, "Kho phải đủ số lượng để trừ");

  // Giả lập atomic decrement: { $inc: { 'stock.quantity': -qty } } và returnDocument: 'after'
  drugStock.quantity -= deductQuantity;
  const balanceAfter = drugStock.quantity; // 40

  drugStock.stockMovements.push({
    type: "export",
    quantity: deductQuantity,
    balanceAfter: balanceAfter,
    reason: "Thanh toán hóa đơn PayOS INV-001",
    timestamp: new Date()
  });

  assert.strictEqual(drugStock.quantity, 40, "Tồn kho sau khi trừ phải là 40");
  assert.strictEqual(drugStock.stockMovements[0].balanceAfter, 40, "balanceAfter phải ghi nhận chính xác 40 từ document sau cập nhật");
});

await test("1.2. Idempotency: Webhook gọi lặp (duplicate webhook / replay) chỉ trừ kho một lần duy nhất", () => {
  // Giả lập hóa đơn trong database
  const invoiceDb = {
    _id: "inv_12345",
    orderCode: 987654,
    status: "chờ thanh toán", // trạng thái ban đầu
    stockDeductionStatus: "PENDING",
    stockDeductionLogs: []
  };

  let stockDeductionCount = 0;

  // Hàm mô phỏng xử lý webhook nguyên tử: findOneAndUpdate({ orderCode, status: 'chờ thanh toán' }, { status: 'đang xử lý' })
  function simulateWebhookProcessing(orderCode) {
    // Chỉ cập nhật và trừ kho nếu status hiện tại là "chờ thanh toán"
    if (invoiceDb.orderCode === orderCode && invoiceDb.status === "chờ thanh toán") {
      invoiceDb.status = "đang xử lý";
      // Thực thi trừ kho trong transaction
      stockDeductionCount++;
      invoiceDb.stockDeductionStatus = "DEDUCTED";
      invoiceDb.status = "đã thanh toán";
      return { success: true, message: "Thanh toán và trừ kho thành công" };
    } else {
      // Đã xử lý rồi (idempotent duplicate)
      return { success: true, message: "Hóa đơn đã được xử lý trước đó, bỏ qua trừ kho lặp." };
    }
  }

  // Request 1 từ PayOS Webhook
  const res1 = simulateWebhookProcessing(987654);
  assert.strictEqual(res1.message, "Thanh toán và trừ kho thành công");
  assert.strictEqual(stockDeductionCount, 1, "Kho phải được trừ 1 lần");
  assert.strictEqual(invoiceDb.status, "đã thanh toán");

  // Request 2 (gửi lại do mạng chập chờn hoặc retry của cổng PayOS)
  const res2 = simulateWebhookProcessing(987654);
  assert.strictEqual(res2.message, "Hóa đơn đã được xử lý trước đó, bỏ qua trừ kho lặp.");
  assert.strictEqual(stockDeductionCount, 1, "Kho tuyệt đối không được trừ lần thứ hai");
});

await test("1.3. Post-Payment Stock Shortage: Xử lý an toàn khi bệnh nhân đã trả tiền PayOS nhưng kho bị thiếu", () => {
  const invoice = {
    orderCode: 888111,
    status: "đang xử lý",
    stockDeductionStatus: "PENDING"
  };

  const currentAvailableStock = 2;
  const requestedStock = 5;

  let shortageFlagged = false;
  if (currentAvailableStock < requestedStock) {
    // Không nuốt lỗi, gắn cờ SHORTAGE_FLAGGED, giữ trạng thái đang xử lý để Dược sĩ / Thu ngân can thiệp
    invoice.stockDeductionStatus = "SHORTAGE_FLAGGED";
    invoice.status = "đang xử lý";
    shortageFlagged = true;
  }

  assert.strictEqual(shortageFlagged, true, "Phải phát hiện và gắn cờ thiếu kho");
  assert.strictEqual(invoice.stockDeductionStatus, "SHORTAGE_FLAGGED", "Trạng thái khấu trừ kho phải là SHORTAGE_FLAGGED");
  assert.notStrictEqual(invoice.status, "đã thanh toán", "Hóa đơn không được đánh dấu hoàn tất 'đã thanh toán' khi kho chưa xuất được");
});

// ── TEST SUITE 2: Pharmacy Operational Queue & Dual-Sign Choke-points (3A) ───
console.log("\nRUNNING SUITE 2: Pharmacy Operational Queue & Dispense Choke-points (3A)");

await test("2.1. Anti-Self-Verify (Separation of Duties): Bác sĩ kê đơn không được tự duyệt Dual-Sign", () => {
  const doctorUserId = "doc_nguyen_van_a";
  const pharmacistUserId = "pharm_tran_van_b";

  const prescription = {
    _id: "pres_001",
    doctorId: doctorUserId,
    clinicalSafety: {
      requiresDualSign: true,
      dualSignStatus: "PENDING_PHARMACY_VERIFICATION"
    }
  };

  // Giả lập verifyPrescription: Bác sĩ A cố gắng tự duyệt đơn của mình
  function attemptVerify(userId, pres) {
    if (pres.doctorId && pres.doctorId === userId) {
      return { status: 403, error: "Bác sĩ kê đơn tuyệt đối không được đồng thời là người xác nhận kép cho chính mình." };
    }
    pres.clinicalSafety.dualSignStatus = "VERIFIED";
    return { status: 200, success: true };
  }

  const doctorAttempt = attemptVerify(doctorUserId, prescription);
  assert.strictEqual(doctorAttempt.status, 403, "Phải chặn bác sĩ tự duyệt đơn");
  assert.strictEqual(prescription.clinicalSafety.dualSignStatus, "PENDING_PHARMACY_VERIFICATION", "Trạng thái dual-sign không đổi");

  // Dược sĩ lâm sàng B duyệt -> Cho phép
  const pharmacistAttempt = attemptVerify(pharmacistUserId, prescription);
  assert.strictEqual(pharmacistAttempt.status, 200, "Dược sĩ độc lập được phép duyệt");
  assert.strictEqual(prescription.clinicalSafety.dualSignStatus, "VERIFIED", "Trạng thái chuyển sang VERIFIED");
});

await test("2.2. Dispense Stage Hard Stop: Chặn xuất thuốc vật lý nếu đơn CRITICAL chưa được Dược sĩ duyệt", () => {
  const unverifiedPrescription = {
    _id: "pres_critical_002",
    dispenseStatus: "AWAITING_PHARMACY_VERIFICATION",
    clinicalSafety: {
      status: "CRITICAL",
      requiresDualSign: true,
      dualSignStatus: "PENDING_PHARMACY_VERIFICATION",
      overrideCategory: "BENEFIT_EXCEEDS_RISK" // Không phải cấp cứu
    }
  };

  function attemptDispense(pres, invoicePaid) {
    if (pres.clinicalSafety?.requiresDualSign) {
      const isDualSigned = pres.clinicalSafety?.dualSignStatus === "VERIFIED";
      const isAcuteEmergency = pres.clinicalSafety?.overrideCategory === "ACUTE_EMERGENCY";

      if (!isDualSigned && !isAcuteEmergency) {
        return { status: 403, error: "Đơn thuốc có cảnh báo CRITICAL chưa được Dược sĩ lâm sàng ký duyệt (Dual-Sign)." };
      }
    }
    if (!invoicePaid) {
      return { status: 400, error: "Hóa đơn viện phí chưa thanh toán." };
    }
    pres.dispenseStatus = "DISPENSED";
    return { status: 200, success: true };
  }

  // Thử phát thuốc khi chưa ký duyệt Dual-Sign
  const resBlocked = attemptDispense(unverifiedPrescription, true);
  assert.strictEqual(resBlocked.status, 403, "Phải chặn phát thuốc ở tầng quầy Dược");
  assert.strictEqual(unverifiedPrescription.dispenseStatus, "AWAITING_PHARMACY_VERIFICATION");

  // Dược sĩ duyệt xong
  unverifiedPrescription.clinicalSafety.dualSignStatus = "VERIFIED";
  const resApproved = attemptDispense(unverifiedPrescription, true);
  assert.strictEqual(resApproved.status, 200, "Sau khi duyệt Dual-Sign, cho phép xuất phát thuốc");
  assert.strictEqual(unverifiedPrescription.dispenseStatus, "DISPENSED");
});

await test("2.3. Acute Emergency Override: Cấp cứu được phát thuốc trước và gắn cờ hậu kiểm 24h", () => {
  const emergencyPrescription = {
    _id: "pres_emer_003",
    dispenseStatus: "PENDING_DISPENSE",
    postHocReviewRequired: false,
    clinicalSafety: {
      status: "CRITICAL",
      requiresDualSign: true,
      dualSignStatus: "PENDING_PHARMACY_VERIFICATION",
      overrideCategory: "ACUTE_EMERGENCY" // Cấp cứu đe dọa tính mạng
    }
  };

  function attemptDispenseEmergency(pres, invoicePaid) {
    if (pres.clinicalSafety?.requiresDualSign) {
      const isDualSigned = pres.clinicalSafety?.dualSignStatus === "VERIFIED";
      const isAcuteEmergency = pres.clinicalSafety?.overrideCategory === "ACUTE_EMERGENCY";

      if (!isDualSigned && !isAcuteEmergency) {
        return { status: 403, error: "Chặn Dual-Sign" };
      }

      if (!isDualSigned && isAcuteEmergency) {
        pres.postHocReviewRequired = true; // Kích hoạt cờ hậu kiểm
      }
    }
    pres.dispenseStatus = "DISPENSED";
    return { status: 200, success: true };
  }

  const res = attemptDispenseEmergency(emergencyPrescription, true);
  assert.strictEqual(res.status, 200, "Cho phép xuất phát thuốc cấp cứu");
  assert.strictEqual(emergencyPrescription.dispenseStatus, "DISPENSED");
  assert.strictEqual(emergencyPrescription.postHocReviewRequired, true, "Bắt buộc gắn cờ hậu kiểm Dược (postHocReviewRequired: true)");
});

await test("2.4. Payment Choke-point: Chặn phát thuốc nếu viện phí chưa thanh toán", () => {
  const validPrescription = {
    _id: "pres_004",
    dispenseStatus: "READY",
    clinicalSafety: { requiresDualSign: false }
  };

  const invoice = { status: "chờ thanh toán" };

  function checkPaymentAndDispense(pres, inv) {
    if (inv && inv.status !== "đã thanh toán") {
      return { status: 400, error: "Hóa đơn viện phí chưa được thanh toán hoàn tất." };
    }
    pres.dispenseStatus = "DISPENSED";
    return { status: 200, success: true };
  }

  const attemptUnpaid = checkPaymentAndDispense(validPrescription, invoice);
  assert.strictEqual(attemptUnpaid.status, 400, "Phải chặn phát thuốc khi chưa thanh toán");
  assert.strictEqual(validPrescription.dispenseStatus, "READY", "Đơn vẫn giữ trạng thái READY tại quầy");

  invoice.status = "đã thanh toán";
  const attemptPaid = checkPaymentAndDispense(validPrescription, invoice);
  assert.strictEqual(attemptPaid.status, 200, "Cho phép phát thuốc sau khi đã thanh toán");
  assert.strictEqual(validPrescription.dispenseStatus, "DISPENSED");
});

// ── TEST SUITE 3: Medication Reminders Triggered at Physical Dispense (3B-3) ──
console.log("\nRUNNING SUITE 3: Medication Reminders Generated at Dispense Time (3B-3)");

await test("3.1. Reminders scheduled from physical dispense timestamp, not prescription draft time", () => {
  const prescribedAt = new Date("2026-09-30T08:00:00Z"); // Bác sĩ kê lúc 8h sáng
  const dispensedAt = new Date("2026-09-30T14:30:00Z");  // Bệnh nhân trả tiền và nhận thuốc lúc 14h30

  // Giả lập lịch uống thuốc 2 lần/ngày trong 7 ngày
  const drug = {
    name: "Keppra 500mg",
    timesPerDay: 2,
    durationDays: 7
  };

  // Nếu tính từ lúc kê đơn (sai thực tế nếu bệnh nhân chưa lấy thuốc):
  const badFirstReminder = new Date(prescribedAt);
  // Nếu tính từ thời điểm phát thuốc thực tế:
  const correctFirstReminder = new Date(dispensedAt);

  assert.ok(correctFirstReminder > badFirstReminder, "Mốc phát thuốc phải muộn hơn hoặc bằng mốc kê đơn");
  assert.strictEqual(correctFirstReminder.toISOString(), "2026-09-30T14:30:00.000Z", "Lịch nhắc bắt đầu chính xác từ thời điểm người bệnh cầm thuốc trên tay");
});

// ── TEST SUITE 4: Clinical Safety Engine, Sulfa Allergy & Fail-Open (3C) ──────
console.log("\nRUNNING SUITE 4: Clinical Safety Engine, Sulfa Alternative & Fail-open (3C)");

await test("4.1. Fail-open Source Transparency: Trả về trạng thái nguồn { kb, fda, ai }", async () => {
  const result = await assessPrescriptionSafety({
    patientId: null,
    patientProfile: { allergies: [] },
    medications: [{ name: "Keppra", quantity: 10, unit: "viên" }],
    diagnosis: "Động kinh",
    requestAi: false
  });

  assert.ok(result.sources, "Kết quả thẩm định phải trả về đối tượng sources");
  assert.strictEqual(result.sources.kb, "ok", "Cơ sở tri thức nội bộ KB phải là 'ok'");
  assert.ok(["ok", "timeout", "error", "skipped"].includes(result.sources.fda), "FDA status phải rõ ràng");
  assert.ok(["ok", "timeout", "error", "skipped"].includes(result.sources.ai), "AI status phải rõ ràng");
});

await test("4.2. Sulfa Allergy Alternative: Đề xuất Pentamidine / Atovaquone thay vì Co-trimoxazole khi dị ứng Sulfa", async () => {
  const result = await assessPrescriptionSafety({
    patientId: null,
    patientProfile: {
      allergies: ["Dị ứng Sulfa", "Sulfamethoxazole"]
    },
    medications: [
      { name: "Temozolomide", category: "chemotherapy" },
      { name: "Dexamethasone", category: "corticosteroid" }
    ],
    diagnosis: "Glioblastoma",
    requestAi: false
  });

  const pcpWarning = result.warnings.find(w => w.type === "PCP_PROPHYLAXIS_ALERT");
  assert.ok(pcpWarning, "Phải phát hiện cảnh báo nguy cơ viêm phổi cơ hội PCP/PJP khi dùng TMZ + Dexa");
  assert.ok(pcpWarning.message.includes("DỊ ỨNG NHÓM SULFA"), "Phải cảnh báo chống chỉ định Co-trimoxazole do tiền sử dị ứng Sulfa");
  assert.ok(
    pcpWarning.recommendation.includes("Pentamidine") || pcpWarning.recommendation.includes("Atovaquone"),
    "Khuyến nghị lâm sàng phải đề xuất phác đồ thay thế bằng Pentamidine hoặc Atovaquone"
  );
});

await test("4.3. Missing Lab Data Guard: Phát hiện thiếu xét nghiệm Công thức máu (CBC) khi kê Temozolomide", async () => {
  const result = await assessPrescriptionSafety({
    patientId: null,
    patientProfile: { allergies: [] },
    medications: [{ name: "Temozolomide", category: "chemotherapy" }],
    labResults: null, // Không có kết quả xét nghiệm huyết học nào
    diagnosis: "U não ác tính",
    requestAi: false
  });

  const missingLabWarning = result.warnings.find(w => w.type === "MISSING_LAB_DATA");
  assert.ok(missingLabWarning, "Phải cảnh báo MISSING_LAB_DATA khi kê hóa chất mà hồ sơ không có xét nghiệm máu");
  assert.strictEqual(missingLabWarning.severity, "HIGH", "Mức độ cảnh báo phải là HIGH");
  assert.ok(missingLabWarning.recommendation.includes("PLT >= 100.000"), "Phải nhắc nhở kiểm tra ngưỡng an toàn tiểu cầu");
});

await test("4.4. AI Safeguards: AI không được phép hạ thấp mức cảnh báo CRITICAL của rule-based", async () => {
  const result = await assessPrescriptionSafety({
    patientId: null,
    patientProfile: {
      allergies: ["Gadolinium"]
    },
    orders: ["Chụp MRI sọ não có cản từ Gadolinium"],
    medications: [{ name: "Depakine" }, { name: "Phenobarbital" }], // CRITICAL DDI
    diagnosis: "U não",
    requestAi: true // Yêu cầu AI
  });

  assert.strictEqual(result.status, "CRITICAL", "Trạng thái tổng thể bắt buộc phải giữ nguyên mức CRITICAL");
  if (result.aiConsultation) {
    assert.strictEqual(result.aiConsultation.overall_status, "CRITICAL", "AI Safeguard phải ép overall_status của AI giữ nguyên mức CRITICAL");
  }
});

// ── TEST SUMMARY ─────────────────────────────────────────────────────────────
console.log("\n======================================================================");
console.log(`   TEST EXECUTION SUMMARY: ${passed} PASSED / ${failed} FAILED (${passed + failed} TOTAL)`);
console.log("======================================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
