import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { ImagingResult } from "../modules/imaging/models/imagingResult.model.js";
import { Visit } from "../models/visit.model.js";
import { Invoice } from "../models/invoice.model.js";
import { User } from "../models/user.model.js";
import { MedicalRecord } from "../modules/emr/models/medicalRecord.model.js";
import { EmergencyAlert } from "../models/emergencyAlert.model.js";
import { MriRoom } from "../modules/hospital/models/mriRoom.model.js";
import { MriSlot } from "../modules/hospital/models/mriSlot.model.js";
import { StoredMedicalFile } from "../models/storedMedicalFile.model.js";
import { AuditLog } from "../models/auditLog.model.js";
import { signImagingReport } from "../controllers/clinicalView.controller.js";
import {
  createKtvImagingResult,
  acknowledgeImagingReport,
  addClinicalAddendum,
} from "../modules/imaging/imaging.controller.js";
import { submitMriSafetyCheckService } from "../services/visit.service.js";
import { approveVisitDebt } from "../controllers/visit.controller.js";
import {
  refundInvoice,
  requestInvoiceRefund,
  approveInvoiceRefund,
  clearInvoiceAmlHold,
} from "../modules/billing/invoice.controller.js";
import {
  createVerbalOrder,
  confirmVerbalOrderReadBack,
  countersignVerbalOrder,
} from "../controllers/emergency.controller.js";
import { releaseRoom } from "../modules/hospital/mriRoom.controller.js";
import { findExistingBySha256 } from "../services/storage/storageService.js";
import { writeLocalFile } from "../services/storage/localAdapter.js";
import { verifyAuditChainIntegrity } from "../services/auditLog.service.js";
import {
  resolveMriTeamFile,
  getInternalAiHeaders,
  backupAiModelSnapshotToStorage,
  deployAiRetrainedModel,
  getAiModels,
  rollbackAiModel,
} from "../modules/hospital/admin.controller.js";

// Fallback globals when executed directly via `node src/tests/mega_audit_v3_remediation.test.js`
const standaloneSuites = [];
let activeStandaloneSuite = null;
if (typeof global.describe !== "function") {
  global.describe = (name, fn) => {
    standaloneSuites.push({ name, fn, beforeAllFns: [], afterAllFns: [], tests: [] });
  };
  global.beforeAll = (fn) => activeStandaloneSuite && activeStandaloneSuite.beforeAllFns.push(fn);
  global.afterAll = (fn) => activeStandaloneSuite && activeStandaloneSuite.afterAllFns.push(fn);
  global.test = global.it = (name, fn) => activeStandaloneSuite && activeStandaloneSuite.tests.push({ name, fn });
  global.expect = (actual) => ({
    toBe: (expected) => {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toContain: (expected) => {
      if (!String(actual).includes(expected)) throw new Error(`Expected ${actual} to contain ${expected}`);
    },
    toBeDefined: () => {
      if (actual === undefined) throw new Error("Expected value to be defined");
    },
    toBeNull: () => {
      if (actual !== null) throw new Error(`Expected null, got ${JSON.stringify(actual)}`);
    },
    toBeTruthy: () => {
      if (!actual) throw new Error(`Expected truthy, got ${actual}`);
    },
    rejects: {
      toThrow: async (expectedMsg) => {
        let threw = false;
        let errObj = null;
        try {
          await actual;
        } catch (err) {
          threw = true;
          errObj = err;
        }
        if (!threw) throw new Error("Expected promise to reject, but resolved");
        if (expectedMsg && !String(errObj?.message || "").includes(expectedMsg)) {
          throw new Error(`Expected error to include "${expectedMsg}", got "${errObj?.message}"`);
        }
      },
    },
  });
}

describe("MEGA AUDIT v3.0 — 28-TC Remediation & Architectural Verification Suite", () => {
  let hospitalA;
  let hospitalB;
  let radiologist;
  let departmentHead;
  let doctor;
  let nurse;
  let technician;
  let receptionistA;
  let receptionistB;
  let hospitalAdmin;
  let systemAdmin;
  let cleaner;
  let patientUser;
  let emergencyEvent;
  let medicalRecord;
  let createdOrderId;
  let memServer = null;

  const createMockRes = () => {
    const res = {
      statusCode: 200,
      payload: null,
      data: null,
      message: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.payload = body;
        this.data = body?.data || body;
        this.message = body?.message;
        return this;
      },
    };
    return res;
  };

  const createBaseImaging = async () =>
    ImagingResult.create({
      hospitalId: hospitalA,
      medicalId: `BN-CLIN-${Date.now()}-${Math.random()}`,
      patientName: "Nguyễn Văn Kiểm Thử",
      birthYear: 1985,
      gender: "Nam",
      address: "Hà Nội",
      orderDate: new Date().toISOString(),
      orderingDoctor: doctor.profile.fullName,
      orderingDepartment: "Khoa Ngoại Thần Kinh",
      diagnosis: "Theo dõi u não vùng thái dương",
      procedure: "MRI Sọ Não 3.0T",
      findings: "Khối choán chỗ vùng thái dương phải 25x30mm",
      conclusion: "Theo dõi Glioma thái dương phải",
      radiologist: "Chờ ký",
      reportDate: new Date().toISOString(),
      imagingType: "MRI",
      isSigned: false,
    });

  const createVisitWithInvoice = async ({ visitOverrides = {}, invoiceOverrides = {} } = {}) => {
    const patientDoc = await User.create({
      hospitalId: hospitalA,
      email: `pt_gate_${Date.now()}_${Math.random()}@neuroscan.vn`,
      passwordHash: "hashed",
      role: "patient",
      profile: { name: "BN Cổng Viện Phí", fullName: "BN Cổng Viện Phí" },
    });

    const inv = await Invoice.create({
      hospitalId: hospitalA,
      patientId: patientDoc._id,
      totalAmount: 4_500_000,
      patientPayAmount: 4_500_000,
      status: "chờ thanh toán",
      items: [{ description: "Chụp MRI Sọ não", amount: 4_500_000, quantity: 1 }],
      ...invoiceOverrides,
    });

    const visit = await Visit.create({
      hospitalId: hospitalA,
      patientId: patientDoc._id,
      invoiceId: inv._id,
      priority: "trung bình",
      status: "chờ chụp",
      mriOrder: { isOrdered: true, withContrast: false },
      ...visitOverrides,
    });

    return { visit, inv };
  };

  const createPaidInvoice = async (amount) => {
    const pt = await User.create({
      hospitalId: hospitalA,
      email: `pt_ref_${Date.now()}_${Math.random()}@neuroscan.vn`,
      passwordHash: "hashed",
      role: "patient",
      profile: { name: "BN Hoàn Tiền", fullName: "BN Hoàn Tiền" },
    });
    return Invoice.create({
      hospitalId: hospitalA,
      patientId: pt._id,
      totalAmount: amount,
      patientPayAmount: amount,
      status: "đã thanh toán",
      items: [{ description: "Gói điều trị / Xạ phẫu Gamma Knife", amount, quantity: 1 }],
    });
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const mongoUri = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017/neuroscan_test_logic";
      try {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
      } catch {
        const { MongoMemoryServer } = await import("mongodb-memory-server");
        memServer = await MongoMemoryServer.create();
        await mongoose.connect(memServer.getUri());
      }
    }

    hospitalA = new mongoose.Types.ObjectId();
    hospitalB = new mongoose.Types.ObjectId();

    const makeActor = (role, name, hospId = hospitalA) => {
      const _id = new mongoose.Types.ObjectId();
      return {
        _id,
        id: _id.toString(),
        role,
        hospitalId: hospId ? hospId.toString() : null,
        email: `${role}_${_id.toString().slice(-5)}@neuroscan.vn`,
        profile: { name, fullName: name },
      };
    };

    radiologist = makeActor("radiologist", "BS. CĐHA Nguyễn Minh Quang");
    departmentHead = makeActor("department_head", "PGS.TS Trưởng khoa Trần Văn An");
    doctor = makeActor("doctor", "BS. Lâm sàng Lê Hoàng Nam");
    nurse = makeActor("nurse", "ĐD. Phạm Thị Mai");
    technician = makeActor("technician", "KTV. Vũ Đức Trọng");
    receptionistA = makeActor("receptionist", "Thu ngân A — Nguyễn Thu Hà");
    receptionistB = makeActor("receptionist", "Thu ngân B (Ca trưởng) — Đặng Lan Anh");
    hospitalAdmin = makeActor("hospital_admin", "Giám đốc BV — TS.BS Hoàng Quốc Việt");
    systemAdmin = makeActor("system_admin", "System Admin", null);
    cleaner = makeActor("cleaner", "Nhân viên Vệ sinh");
    patientUser = makeActor("patient", "Bệnh nhân Nguyễn Văn B", null);

    const ptEmg = await User.create({
      hospitalId: hospitalA,
      email: `pt_emg_${Date.now()}@neuroscan.vn`,
      passwordHash: "hashed",
      role: "patient",
      profile: { name: "BN Cấp Cứu Nội Viện", fullName: "BN Cấp Cứu Nội Viện" },
    });

    medicalRecord = await MedicalRecord.create({
      hospitalId: hospitalA,
      patientId: "BN-CODE-999", // Khác với ptEmg._id để kiểm chứng BUG-EMR-001 ($or userId)
      userId: ptEmg._id,
      patientName: "BN Cấp Cứu Nội Viện",
      age: 51,
      birthYear: 1975,
      gender: "Nam",
      doctorInCharge: doctor.profile.fullName,
      diagnosis: "Phù não cấp tính do u nguyên bào thần kinh đệm",
      status: "Đang điều trị",
    });

    emergencyEvent = await EmergencyAlert.create({
      hospitalId: hospitalA,
      patientId: ptEmg._id,
      medicalRecordId: medicalRecord._id,
      source: "inpatient_crisis",
      level: "RED",
      triggeredBy: "manual",
      triggeredByUserId: nurse._id,
      status: "acknowledged",
    });
  });

  afterAll(async () => {
    if (memServer) {
      await mongoose.disconnect();
      await memServer.stop();
    }
  });

  // ── TC-01 -> TC-06: Q-CLINICAL-01 & BUG-CLINICAL-001 ────────────────────────
  test("TC-01: [Q-CLINICAL-01] radiologist ký số báo cáo CĐHA lần đầu thành công (isSigned = true)", async () => {
    const baseImaging = await createBaseImaging();
    const req = {
      params: { imagingResultId: baseImaging._id.toString() },
      body: {
        conclusion: "Kết luận CĐHA chính thức: High-grade Glioma thái dương phải.",
        signatureType: "usb_token",
        certificateSerial: "VNPT-CA-998877",
      },
      user: radiologist,
    };
    const res = createMockRes();
    await signImagingReport(req, res);

    expect(res.statusCode).toBe(200);
    const updated = await ImagingResult.findById(baseImaging._id);
    expect(updated.isSigned).toBe(true);
    expect(String(updated.signedByDoctorId)).toBe(radiologist.id);
    expect(updated.conclusion).toContain("High-grade Glioma");
  });

  test("TC-02: [BUG-CLINICAL-001] Chặn ký đè (409 Conflict) khi báo cáo CĐHA đã ký số khóa sổ", async () => {
    const baseImaging = await createBaseImaging();
    baseImaging.isSigned = true;
    baseImaging.conclusion = "Kết luận gốc đã khóa sổ";
    await baseImaging.save();

    const req = {
      params: { imagingResultId: baseImaging._id.toString() },
      body: { conclusion: "Cố tình ghi đè kết luận gốc!" },
      user: radiologist,
    };
    const res = createMockRes();
    await signImagingReport(req, res);

    expect(res.statusCode).toBe(409);
    const reloaded = await ImagingResult.findById(baseImaging._id);
    expect(reloaded.conclusion).toBe("Kết luận gốc đã khóa sổ");
  });

  test("TC-03: [Q-CLINICAL-01] Bác sĩ lâm sàng (doctor) gọi API Acknowledge xác nhận đã đọc báo cáo CĐHA", async () => {
    const baseImaging = await createBaseImaging();
    const req = {
      params: { id: baseImaging._id.toString() },
      body: { clinicalNote: "Đã đối chiếu lâm sàng: Bệnh nhân có yếu nửa người trái tương ứng ổ tổn thương." },
      user: doctor,
    };
    const res = createMockRes();
    await acknowledgeImagingReport(req, res);

    expect(res.statusCode).toBe(200);
    const reloaded = await ImagingResult.findById(baseImaging._id);
    expect(String(reloaded.attendingAcknowledgment.acknowledgedBy)).toBe(doctor.id);
    expect(reloaded.attendingAcknowledgment.clinicalNote).toContain("yếu nửa người trái");
    expect(reloaded.isSigned).toBe(false);
  });

  test("TC-04: [Q-CLINICAL-01] Bác sĩ lâm sàng (doctor) thêm Phụ lục tương quan lâm sàng (clinical_correlation) mà không sửa kết luận gốc", async () => {
    const baseImaging = await createBaseImaging();
    baseImaging.isSigned = true;
    baseImaging.conclusion = "Kết luận CĐHA gốc: Meningioma liềm đại não";
    await baseImaging.save();

    const req = {
      params: { id: baseImaging._id.toString() },
      body: {
        content: "Hội chẩn lâm sàng: Đề nghị chụp thêm mạch não MRA để đánh giá xoang tĩnh mạch dọc trên trước mổ.",
        reason: "Bổ sung nhận định lâm sàng trước phẫu thuật",
      },
      user: doctor,
    };
    const res = createMockRes();
    await addClinicalAddendum(req, res);

    expect(res.statusCode).toBe(201);
    const reloaded = await ImagingResult.findById(baseImaging._id);
    expect(reloaded.conclusion).toBe("Kết luận CĐHA gốc: Meningioma liềm đại não");
    expect(reloaded.addenda.length).toBe(1);
    expect(reloaded.addenda[0].addendumType).toBe("clinical_correlation");
    expect(reloaded.addenda[0].authorRole).toBe("doctor");
  });

  test("TC-05: [Q-CLINICAL-01] Trưởng khoa (department_head) ký thay khi viện thiếu BS CĐHA kèm actingRadiologistReason", async () => {
    const baseImaging = await createBaseImaging();
    const req = {
      params: { imagingResultId: baseImaging._id.toString() },
      body: {
        conclusion: "Trưởng khoa ký duyệt kết quả MRI sọ não ca trực đêm.",
        actingRadiologistReason: "Bác sĩ CĐHA trực đang hội chẩn can thiệp mạch cấp cứu.",
      },
      user: departmentHead,
    };
    const res = createMockRes();
    await signImagingReport(req, res);

    expect(res.statusCode).toBe(200);
    const reloaded = await ImagingResult.findById(baseImaging._id);
    expect(reloaded.isSigned).toBe(true);
    expect(reloaded.actingRadiologistReason).toContain("hội chẩn can thiệp mạch");
  });

  test("TC-06: [Q-CLINICAL-01] Điều dưỡng (nurse) hoặc Lễ tân (receptionist) bị chặn 403 khi gọi API ký số hoặc tạo clinical addendum", async () => {
    const baseImaging = await createBaseImaging();
    const reqSign = {
      params: { imagingResultId: baseImaging._id.toString() },
      body: { conclusion: "Nurse cố ký" },
      user: nurse,
    };
    const resSign = createMockRes();
    await signImagingReport(reqSign, resSign);
    expect(resSign.statusCode).toBe(403);

    const reqAddendum = {
      params: { id: baseImaging._id.toString() },
      body: { content: "Receptionist cố thêm phụ lục lâm sàng" },
      user: receptionistA,
    };
    const resAddendum = createMockRes();
    await addClinicalAddendum(reqAddendum, resAddendum);
    expect(resAddendum.statusCode).toBe(403);
  });

  // ── TC-07 -> TC-14: Q-BILLING-01 & BUG-VISIT-001 ────────────────────────────
  test("TC-07: [Q-BILLING-01 / BUG-VISIT-001] Ngoại trú thường chưa đóng tiền bị chặn 402 kể cả khi truyền enforcePaymentGate = false", async () => {
    const { visit } = await createVisitWithInvoice();

    await expect(
      submitMriSafetyCheckService({
        visitId: visit._id,
        hospitalId: hospitalA,
        user: technician,
        checklistData: {
          hasPacemakerOrMetal: false,
          enforcePaymentGate: false,
        },
      })
    ).rejects.toThrow("CHẶN CỔNG VIỆN PHÍ");
  });

  test("TC-08: [Q-BILLING-01] Ca Cấp cứu (priority = 'khẩn cấp') chưa đóng tiền được miễn Cổng Viện phí + ghi AuditLog", async () => {
    const { visit } = await createVisitWithInvoice({
      visitOverrides: { priority: "khẩn cấp" },
    });

    const res = await submitMriSafetyCheckService({
      visitId: visit._id,
      hospitalId: hospitalA,
      user: technician,
      checklistData: { hasPacemakerOrMetal: false },
    });

    expect(res.visit.status).toBe("đang chụp");
  });

  test("TC-09: [Q-BILLING-01] Ca Nội trú / Hậu phẫu (status = 'chờ chụp sau phẫu thuật') được miễn Cổng Viện phí", async () => {
    const { visit } = await createVisitWithInvoice({
      visitOverrides: {
        status: "chờ chụp sau phẫu thuật",
        mriOrder: { isOrdered: true, withContrast: false, clinicalScenario: "post_op_72h" },
      },
    });

    const res = await submitMriSafetyCheckService({
      visitId: visit._id,
      hospitalId: hospitalA,
      user: technician,
      checklistData: { hasPacemakerOrMetal: false },
    });

    expect(res.visit.status).toBe("đang chụp");
  });

  test("TC-10: [Q-BILLING-01] Bệnh nhân BHYT 100% (coverageRate = 100) được miễn Cổng Viện phí", async () => {
    const { visit } = await createVisitWithInvoice({
      invoiceOverrides: {
        patientPayAmount: 0,
        bhytInfo: { coverageRate: 100, bhytAmount: 4_500_000 },
      },
    });

    const res = await submitMriSafetyCheckService({
      visitId: visit._id,
      hospitalId: hospitalA,
      user: technician,
      checklistData: { hasPacemakerOrMetal: false },
    });

    expect(res.visit.status).toBe("đang chụp");
  });

  test("TC-11: [Q-BILLING-01] Ban Giám đốc (hospital_admin) phê duyệt Bảo lãnh nợ (POST /:id/debt-approval) -> KTV cho vào chụp thành công", async () => {
    const { visit } = await createVisitWithInvoice();

    const reqApprove = {
      params: { id: visit._id.toString() },
      body: {
        reason: "Bệnh nhân chính sách chờ gia đình chuyển khoản viện phí trong 24h.",
        maxAmount: 5_000_000,
        expiresInHours: 24,
      },
      user: hospitalAdmin,
    };
    const resApprove = createMockRes();
    await approveVisitDebt(reqApprove, resApprove);
    expect(resApprove.statusCode).toBe(200);

    const resCheck = await submitMriSafetyCheckService({
      visitId: visit._id,
      hospitalId: hospitalA,
      user: technician,
      checklistData: { hasPacemakerOrMetal: false },
    });

    expect(resCheck.visit.status).toBe("đang chụp");
  });

  test("TC-12: [Q-BILLING-01] Bảo lãnh nợ đã quá hạn (expiresAt < Date.now()) -> Bị chặn 402 tại Cổng Viện phí", async () => {
    const { visit } = await createVisitWithInvoice({
      visitOverrides: {
        debtApproval: {
          isApproved: true,
          approvedBy: hospitalAdmin._id,
          approvedAt: new Date(Date.now() - 72 * 3600 * 1000),
          expiresAt: new Date(Date.now() - 1 * 3600 * 1000),
          reason: "Bảo lãnh nợ đã hết hạn",
        },
      },
    });

    await expect(
      submitMriSafetyCheckService({
        visitId: visit._id,
        hospitalId: hospitalA,
        user: technician,
        checklistData: { hasPacemakerOrMetal: false },
      })
    ).rejects.toThrow("CHẶN CỔNG VIỆN PHÍ");
  });

  test("TC-13: [Q-BILLING-01] Hóa đơn 'thanh toán một phần' có dư nợ còn lại 1.500.000 VNĐ (<= ngưỡng 2M VNĐ) -> Cho phép vào chụp", async () => {
    const { visit } = await createVisitWithInvoice({
      invoiceOverrides: {
        status: "thanh toán một phần",
        totalAmount: 4_500_000,
        patientPayAmount: 4_500_000,
        paidAmount: 3_000_000,
      },
    });

    const res = await submitMriSafetyCheckService({
      visitId: visit._id,
      hospitalId: hospitalA,
      user: technician,
      checklistData: { hasPacemakerOrMetal: false },
    });

    expect(res.visit.status).toBe("đang chụp");
  });

  test("TC-14: [Q-BILLING-01] Hóa đơn 'thanh toán một phần' còn nợ 8.000.000 VNĐ (> ngưỡng 2M VNĐ) -> Chặn 402", async () => {
    const { visit } = await createVisitWithInvoice({
      invoiceOverrides: {
        status: "thanh toán một phần",
        totalAmount: 10_000_000,
        patientPayAmount: 10_000_000,
        paidAmount: 2_000_000,
      },
    });

    await expect(
      submitMriSafetyCheckService({
        visitId: visit._id,
        hospitalId: hospitalA,
        user: technician,
        checklistData: { hasPacemakerOrMetal: false },
      })
    ).rejects.toThrow("CHẶN CỔNG VIỆN PHÍ");
  });

  // ── TC-15 -> TC-20: Q-BILLING-02 & BUG-BILLING-001 ──────────────────────────
  test("TC-15: [Q-BILLING-02 / BUG-BILLING-001] Thu ngân A gọi PUT /:id/refund khoản 15M kèm secondApproverId giả mạo -> Bị chặn 403 & chuyển sang pending_second_approval", async () => {
    const inv = await createPaidInvoice(15_000_000);

    const req = {
      params: { id: inv._id.toString() },
      body: {
        refundReason: "Khách hủy dịch vụ",
        secondApproverId: hospitalAdmin.id,
      },
      user: receptionistA,
    };
    const res = createMockRes();
    await refundInvoice(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.payload.approvalStatus).toBe("pending_second_approval");
    const reloaded = await Invoice.findById(inv._id);
    expect(reloaded.status).toBe("đã thanh toán");
    expect(reloaded.refundApproval.approvalStatus).toBe("pending_second_approval");
    expect(reloaded.refundApproval.secondApproverId).toBeNull();
  });

  test("TC-16: [Q-BILLING-02] Thu ngân A tạo yêu cầu hoàn tiền 15M -> Chính Thu ngân A cố gọi POST /:id/refund/approve -> Bị chặn 403 (Maker != Checker)", async () => {
    const inv = await createPaidInvoice(15_000_000);

    const resMaker = createMockRes();
    await requestInvoiceRefund(
      { params: { id: inv._id.toString() }, body: { refundReason: "Hoàn tiền 15M" }, user: receptionistA },
      resMaker
    );
    expect(resMaker.statusCode).toBe(202);

    const resSelfApprove = createMockRes();
    await approveInvoiceRefund(
      { params: { id: inv._id.toString() }, body: {}, user: receptionistA },
      resSelfApprove
    );
    expect(resSelfApprove.statusCode).toBe(403);
  });

  test("TC-17: [Q-BILLING-02] Khoản 15M (10M - <50M): Thu ngân A tạo yêu cầu -> Thu ngân B (Ca trưởng) gọi approve -> 200 OK hoàn tiền thành công", async () => {
    const inv = await createPaidInvoice(15_000_000);

    await requestInvoiceRefund(
      { params: { id: inv._id.toString() }, body: { refundReason: "Hoàn tiền 15M đúng quy trình" }, user: receptionistA },
      createMockRes()
    );

    const resChecker = createMockRes();
    await approveInvoiceRefund(
      { params: { id: inv._id.toString() }, body: {}, user: receptionistB },
      resChecker
    );

    expect(resChecker.statusCode).toBe(200);
    const updated = await Invoice.findById(inv._id);
    expect(updated.status).toBe("hoàn trả");
    expect(String(updated.refundApproval.firstApproverId)).toBe(receptionistA.id);
    expect(String(updated.refundApproval.secondApproverId)).toBe(receptionistB.id);
  });

  test("TC-18: [Q-BILLING-02] Khoản 60M (>= 50M): Thu ngân A tạo yêu cầu -> Thu ngân B cố gọi approve -> Bị chặn 403 (bắt buộc hospital_admin)", async () => {
    const inv = await createPaidInvoice(60_000_000);

    await requestInvoiceRefund(
      { params: { id: inv._id.toString() }, body: { refundReason: "Hoàn tiền gói phẫu thuật 60M" }, user: receptionistA },
      createMockRes()
    );

    const resCheckerB = createMockRes();
    await approveInvoiceRefund(
      { params: { id: inv._id.toString() }, body: {}, user: receptionistB },
      resCheckerB
    );

    expect(resCheckerB.statusCode).toBe(403);
    const reloaded = await Invoice.findById(inv._id);
    expect(reloaded.status).toBe("đã thanh toán");
  });

  test("TC-19: [Q-BILLING-02] Khoản 60M (>= 50M): Thu ngân A tạo yêu cầu -> Giám đốc BV (hospital_admin) gọi approve -> 200 OK hoàn tiền thành công", async () => {
    const inv = await createPaidInvoice(60_000_000);

    await requestInvoiceRefund(
      { params: { id: inv._id.toString() }, body: { refundReason: "Hoàn tiền gói phẫu thuật 60M" }, user: receptionistA },
      createMockRes()
    );

    const resAdminApprove = createMockRes();
    await approveInvoiceRefund(
      { params: { id: inv._id.toString() }, body: {}, user: hospitalAdmin },
      resAdminApprove
    );

    expect(resAdminApprove.statusCode).toBe(200);
    const updated = await Invoice.findById(inv._id);
    expect(updated.status).toBe("hoàn trả");
  });

  test("TC-20: [Q-BILLING-02] Khoản 350M (>= 300M AML STR): Tự động bật amlReport.isFlagged = true, chặn hoàn tất cho tới khi giải tỏa AML (/aml-clearance)", async () => {
    const inv = await createPaidInvoice(350_000_000);

    const resReq = createMockRes();
    await requestInvoiceRefund(
      { params: { id: inv._id.toString() }, body: { refundReason: "Hoàn trả gói Proton Therapy 350M" }, user: receptionistA },
      resReq
    );
    expect(resReq.statusCode).toBe(202);
    expect(resReq.payload.amlFlagged).toBe(true);

    const resBeforeClear = createMockRes();
    await approveInvoiceRefund(
      { params: { id: inv._id.toString() }, body: {}, user: hospitalAdmin },
      resBeforeClear
    );
    expect(resBeforeClear.statusCode).toBe(403);
    expect(resBeforeClear.payload.code).toBe("AML_HOLD_REQUIRED");

    const resClear = createMockRes();
    await clearInvoiceAmlHold(
      { params: { id: inv._id.toString() }, body: { strReportId: "STR-NHNN-2026-001" }, user: systemAdmin },
      resClear
    );
    expect(resClear.statusCode).toBe(200);

    const resAfterClear = createMockRes();
    await approveInvoiceRefund(
      { params: { id: inv._id.toString() }, body: {}, user: hospitalAdmin },
      resAfterClear
    );
    expect(resAfterClear.statusCode).toBe(200);
    const finalInv = await Invoice.findById(inv._id);
    expect(finalInv.status).toBe("hoàn trả");
    expect(finalInv.amlReport.reportedToAuthority).toBe(true);
  });

  // ── TC-21 -> TC-26: Q-EMG-01 & BUG-EMG-001 ──────────────────────────────────
  test("TC-21: [BUG-EMG-001] cleaner hoặc receptionist gọi POST /api/v1/emergency/verbal-order bị chặn 403 Forbidden", async () => {
    const resCleaner = createMockRes();
    await createVerbalOrder(
      {
        body: {
          emergencyEventId: emergencyEvent._id.toString(),
          orderText: "Tiêm Fentanyl 0.1mg IV",
        },
        user: cleaner,
      },
      resCleaner
    );
    expect(resCleaner.statusCode).toBe(403);
  });

  test("TC-22: [Q-EMG-01] Bác sĩ (doctor) tạo y lệnh miệng chỉ định Điều dưỡng nhận lệnh -> 201 Created, status = 'pending_readback', isReadBackConfirmed = false", async () => {
    const res = createMockRes();
    await createVerbalOrder(
      {
        body: {
          emergencyEventId: emergencyEvent._id.toString(),
          orderText: "Tiêm tĩnh mạch chậm Fentanyl 0.05mg + Mannitol 20% 250ml truyền nhanh",
          isControlledSubstance: true,
          nurseReceivedId: nurse.id,
          nurseReceivedName: nurse.profile.fullName,
          requireReadBack: true,
        },
        user: doctor,
      },
      res
    );

    expect(res.statusCode).toBe(201);
    expect(res.data.verbalOrder.status).toBe("pending_readback");
    expect(res.data.verbalOrder.isReadBackConfirmed).toBe(false);
    createdOrderId = res.data.verbalOrder._id.toString();
  });

  test("TC-23: [Q-EMG-01] Chính bác sĩ vừa tạo y lệnh cố gọi /readback-confirm thay cho điều dưỡng -> Bị chặn 403 Forbidden", async () => {
    const res = createMockRes();
    await confirmVerbalOrderReadBack(
      {
        params: { orderId: createdOrderId },
        body: {},
        user: doctor,
      },
      res
    );
    expect(res.statusCode).toBe(403);
  });

  test("TC-24: [Q-EMG-01] Điều dưỡng (nurse) nhận lệnh gọi POST /verbal-order/:orderId/readback-confirm -> 200 OK, isReadBackConfirmed = true, status = 'pending_countersign'", async () => {
    const res = createMockRes();
    await confirmVerbalOrderReadBack(
      {
        params: { orderId: createdOrderId },
        body: {},
        user: nurse,
      },
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.data.verbalOrder.isReadBackConfirmed).toBe(true);
    expect(res.data.verbalOrder.status).toBe("pending_countersign");
    expect(String(res.data.verbalOrder.readBackConfirmedBy)).toBe(nurse.id);
  });

  test("TC-25: [Q-EMG-01] Bác sĩ gọi /countersign cho thuốc gây nghiện/hướng thần (isControlledSubstance = true) nhưng thiếu witnessUserId -> Bị chặn 400 Bad Request", async () => {
    const res = createMockRes();
    await countersignVerbalOrder(
      {
        params: { orderId: createdOrderId },
        body: { notes: "Ký bổ sung nhưng quên người chứng kiến" },
        user: doctor,
      },
      res
    );
    expect(res.statusCode).toBe(400);
  });

  test("TC-26: [Q-EMG-01] Bác sĩ gọi /countersign kèm witnessUserId hợp lệ -> 200 OK, status = 'countersigned' & sinh chữ ký SHA-256", async () => {
    const res = createMockRes();
    await countersignVerbalOrder(
      {
        params: { orderId: createdOrderId },
        body: {
          witnessUserId: departmentHead.id,
          witnessUserName: departmentHead.profile.fullName,
          notes: "Đã ký số bổ sung y lệnh miệng thuốc hướng thần theo TT 20/2017/TT-BYT",
        },
        user: doctor,
      },
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.data.verbalOrder.status).toBe("countersigned");
    expect(res.data.verbalOrder.signatureHash.length).toBe(64);
    expect(String(res.data.verbalOrder.witnessUserId)).toBe(departmentHead.id);
  });

  // ── TC-27 -> TC-28: BUG-IMG-001, BUG-MRI-001, BUG-STORAGE-001, BUG-AUDIT-001 ─
  test("TC-27: [BUG-IMG-001 & BUG-MRI-001] Tài khoản patient gọi createKtvImagingResult hoặc releaseRoom đều bị chặn 403 Forbidden", async () => {
    const resImg = createMockRes();
    await createKtvImagingResult(
      {
        body: { patientName: "Fake", conclusion: "Fake" },
        user: patientUser,
      },
      resImg
    );
    expect(resImg.statusCode).toBe(403);

    const room = await MriRoom.create({
      hospitalId: hospitalA,
      name: "Phòng MRI 3.0T Số 1",
      modelMachine: "Siemens MAGNETOM Vida 3T",
      status: "active",
    });
    const slot = await MriSlot.create({
      hospitalId: hospitalA,
      roomId: room._id,
      date: "2026-11-05",
      startTime: new Date("2026-11-05T08:00:00Z"),
      endTime: new Date("2026-11-05T08:45:00Z"),
      status: "in_progress",
    });

    const resRelease = createMockRes();
    await releaseRoom(
      {
        params: { slotId: slot._id.toString() },
        body: {},
        user: patientUser,
      },
      resRelease
    );
    expect(resRelease.statusCode).toBe(403);
  });

  test("TC-28: [BUG-STORAGE-001 & BUG-AUDIT-001] Cô lập SHA-256 Deduplication liên viện & Phát hiện giả mạo chuỗi băm AuditLog", async () => {
    const sharedSha256 = "a".repeat(64);
    const logicalSubPath = `pacs/2026/11/mri_hospital_A_${Date.now()}.dcm`;
    const { localPath: realLocalPath } = await writeLocalFile(
      logicalSubPath,
      Buffer.from("DICOM_TEST_PAYLOAD")
    );
    await StoredMedicalFile.create({
      hospitalId: hospitalA,
      fileId: `FILE-DEDUP-${Date.now()}`,
      fileName: "mri_hospital_A.dcm",
      logicalPath: logicalSubPath,
      localPath: realLocalPath,
      mimeType: "application/dicom",
      sizeBytes: 18,
      sha256: sharedSha256,
      category: "pacs",
      uploadedBy: technician._id,
    });

    const foundInHospA = await findExistingBySha256(sharedSha256, {
      hospitalId: hospitalA,
      strictTenantIsolation: true,
    });
    expect(foundInHospA !== null).toBe(true);

    const foundInHospB = await findExistingBySha256(sharedSha256, {
      hospitalId: hospitalB,
      strictTenantIsolation: true,
    });
    expect(foundInHospB).toBeNull();

    const latestLog = await AuditLog.findOne({ hospitalId: hospitalA }).sort({ sequenceNumber: -1 });
    expect(latestLog !== null).toBe(true);

    await AuditLog.updateOne(
      { _id: latestLog._id },
      { $set: { details: "Kẻ tấn công sửa DB trực tiếp" } }
    );

    const integrityAfterTamper = await verifyAuditChainIntegrity(hospitalA);
    expect(integrityAfterTamper.isValid).toBe(false);
    expect(integrityAfterTamper.reason).toContain("Bản ghi đã bị chỉnh sửa nội dung trái phép");

    await AuditLog.deleteOne({ _id: latestLog._id });
  });

  // ── TC-29 -> TC-30: MLOps Retraining Backup, Old-vs-New Comparison & Rollback ─
  test("TC-29: [BUG-MLOPS-002, BUG-MLOPS-003 & BUG-MLOPS-004] Sao lưu MLOps Snapshot vào Hybrid Storage + Model Registry + Internal API Key Header", async () => {
    const resolvedFeedbackPath = resolveMriTeamFile("hard_examples/feedback_log.csv");
    expect(resolvedFeedbackPath.replace(/\\/g, "/")).toContain("MRIteam_team5/MRIteam/hard_examples/feedback_log.csv");

    process.env.INTERNAL_AI_API_KEY = "test-internal-mlops-secret";
    const headers = getInternalAiHeaders({ "Content-Type": "application/json" });
    expect(headers["X-Internal-Api-Key"]).toBe("test-internal-mlops-secret");

    const snapshotBackup = await backupAiModelSnapshotToStorage({
      eventType: "deploy_test",
      snapshot: {
        old_model: { path: "models/resnet_risk_calibrated.keras", accuracy: 94.0, macro_f1: 93.8, glioma_recall: 96.0 },
        new_model: { path: "models/versions/resnet_active_20261104.keras", accuracy: 95.5, macro_f1: 95.2, glioma_recall: 96.5 },
        checkpoint_backup_path: "models/checkpoints/resnet_baseline_backup_20261104.keras",
      },
      user: hospitalAdmin,
    });
    expect(snapshotBackup.backedUp).toBe(true);
    expect(snapshotBackup.backupFileId !== null).toBe(true);
    expect(snapshotBackup.backupSha256.length).toBe(64);
  });

  test("TC-30: [BUG-MLOPS-001 & BUG-MLOPS-005] Clinical Quality Gate chặn Deploy khi mô hình mới suy giảm & Cho phép Rollback về phiên bản cũ kèm AuditLog", async () => {
    const retrainResPath = resolveMriTeamFile("hard_examples/retrain_result.json");
    const regPath = resolveMriTeamFile("models/model_registry.json");
    const prevRetrainRes = fs.existsSync(retrainResPath) ? fs.readFileSync(retrainResPath, "utf8") : null;
    const prevRegistry = fs.existsSync(regPath) ? fs.readFileSync(regPath, "utf8") : null;

    try {
      fs.mkdirSync(path.dirname(retrainResPath), { recursive: true });
      fs.mkdirSync(path.dirname(regPath), { recursive: true });

      // Giả lập mô hình mới bị suy giảm Glioma Recall (96.0% -> 88.0%) => gate_passed = false
      const failedGateResult = {
        status: "COMPLETED",
        version_id: "v_20261104_regression",
        samples_trained: 12,
        base_model_path: "models/resnet_risk_calibrated.keras",
        candidate_model_path: "models/versions/resnet_active_20261104_regression.keras",
        checkpoint_backup_path: "models/checkpoints/resnet_baseline_backup_20261104.keras",
        baseline_accuracy: 95.0,
        retrained_accuracy: 91.0,
        accuracy_diff: "-4.0%",
        baseline_macro_f1: 94.8,
        retrained_macro_f1: 90.2,
        baseline_glioma_recall: 96.0,
        retrained_glioma_recall: 88.0,
        gate_passed: false,
        comparison: {
          old_model: { accuracy: 95.0, macro_f1: 94.8, per_class_recall: { glioma: 96.0 } },
          new_model: { accuracy: 91.0, macro_f1: 90.2, per_class_recall: { glioma: 88.0 } },
        },
      };
      fs.writeFileSync(retrainResPath, JSON.stringify(failedGateResult, null, 2), "utf8");

      const mockRegistry = {
        active_model: "models/resnet_risk_calibrated.keras",
        baseline_model: "models/resnet_risk_calibrated.keras",
        versions: [
          {
            version_id: "v_20261104_regression",
            status: "gate_failed",
            candidate_model_path: "models/versions/resnet_active_20261104_regression.keras",
            checkpoint_backup_path: "models/checkpoints/resnet_baseline_backup_20261104.keras",
            baseline_accuracy: 95.0,
            retrained_accuracy: 91.0,
            baseline_macro_f1: 94.8,
            retrained_macro_f1: 90.2,
            baseline_glioma_recall: 96.0,
            retrained_glioma_recall: 88.0,
            gate_passed: false,
            comparison: failedGateResult.comparison,
          },
        ],
      };
      fs.writeFileSync(regPath, JSON.stringify(mockRegistry, null, 2), "utf8");

      // 1. Deploy phải bị chặn 400 MLOPS_QUALITY_GATE_FAILED
      const deployRes = createMockRes();
      await deployAiRetrainedModel({ body: {}, query: {}, user: hospitalAdmin }, deployRes);
      expect(deployRes.statusCode).toBe(400);
      expect(deployRes.data.code).toBe("MLOPS_QUALITY_GATE_FAILED");

      // 2. getAiModels đọc đúng từ model_registry.json kèm bảng comparison
      const modelsRes = createMockRes();
      await getAiModels({ user: hospitalAdmin }, modelsRes);
      expect(modelsRes.statusCode).toBe(200);
      expect(modelsRes.data.source).toBe("model_registry");
      expect(modelsRes.data.versions[0].version).toBe("v_20261104_regression");
      expect(modelsRes.data.versions[0].gatePassed).toBe(false);

      // 3. Rollback về bản checkpoint cũ hoạt động + tạo backup + AuditLog
      const rbRes = createMockRes();
      await rollbackAiModel(
        {
          body: { version: "models/checkpoints/resnet_baseline_backup_20261104.keras" },
          user: hospitalAdmin,
        },
        rbRes
      );
      expect(rbRes.statusCode).toBe(200);
      expect(rbRes.data.backup.backedUp).toBe(true);
    } finally {
      if (prevRetrainRes !== null) fs.writeFileSync(retrainResPath, prevRetrainRes, "utf8");
      else if (fs.existsSync(retrainResPath)) fs.unlinkSync(retrainResPath);

      if (prevRegistry !== null) fs.writeFileSync(regPath, prevRegistry, "utf8");
      else if (fs.existsSync(regPath)) fs.unlinkSync(regPath);
    }
  });
});

// Standalone execution support
const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("mega_audit_v3_remediation.test.js") ||
    process.argv[1].endsWith("mega_audit_v3_remediation.test"));
if (isMain && standaloneSuites.length > 0) {
  (async () => {
    let passed = 0;
    let failed = 0;
    for (const s of standaloneSuites) {
      activeStandaloneSuite = s;
      console.log(`\nRUNNING SUITE: ${s.name}`);
      await s.fn();
      for (const b of s.beforeAllFns) await b();
      for (const t of s.tests) {
        try {
          await t.fn();
          passed++;
          console.log(`  ✔ PASS ${t.name}`);
        } catch (err) {
          failed++;
          console.error(`  ✖ FAIL ${t.name}: ${err.message}`);
        }
      }
      for (const a of s.afterAllFns) await a();
    }
    console.log(`\nResult: ${passed}/${passed + failed} passed`);
    process.exit(failed > 0 ? 1 : 0);
  })();
}
