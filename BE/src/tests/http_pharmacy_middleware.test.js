/**
 * NeuroScan AI - HTTP Middleware Verification Test Suite
 * Validates checkRole, protect, and tenancy isolation over real HTTP connections (Fetch + Express)
 */

import http from "http";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import assert from "assert";
import dotenv from "dotenv";
import { User } from "../models/user.model.js";
import { Hospital } from "../models/hospital.model.js";
import { Prescription } from "../modules/pharmacy/models/prescription.model.js";
import drugRoutes from "../modules/pharmacy/drug.routes.js";
import invoiceRoutes from "../modules/billing/invoice.routes.js";
import patientRoutes from "../routes/patient.routes.js";
import { getJwtSecret } from "../config/jwt.config.js";

dotenv.config();

const TEST_MONGO_URI = process.env.TEST_MONGO_URI || process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/neuro_test";

function maskMongoUri(uri) {
  if (!uri) return "";
  return uri.replace(/\/\/[^:]+:[^@]+@/, "//***:***@");
}

console.log("\n======================================================================");
console.log("   NEUROSCAN AI: HTTP MIDDLEWARE & ROLE AUTHORIZATION TEST SUITE      ");
console.log("======================================================================\n");

async function main() {
  await mongoose.connect(TEST_MONGO_URI);
  console.log(`Connected to MongoDB at ${maskMongoUri(TEST_MONGO_URI)}.`);

  // Chốt chặn an toàn: Bắt buộc tên DB kết thúc bằng _test hoặc là DB test
  const dbName = mongoose.connection.name;
  if ((!dbName.endsWith("_test") && dbName !== "test") || process.env.NODE_ENV === "production") {
    throw new Error(`[BẢO MẬT TEST CHỐT CHẶN] Từ chối chạy HTTP test trên DB '${dbName}'. Test chỉ được phép chạy trên cơ sở dữ liệu kiểm thử có tên kết thúc bằng '_test' (ví dụ: 'neuro_test', 'mri_test') và không được chạy ở production.`);
  }
  console.log(`[BẢO MẬT TEST CHỐT CHẶN] Đã xác thực cơ sở dữ liệu kiểm thử biệt lập an toàn: '${dbName}'\n`);

  // Setup Test Tenant A
  const testHospital = await Hospital.create({
    name: "BV Test HTTP Auth",
    code: `HOSP_HTTP_${Date.now()}`,
    isActive: true
  });

  // Setup Test Tenant B (Để kiểm thử cách ly IDOR đa viện qua HTTP)
  const hospitalB = await Hospital.create({
    name: "BV Tenant B HTTP Auth",
    code: `HOSP_B_HTTP_${Date.now()}`,
    isActive: true
  });

  const patient = await User.create({
    email: `patient.http.${Date.now()}@hospital.vn`,
    passwordHash: "dummy",
    role: "patient",
    hospitalId: testHospital._id,
    profile: { name: "Patient HTTP" }
  });

  const outpatientDoctor = await User.create({
    email: `dr.outpatient.http.${Date.now()}@hospital.vn`,
    passwordHash: "dummy",
    role: "doctor",
    hospitalId: testHospital._id,
    departmentId: "KUTN-CLI",
    emergencyDuty: {
      isAssigned: false,
      expiresAt: null
    },
    profile: { name: "BS. Ngoại Trú HTTP", department: "Phòng khám Ngoại trú" }
  });

  const receptionist = await User.create({
    email: `recep.http.${Date.now()}@hospital.vn`,
    passwordHash: "dummy",
    role: "receptionist",
    hospitalId: testHospital._id,
    profile: { name: "Recep HTTP" }
  });

  const pharmacist = await User.create({
    email: `pharm.http.${Date.now()}@hospital.vn`,
    passwordHash: "dummy",
    role: "pharmacist",
    hospitalId: testHospital._id,
    profile: { name: "Pharm HTTP" }
  });

  const pharmacistB = await User.create({
    email: `pharmB.http.${Date.now()}@hospital.vn`,
    passwordHash: "dummy",
    role: "pharmacist",
    hospitalId: hospitalB._id,
    profile: { name: "Pharm B HTTP" }
  });

  const presHospitalA = await Prescription.create({
    hospitalId: testHospital._id,
    patient_id: patient._id,
    diagnosis: "Đau đầu nguyên phát",
    dispenseStatus: "AWAITING_PHARMACY_VERIFICATION",
    clinicalSafety: {
      requiresDualSign: true,
      dualSignStatus: "PENDING_PHARMACY_VERIFICATION"
    },
    drugs: [{ name: "Paracetamol 500mg", quantity: 10 }]
  });

  const jwtSecret = getJwtSecret();
  const tokenPatient = jwt.sign({ id: patient._id.toString() }, jwtSecret, { algorithm: "HS256", expiresIn: "1h" });
  const tokenOutpatient = jwt.sign({ id: outpatientDoctor._id.toString() }, jwtSecret, { algorithm: "HS256", expiresIn: "1h" });
  const tokenRecep = jwt.sign({ id: receptionist._id.toString() }, jwtSecret, { algorithm: "HS256", expiresIn: "1h" });
  const tokenPharm = jwt.sign({ id: pharmacist._id.toString() }, jwtSecret, { algorithm: "HS256", expiresIn: "1h" });
  const tokenPharmB = jwt.sign({ id: pharmacistB._id.toString() }, jwtSecret, { algorithm: "HS256", expiresIn: "1h" });

  // Setup real Express app
  const app = express();
  app.use(express.json());
  app.use("/api/drugs", drugRoutes);
  app.use("/api/v1/invoices", invoiceRoutes);
  app.use("/api/patients", patientRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Test HTTP Server running on ${baseUrl}\n`);

  let passed = 0;
  let failed = 0;

  const runHttpTest = async (title, fn) => {
    try {
      await fn();
      console.log(`  ✔ [PASS] ${title}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${title}: ${err.message}`);
      failed++;
    }
  };

  try {
    // 1. GET /api/v1/invoices/stuck-processing without token -> 401
    await runHttpTest("1. GET /stuck-processing không có token -> 401 Unauthorized", async () => {
      const res = await fetch(`${baseUrl}/api/v1/invoices/stuck-processing`);
      assert.strictEqual(res.status, 401, `Status phải là 401 (Nhận: ${res.status})`);
    });

    // 2. POST /api/v1/invoices/:id/resolve-processing with patient token -> 403
    await runHttpTest("2. POST /:id/resolve-processing với vai trò 'patient' -> 403 Forbidden", async () => {
      const res = await fetch(`${baseUrl}/api/v1/invoices/fake_id_12345/resolve-processing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokenPatient}`
        },
        body: JSON.stringify({ action: "cancel_refund" })
      });
      assert.strictEqual(res.status, 403, `Status phải là 403 (Nhận: ${res.status})`);
    });

    // 3. POST /api/drugs/prescriptions/:id/verify with receptionist token -> 403
    await runHttpTest("3. POST /prescriptions/:id/verify với vai trò 'receptionist' -> 403 Forbidden", async () => {
      const res = await fetch(`${baseUrl}/api/drugs/prescriptions/fake_id_12345/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokenRecep}`
        },
        body: JSON.stringify({ note: "Thẩm định trái phép" })
      });
      assert.strictEqual(res.status, 403, `Status phải là 403 (Nhận: ${res.status})`);
    });

    // 4. POST /api/drugs/prescriptions/:id/dispense with patient token -> 403
    await runHttpTest("4. POST /prescriptions/:id/dispense với vai trò 'patient' -> 403 Forbidden", async () => {
      const res = await fetch(`${baseUrl}/api/drugs/prescriptions/fake_id_12345/dispense`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokenPatient}`
        },
        body: JSON.stringify({})
      });
      assert.strictEqual(res.status, 403, `Status phải là 403 (Nhận: ${res.status})`);
    });

    // 5. GET /api/v1/invoices/stuck-processing with pharmacist token -> 200 (Authorized)
    await runHttpTest("5. GET /stuck-processing với vai trò 'pharmacist' -> 200 OK", async () => {
      const res = await fetch(`${baseUrl}/api/v1/invoices/stuck-processing`, {
        headers: { "Authorization": `Bearer ${tokenPharm}` }
      });
      assert.strictEqual(res.status, 200, `Status phải là 200 (Nhận: ${res.status})`);
    });

    // 6. Cross-Tenant IDOR: Dược sĩ Viện B gọi POST /verify đơn thuốc Viện A -> 404 Not Found (Bị chặn bởi Tenancy Plugin)
    await runHttpTest("6. Cross-Tenant HTTP: Dược sĩ Viện B gọi POST /verify đơn thuốc Viện A -> 404 Not Found", async () => {
      const res = await fetch(`${baseUrl}/api/drugs/prescriptions/${presHospitalA._id}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokenPharmB}`
        },
        body: JSON.stringify({ decision: "APPROVED", note: "Thử duyệt trái phép đơn viện khác" })
      });
      assert.strictEqual(res.status, 404, `Status phải là 404 Not Found do cách ly đa viện (Nhận: ${res.status})`);
      const body = await res.json();
      assert.strictEqual(body.message, "Không tìm thấy đơn thuốc.");
    });

    // 7. Negative Test: Bác sĩ ngoại trú kê đơn gán ACUTE_EMERGENCY -> 403 Forbidden
    await runHttpTest("7. HTTP Negative Test: Bác sĩ ngoại trú kê đơn gán ACUTE_EMERGENCY -> 403 Forbidden", async () => {
      const res = await fetch(`${baseUrl}/api/patients/${patient._id}/prescriptions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokenOutpatient}`
        },
        body: JSON.stringify({
          diagnosis: "Đau đầu dữ dội",
          overrideCategory: "ACUTE_EMERGENCY",
          overrideReason: "Cố tình lách quy định cấp cứu",
          drugs: [{ name: "Mannitol 20%", quantity: 2, unit: "Chai" }]
        })
      });
      assert.strictEqual(res.status, 403, `Status phải là 403 Forbidden do thiếu thẩm quyền cấp cứu (Nhận: ${res.status})`);
      const body = await res.json();
      assert.ok(body.message && body.message.includes("Thẩm quyền từ chối"), "Thông báo phải từ chối thẩm quyền cấp cứu");
    });

  } finally {
    server.close();
    try {
      if (testHospital?._id) {
        await User.deleteMany({ hospitalId: testHospital._id });
        await Prescription.deleteMany({ hospitalId: testHospital._id });
        await Hospital.findByIdAndDelete(testHospital._id);
      }
      if (hospitalB?._id) {
        await User.deleteMany({ hospitalId: hospitalB._id });
        await Hospital.findByIdAndDelete(hospitalB._id);
      }
    } catch (cleanErr) {
      console.warn("Lỗi dọn dẹp HTTP test:", cleanErr.message);
    }
    await mongoose.disconnect();
    console.log("Cleaned up HTTP test data and disconnected from DB.\n");
  }

  console.log("======================================================================");
  console.log(`   HTTP TEST SUMMARY: ${passed} PASSED / ${failed} FAILED`);
  console.log("======================================================================\n");

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("FATAL ERROR IN HTTP TEST:", err);
  process.exit(1);
});
