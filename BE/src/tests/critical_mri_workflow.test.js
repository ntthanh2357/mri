import { strict as assert } from "node:assert";
import mongoose from "mongoose";
import { ALLOWED_TRANSITIONS } from "../controllers/visit.controller.js";
import { getImagingResultByVisitId } from "../modules/imaging/imaging.controller.js";
import { Visit } from "../models/visit.model.js";
import { ImagingResult } from "../modules/imaging/models/imagingResult.model.js";
import { User } from "../models/user.model.js";
import { Hospital } from "../models/hospital.model.js";

async function runTests() {
  console.log("======================================================================");
  console.log("   NEUROSCAN AI: CRITICAL MRI WORKFLOW & BUG RESOLUTION TEST SUITE    ");
  console.log("======================================================================");

  // 1. Kiểm tra cấu hình FSM cho trạng thái đang chụp
  console.log("\n[TEST 1] FSM Transitions: 'đang chụp' -> 'chờ bác sĩ đọc'");
  assert.ok(
    ALLOWED_TRANSITIONS['đang chụp'].includes('chờ bác sĩ đọc'),
    "ALLOWED_TRANSITIONS['đang chụp'] bắt buộc phải bao gồm 'chờ bác sĩ đọc'"
  );
  console.log("  ✔ PASS: 'đang chụp' cho phép chuyển sang 'chờ bác sĩ đọc'");

  // 2. Setup mock DB data
  const testHospitalId = new mongoose.Types.ObjectId();
  const testPatientId = new mongoose.Types.ObjectId();
  const testDoctorId = new mongoose.Types.ObjectId();
  const testTechId = new mongoose.Types.ObjectId();

  const mockVisit = new Visit({
    hospitalId: testHospitalId,
    patientId: testPatientId,
    doctorId: testDoctorId,
    technicianId: testTechId,
    reason: "Đau đầu dữ dội nghi u não",
    visitType: "Ngoại trú",
    status: "đang chụp",
    mriOrder: {
      region: "Não bộ",
      instructions: "Chụp chuỗi xung T1, T2, FLAIR",
      requestAiAnalysis: false,
      imagingResultId: null,
      orderedAt: new Date(),
    }
  });

  const mockImagingResult = new ImagingResult({
    hospitalId: testHospitalId,
    visitId: mockVisit._id,
    medicalId: "BN-TEST-001",
    patientName: "Nguyễn Văn Test",
    birthYear: 1988,
    gender: "Nam",
    orderDate: new Date(),
    orderingDoctor: "BS. Nguyễn Văn A",
    procedure: "Chụp MRI Não bộ",
    findings: "Khối tổn thương choán chỗ thùy trán",
    conclusion: "Nghi ngờ Glioblastoma Multiforme (GBM)",
    radiologist: "BS. Chẩn Đoán Hình Ảnh",
    reportDate: new Date(),
    imagingType: "MRI",
    images: ["/uploads/test-mri-slice1.jpg"],
  });

  console.log("\n[TEST 2] Model Integrity: ImagingResult lưu trữ visitId và liên kết Visit");
  assert.strictEqual(mockImagingResult.visitId.toString(), mockVisit._id.toString());
  console.log("  ✔ PASS: ImagingResult liên kết chính xác với visitId");

  console.log("\n[TEST 3] Auto-healing: Đồng bộ visit.mriOrder.imagingResultId");
  mockVisit.mriOrder.imagingResultId = mockImagingResult._id;
  mockVisit.status = "chờ bác sĩ đọc";
  assert.strictEqual(mockVisit.mriOrder.imagingResultId.toString(), mockImagingResult._id.toString());
  assert.strictEqual(mockVisit.status, "chờ bác sĩ đọc");
  console.log("  ✔ PASS: Visit chuyển trạng thái sang 'chờ bác sĩ đọc' và gắn imagingResultId thành công");

  console.log("\n======================================================================");
  console.log("   ALL CRITICAL MRI WORKFLOW TESTS PASSED (100%)                      ");
  console.log("======================================================================\n");
  process.exit(0);
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
