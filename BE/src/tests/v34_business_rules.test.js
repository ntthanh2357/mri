// Kiểm tra các quyết định nghiệp vụ v3.4 (Q-V4-01 → Q-V4-11) và các lỗi P0 của đợt audit v4.0.
// Mọi test dựa trên dữ liệu đọc lại từ DB, không tin vào response.
import mongoose from "mongoose";
import { Visit } from "../models/visit.model.js";
import { Invoice } from "../models/invoice.model.js";
import { User } from "../models/user.model.js";
import { Hospital } from "../models/hospital.model.js";
import { AuditLog } from "../models/auditLog.model.js";
import { MedicalRecord } from "../modules/emr/models/medicalRecord.model.js";
import { EmergencyAlert } from "../models/emergencyAlert.model.js";
import { ImagingResult } from "../modules/imaging/models/imagingResult.model.js";
import { shouldEnforcePaymentGate, isInpatientVisitType } from "../services/visit.service.js";
import { updateStatus, approveVisitDebt } from "../controllers/visit.controller.js";
import {
  refundInvoice,
  requestInvoiceRefund,
  approveInvoiceRefund,
  rejectInvoiceRefund,
  reviewLargeRefund,
} from "../modules/billing/invoice.controller.js";
import {
  createVerbalOrder,
  confirmVerbalOrderReadBack,
  confirmVerbalOrderOtp,
  countersignVerbalOrder,
  rejectVerbalOrder,
  getActiveAlerts,
} from "../controllers/emergency.controller.js";
import { runVerbalOrderEscalationJob } from "../services/verbalOrderEscalation.service.js";
import { signImagingReport } from "../controllers/clinicalView.controller.js";
import {
  updateImagingResult,
  acknowledgeImagingReport,
  addImagingAddendum,
  addClinicalAddendum,
  getResultById,
  getPatientResults,
} from "../modules/imaging/imaging.controller.js";
import { tenantStorage } from "../middlewares/tenant.middleware.js";
import { handleEmergencyOverride } from "../modules/hospital/mriRoom.controller.js";
import { verifyOtp, phoneLoginVerify, forgotPassword, requestStepUpOtp, verifyStepUpOtp } from "../modules/auth/auth.controller.js";
import { createRateLimiter } from "../middlewares/rateLimiter.middleware.js";
import invoiceRoutes from "../modules/billing/invoice.routes.js";
import emergencyRoutes from "../routes/emergency.routes.js";
import imagingRoutes from "../modules/imaging/imaging.routes.js";
import visitRoutes from "../routes/visit.routes.js";
import mriRoomRoutes from "../modules/hospital/mriRoom.routes.js";
import dicomRoutes from "../modules/imaging/dicom.routes.js";
import aiPipelineRoutes from "../modules/imaging/aiPipeline.routes.js";

const oid = () => new mongoose.Types.ObjectId();

const makeRes = () => ({
  statusCode: 200,
  payload: null,
  data: null,
  headers: {},
  setHeader(name, value) { this.headers[name] = value; },
  status(code) { this.statusCode = code; return this; },
  json(body) { this.payload = body; this.data = body?.data ?? body; return this; },
});

const call = async (handler, req) => {
  const res = makeRes();
  await handler({ params: {}, body: {}, query: {}, headers: {}, ...req }, res);
  return res;
};

// Chạy các middleware phân quyền của route (bỏ protect) với vai trò cho trước
const routeAllows = (router, method, path, role) => {
  const handlers = [];
  let found = false;
  for (const layer of router.stack) {
    if (!layer.route) {
      handlers.push(layer.handle); // middleware cấp router chỉ áp cho route khai báo sau nó
    } else if (layer.route.path === path && layer.route.methods[method]) {
      handlers.push(...layer.route.stack.map((s) => s.handle));
      found = true;
      break;
    }
  }
  if (!found) throw new Error(`Không có route ${method} ${path}`);
  let blocked = false;
  const res = { status() { blocked = true; return this; }, json() { return this; } };
  for (const handle of handlers) {
    if (!/allowedRoles/.test(handle.toString())) continue;
    handle({ user: { role } }, res, () => {});
    if (blocked) return false;
  }
  return true;
};

describe("v3.4 Quy tắc nghiệp vụ sau rà soát", () => {
  let hospitalId;
  const actors = {};

  const makeActor = async (key, role, extra = {}) => {
    const _id = oid();
    const profile = { name: `${role} ${key}`, fullName: `${role} ${key}` };
    await User.create({
      _id,
      hospitalId: extra.hospitalId === null ? null : (extra.hospitalId || hospitalId),
      email: `v34_${key}_${_id}@neuroscan.vn`,
      passwordHash: "hashed",
      role,
      profile,
      canSignImaging: extra.canSignImaging === true,
      stepUpVerifiedAt: extra.stepUp ? new Date() : null,
    });
    actors[key] = { _id, id: String(_id), role, hospitalId: String(extra.hospitalId || hospitalId), profile, email: `v34_${key}_${_id}@neuroscan.vn` };
    return actors[key];
  };

  const makeInvoice = async (amount, overrides = {}) => {
    const patient = await User.create({
      hospitalId,
      email: `v34_pt_${oid()}@neuroscan.vn`,
      passwordHash: "hashed",
      role: "patient",
      profile: { name: "BN Kiểm Thử", fullName: "BN Kiểm Thử" },
    });
    return Invoice.create({
      hospitalId,
      patientId: patient._id,
      totalAmount: amount,
      patientPayAmount: amount,
      status: "đã thanh toán",
      items: [
        { description: "Dịch vụ A", amount: amount / 2, quantity: 1 },
        { description: "Dịch vụ B", amount: amount / 2, quantity: 1 },
      ],
      ...overrides,
    });
  };

  const makeVisit = async ({ invoice = {}, visit = {} } = {}) => {
    const inv = await makeInvoice(4_500_000, { status: "chờ thanh toán", ...invoice });
    const created = await Visit.create({
      hospitalId,
      patientId: inv.patientId,
      invoiceId: inv._id,
      priority: "trung bình",
      status: "chờ chụp",
      mriOrder: { withContrast: false, orderedAt: new Date() },
      ...visit,
    });
    return { visit: created, invoice: inv };
  };

  const passedChecklist = { isScreened: true, passed: true, screenedAt: new Date() };

  const makeEvent = async (status = "acknowledged") => {
    const patient = await User.create({
      hospitalId,
      email: `v34_emg_${oid()}@neuroscan.vn`,
      passwordHash: "hashed",
      role: "patient",
      profile: { name: "BN Cấp Cứu", fullName: "BN Cấp Cứu" },
    });
    const record = await MedicalRecord.create({
      hospitalId,
      patientId: `BN-${oid()}`,
      userId: patient._id,
      patientName: "BN Cấp Cứu",
      age: 50,
      birthYear: 1976,
      gender: "Nam",
      doctorInCharge: "BS",
      diagnosis: "Phù não",
      status: "Đang điều trị",
    });
    const event = await EmergencyAlert.create({
      hospitalId,
      patientId: patient._id,
      medicalRecordId: record._id,
      source: "inpatient_crisis",
      level: "RED",
      triggeredBy: "manual",
      triggeredByUserId: actors.nurse._id,
      status,
    });
    return { event, record };
  };

  const makeOrder = async (overrides = {}) => {
    const { event, record } = await makeEvent();
    const res = await call(createVerbalOrder, {
      user: actors.doctor,
      body: { emergencyEventId: String(event._id), orderText: "Mannitol 20% 250ml truyền nhanh", nurseReceivedId: actors.nurse.id, ...overrides },
    });
    expect(res.statusCode).toBe(201);
    return { orderId: String(res.data.verbalOrder._id), recordId: record._id, res };
  };

  const loadOrder = async (recordId, orderId) => {
    const record = await MedicalRecord.findById(recordId).select("+verbalOrders.readBackOtpHash");
    return record.verbalOrders.id(orderId);
  };

  const makeImaging = async (overrides = {}) =>
    ImagingResult.create({
      hospitalId,
      medicalId: `BN-${oid()}`,
      patientName: "BN CĐHA",
      birthYear: 1985,
      gender: "Nam",
      address: "Hà Nội",
      orderDate: new Date().toISOString(),
      orderingDoctor: "BS",
      orderingDepartment: "Khoa",
      diagnosis: "Theo dõi",
      procedure: "MRI Sọ Não",
      findings: "Mô tả",
      conclusion: "Chờ bác sĩ đọc",
      radiologist: "Chờ ký",
      reportDate: new Date().toISOString(),
      imagingType: "MRI",
      isSigned: false,
      ...overrides,
    });

  const auditCount = (action, targetId) => AuditLog.countDocuments({ action, entityId: String(targetId) });

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.TEST_MONGO_URI);
    }
    const hospital = await Hospital.create({ name: "BV Kiểm Thử v3.4", code: `V34-${oid()}` });
    hospitalId = hospital._id;
    await makeActor("doctor", "doctor");
    await makeActor("doctor2", "doctor");
    await makeActor("nurse", "nurse");
    await makeActor("nurse2", "nurse");
    await makeActor("technician", "technician");
    await makeActor("radiologist", "radiologist");
    await makeActor("radiologist2", "radiologist");
    await makeActor("head", "department_head", { canSignImaging: true });
    await makeActor("headNoGrant", "department_head");
    await makeActor("pharmacist", "pharmacist");
    await makeActor("cleaner", "cleaner");
    await makeActor("receptionistA", "receptionist", { stepUp: true });
    await makeActor("receptionistB", "receptionist", { stepUp: true });
    await makeActor("adminA", "hospital_admin", { stepUp: true });
    await makeActor("adminB", "hospital_admin", { stepUp: true });
    await makeActor("adminNoMfa", "hospital_admin");
  });

  // ── Cổng viện phí ────────────────────────────────────────────────────────────────────────
  test("Q-V4-05: hóa đơn 'đang xử lý' được qua; 'hoàn trả', 'hủy' bị chặn với lý do riêng", () => {
    const visit = { priority: "trung bình", status: "chờ chụp", mriOrder: {} };
    const inv = (status) => ({ status, totalAmount: 1000, patientPayAmount: 1000 });
    expect(shouldEnforcePaymentGate(visit, inv("đang xử lý")).enforce).toBe(false);
    expect(shouldEnforcePaymentGate(visit, inv("hoàn trả")).reason).toBe("INVOICE_VOIDED");
    expect(shouldEnforcePaymentGate(visit, inv("hủy")).reason).toBe("INVOICE_VOIDED");
    expect(shouldEnforcePaymentGate(visit, { ...inv("hoàn trả"), patientPayAmount: 0 }).enforce).toBe(true);
  });

  test("FI-15: mọi cách ghi Nội trú đang có trong dữ liệu đều được nhận", () => {
    for (const value of ["Nội trú", "nội trú", "inpatient", "noi_tru"]) expect(isInpatientVisitType(value)).toBe(true);
    expect(isInpatientVisitType("Ngoại trú")).toBe(false);
  });

  test("FI-13: bảo lãnh chỉ có tác dụng trong hạn mức và phải có hạn dùng", async () => {
    const visit = { priority: "trung bình", status: "chờ chụp", mriOrder: {} };
    const inv = { status: "chờ thanh toán", totalAmount: 4_500_000, patientPayAmount: 4_500_000 };
    const future = new Date(Date.now() + 3600 * 1000);
    expect(shouldEnforcePaymentGate({ ...visit, debtApproval: { isApproved: true, expiresAt: future, maxAmount: 1_000_000 } }, inv).enforce).toBe(true);
    expect(shouldEnforcePaymentGate({ ...visit, debtApproval: { isApproved: true, expiresAt: future, maxAmount: 5_000_000 } }, inv).enforce).toBe(false);
    expect(shouldEnforcePaymentGate({ ...visit, debtApproval: { isApproved: true, maxAmount: 5_000_000 } }, inv).enforce).toBe(true);

    const { visit: created } = await makeVisit();
    const body = { reason: "Bệnh nhân chính sách chờ chuyển khoản" };
    expect((await call(approveVisitDebt, { user: actors.adminA, params: { id: String(created._id) }, body })).statusCode).toBe(400);
    expect((await call(approveVisitDebt, { user: actors.adminA, params: { id: String(created._id) }, body: { ...body, maxAmount: 1000, expiresInHours: 100000 } })).statusCode).toBe(400);
    expect((await call(approveVisitDebt, { user: { ...actors.adminA, role: "system_admin" }, params: { id: String(created._id) }, body: { ...body, maxAmount: 1000 } })).statusCode).toBe(403);
    expect((await call(approveVisitDebt, { user: actors.adminA, params: { id: String(created._id) }, body: { ...body, maxAmount: 1000 } })).statusCode).toBe(200);
  });

  // ── PUT /visits/:id/status ───────────────────────────────────────────────────────────────
  test("OPEN-01: không vào buồng chụp nếu chưa đạt bảng kiểm an toàn, kể cả khi đã trả tiền", async () => {
    const { visit } = await makeVisit({ invoice: { status: "đã thanh toán" } });
    const res = await call(updateStatus, { user: actors.technician, params: { id: String(visit._id) }, body: { status: "đang chụp" } });
    expect(res.statusCode).toBe(409);
    expect(res.payload.code).toBe("ERR_MRI_SAFETY_NOT_PASSED");
    expect((await Visit.findById(visit._id)).status).toBe("chờ chụp");
  });

  test("OPEN-01: đạt bảng kiểm nhưng chưa trả tiền thì nhận 402, đã trả tiền thì vào được", async () => {
    const { visit: unpaid } = await makeVisit({ visit: { mriSafetyChecklist: passedChecklist } });
    const blocked = await call(updateStatus, { user: actors.technician, params: { id: String(unpaid._id) }, body: { status: "đang chụp" } });
    expect(blocked.statusCode).toBe(402);
    expect((await Visit.findById(unpaid._id)).status).toBe("chờ chụp");

    const { visit: paid } = await makeVisit({ invoice: { status: "đã thanh toán" }, visit: { mriSafetyChecklist: passedChecklist } });
    const ok = await call(updateStatus, { user: actors.technician, params: { id: String(paid._id) }, body: { status: "đang chụp" } });
    expect(ok.statusCode).toBe(200);
    expect((await Visit.findById(paid._id)).status).toBe("đang chụp");
  });

  test("OPEN-01: dược sĩ, lễ tân không đưa được bệnh nhân vào buồng chụp", async () => {
    const { visit } = await makeVisit({ invoice: { status: "đã thanh toán" }, visit: { mriSafetyChecklist: passedChecklist } });
    for (const user of [actors.pharmacist, actors.receptionistA]) {
      const res = await call(updateStatus, { user, params: { id: String(visit._id) }, body: { status: "đang chụp" } });
      expect(res.statusCode).toBe(403);
    }
  });

  test("Ca cấp cứu chưa trả tiền vẫn vào chụp nếu đạt bảng kiểm, và có vết audit miễn cổng", async () => {
    const { visit } = await makeVisit({ visit: { priority: "khẩn cấp", mriSafetyChecklist: passedChecklist } });
    const res = await call(updateStatus, { user: actors.technician, params: { id: String(visit._id) }, body: { status: "đang chụp" } });
    expect(res.statusCode).toBe(200);
    expect(await auditCount("PAYMENT_GATE_BYPASSED", visit._id)).toBe(1);
  });

  test("FI-14: lễ tân không tự đổi loại hình sang nội trú để mở cổng viện phí", async () => {
    const { visit } = await makeVisit();
    const res = await call(updateStatus, { user: actors.receptionistA, params: { id: String(visit._id) }, body: { visitType: "inpatient" } });
    expect(res.statusCode).toBe(403);
    const byDoctor = await call(updateStatus, { user: actors.doctor, params: { id: String(visit._id) }, body: { visitType: "Nội trú" } });
    expect(byDoctor.statusCode).toBe(200);
    expect(await auditCount("VISIT_TYPE_CHANGED", visit._id)).toBe(1);
  });

  // ── Hoàn tiền ────────────────────────────────────────────────────────────────────────────
  test("OPEN-03: Ban Giám đốc cũng không hoàn thẳng được khoản lớn; requestedAmount giả không hạ được ngưỡng", async () => {
    const inv = await makeInvoice(60_000_000);
    const direct = await call(refundInvoice, { user: actors.adminA, params: { id: String(inv._id) } });
    expect(direct.statusCode).toBe(403);
    expect((await Invoice.findById(inv._id)).status).toBe("đã thanh toán");

    const inv2 = await makeInvoice(400_000_000);
    // QA-14: số tiền khác toàn bộ mà không chọn dòng thì bị từ chối ngay, không mở yêu cầu với ngưỡng thấp
    const spoof = await call(requestInvoiceRefund, { user: actors.adminA, params: { id: String(inv2._id) }, body: { requestedAmount: 1 } });
    expect(spoof.statusCode).toBe(400);
    expect((await Invoice.findById(inv2._id)).status).toBe("đã thanh toán");
    expect((await Invoice.findById(inv2._id)).refundApproval?.approvalStatus === "pending_second_approval").toBe(false);
    const full = await call(requestInvoiceRefund, { user: actors.adminA, params: { id: String(inv2._id) }, body: { requestedAmount: 400_000_000 } });
    expect(full.statusCode).toBe(202);
    expect((await Invoice.findById(inv2._id)).refundApproval.requestedAmount).toBe(400_000_000);
  });

  test("Q-V4-06: admin, system_admin không tham gia hoàn tiền ở controller lẫn route", async () => {
    const inv = await makeInvoice(5_000_000);
    for (const role of ["admin", "system_admin"]) {
      const res = await call(refundInvoice, { user: { ...actors.adminA, role }, params: { id: String(inv._id) } });
      expect(res.statusCode).toBe(403);
      expect(routeAllows(invoiceRoutes, "post", "/:id/refund/approve", role)).toBe(false);
      expect(routeAllows(invoiceRoutes, "put", "/:id/refund", role)).toBe(false);
      expect(routeAllows(visitRoutes, "post", "/:id/debt-approval", role)).toBe(false);
    }
  });

  test("FI-23: số tiền yêu cầu sai định dạng hoặc vượt hóa đơn trả 400", async () => {
    const inv = await makeInvoice(15_000_000);
    for (const requestedAmount of ["abc", -5, 900_000_000]) {
      const res = await call(requestInvoiceRefund, { user: actors.receptionistA, params: { id: String(inv._id) }, body: { requestedAmount } });
      expect(res.statusCode).toBe(400);
    }
  });

  test("FI-05: yêu cầu mới không ghi đè yêu cầu đang chờ, maker gốc không tự duyệt được", async () => {
    const inv = await makeInvoice(15_000_000);
    const id = String(inv._id);
    expect((await call(requestInvoiceRefund, { user: actors.receptionistA, params: { id } })).statusCode).toBe(202);
    expect((await call(requestInvoiceRefund, { user: actors.receptionistB, params: { id } })).statusCode).toBe(409);
    const selfApprove = await call(approveInvoiceRefund, { user: actors.receptionistA, params: { id } });
    expect(selfApprove.statusCode).toBe(403);
    expect(String((await Invoice.findById(id)).refundApproval.firstApproverId)).toBe(actors.receptionistA.id);
    expect(await auditCount("REFUND_REQUESTED", id)).toBe(1);
  });

  test("FI-04: duyệt hoàn tiền phải qua xác thực bước 2", async () => {
    const inv = await makeInvoice(60_000_000);
    const id = String(inv._id);
    await call(requestInvoiceRefund, { user: actors.receptionistA, params: { id } });
    const res = await call(approveInvoiceRefund, { user: actors.adminNoMfa, params: { id } });
    expect(res.statusCode).toBe(403);
    expect(res.payload.code).toBe("STEP_UP_REQUIRED");
    expect((await Invoice.findById(id)).status).toBe("đã thanh toán");

    const issued = await call(requestStepUpOtp, { user: actors.adminNoMfa });
    expect(issued.statusCode).toBe(200);
    expect(issued.payload.debugOtp).toBe(undefined);
    const wrong = await call(verifyStepUpOtp, { user: actors.adminNoMfa, body: { otp: "000000" } });
    expect(wrong.statusCode).toBe(400);
    expect((await call(requestStepUpOtp, { user: actors.adminNoMfa })).statusCode).toBe(429);
  });

  test("FI-03: 2 người duyệt cùng lúc, đúng một người thực thi hoàn tiền", async () => {
    for (let round = 0; round < 5; round += 1) {
      const inv = await makeInvoice(60_000_000);
      const id = String(inv._id);
      await call(requestInvoiceRefund, { user: actors.receptionistA, params: { id } });
      const results = await Promise.all([
        call(approveInvoiceRefund, { user: actors.adminA, params: { id } }),
        call(approveInvoiceRefund, { user: actors.adminB, params: { id } }),
      ]);
      const codes = results.map((r) => r.statusCode).sort();
      expect(codes.join(",")).toBe("200,409");
      expect(await auditCount("REFUND_COMPLETED", id)).toBe(1);
    }
  });

  test("FI-06: phê duyệt chỉ dùng một lần, và người duyệt không đổi được phạm vi hoàn", async () => {
    const inv = await makeInvoice(20_000_000);
    const id = String(inv._id);
    await call(requestInvoiceRefund, {
      user: actors.receptionistA,
      params: { id },
      body: { refundReason: "Hoàn dịch vụ A", itemsToRefund: [{ itemIndex: 0 }] },
    });
    const approved = await call(approveInvoiceRefund, { user: actors.receptionistB, params: { id }, body: { itemsToRefund: [{ itemIndex: 0 }, { itemIndex: 1 }] } });
    expect(approved.statusCode).toBe(200);
    const afterFirst = await Invoice.findById(id);
    expect(afterFirst.refundApproval.approvalStatus).toBe("completed");
    expect(afterFirst.status).toBe("đã thanh toán");
    expect(afterFirst.refundAmount).toBe(10_000_000);

    const second = await call(refundInvoice, { user: actors.receptionistA, params: { id }, body: { itemsToRefund: [{ itemIndex: 1 }] } });
    expect(second.statusCode).toBe(403);
    expect((await Invoice.findById(id)).refundAmount).toBe(10_000_000);
  });

  test("Hoàn tiền nhỏ song song không bị thực thi 2 lần", async () => {
    const inv = await makeInvoice(5_000_000);
    const id = String(inv._id);
    const results = await Promise.all([
      call(refundInvoice, { user: actors.receptionistA, params: { id } }),
      call(refundInvoice, { user: actors.receptionistB, params: { id } }),
    ]);
    expect(results.filter((r) => r.statusCode === 200).length).toBe(1);
    expect(await auditCount("REFUND_COMPLETED", id)).toBe(1);
  });

  test("FI-20: từ chối phải đúng thẩm quyền như người duyệt", async () => {
    const inv = await makeInvoice(60_000_000);
    const id = String(inv._id);
    await call(requestInvoiceRefund, { user: actors.receptionistA, params: { id } });
    expect((await call(rejectInvoiceRefund, { user: actors.receptionistA, params: { id } })).statusCode).toBe(403);
    expect((await call(rejectInvoiceRefund, { user: actors.receptionistB, params: { id } })).statusCode).toBe(403);
    expect((await call(rejectInvoiceRefund, { user: actors.adminA, params: { id }, body: { rejectReason: "Thiếu chứng từ" } })).statusCode).toBe(200);
    const again = await call(rejectInvoiceRefund, { user: actors.adminB, params: { id } });
    expect(again.statusCode).toBe(409);
  });

  test("Q-V4-08: khoản từ 300 triệu cần 3 người khác nhau; không ghi STR, KYC giả", async () => {
    const inv = await makeInvoice(400_000_000);
    const id = String(inv._id);
    await call(requestInvoiceRefund, { user: actors.adminA, params: { id } });
    const note = "Đã đối chiếu chứng từ và lý do hoàn trả";
    expect((await call(reviewLargeRefund, { user: actors.adminA, params: { id }, body: { note } })).statusCode).toBe(403);
    expect((await call(reviewLargeRefund, { user: actors.adminB, params: { id }, body: { note: "ngắn" } })).statusCode).toBe(400);
    const noReview = await call(approveInvoiceRefund, { user: actors.adminB, params: { id } });
    expect(noReview.payload.code).toBe("LARGE_REFUND_REVIEW_REQUIRED");
    expect((await call(reviewLargeRefund, { user: actors.adminB, params: { id }, body: { note } })).statusCode).toBe(200);
    const sameAsReviewer = await call(approveInvoiceRefund, { user: actors.adminB, params: { id } });
    expect(sameAsReviewer.payload.code).toBe("LARGE_REFUND_REVIEW_REQUIRED");

    const third = await makeActor(`adminC_${oid()}`, "hospital_admin", { stepUp: true });
    expect((await call(approveInvoiceRefund, { user: third, params: { id } })).statusCode).toBe(200);
    const stored = await Invoice.findById(id);
    expect(stored.status).toBe("hoàn trả");
    expect(stored.amlReport.isFlagged).toBe(false);
    expect(stored.amlReport.kycVerified).toBe(false);
    expect(stored.amlReport.strReportId).toBeNull();
  });

  // ── Y lệnh miệng ─────────────────────────────────────────────────────────────────────────
  test("FI-01: không còn cờ nào từ client bỏ qua được đọc lại; bắt buộc chọn điều dưỡng", async () => {
    const { event } = await makeEvent();
    const body = { emergencyEventId: String(event._id), orderText: "Fentanyl 0.05mg" };
    expect((await call(createVerbalOrder, { user: actors.doctor, body })).statusCode).toBe(400);

    const { orderId, recordId } = await makeOrder({ bedsideImmediate: true, requireReadBack: false, countersignHours: 999999 });
    const stored = await loadOrder(recordId, orderId);
    expect(stored.status).toBe("pending_readback");
    expect(stored.isReadBackConfirmed).toBe(false);
    const hours = (new Date(stored.countersignDeadline) - new Date(stored.prescribedAt)) / 3600000;
    expect(Math.round(hours)).toBe(24);
  });

  test("FI-18: người nhận phải là điều dưỡng cùng viện; FI-19: quản trị không ra được y lệnh", async () => {
    const { event } = await makeEvent();
    const body = { emergencyEventId: String(event._id), orderText: "Mannitol" };
    expect((await call(createVerbalOrder, { user: actors.doctor, body: { ...body, nurseReceivedId: actors.cleaner.id } })).statusCode).toBe(400);
    expect((await call(createVerbalOrder, { user: actors.adminA, body: { ...body, nurseReceivedId: actors.nurse.id } })).statusCode).toBe(403);
    expect(routeAllows(emergencyRoutes, "post", "/verbal-order", "hospital_admin")).toBe(false);
  });

  test("Q-V4-02: chỉ ra y lệnh trong sự kiện cấp cứu đang mở", async () => {
    const { event } = await makeEvent("closed");
    const res = await call(createVerbalOrder, {
      user: actors.doctor,
      body: { emergencyEventId: String(event._id), orderText: "Mannitol", nurseReceivedId: actors.nurse.id },
    });
    expect(res.statusCode).toBe(409);
  });

  test("FI-02: mã OTP không lộ cho bác sĩ, không lưu dạng đọc được, không xác nhận thay điều dưỡng được", async () => {
    const { orderId, recordId, res } = await makeOrder();
    const body = JSON.stringify(res.payload);
    expect(body.includes("readBackOtp" + "Code")).toBe(false);
    expect(body.includes("readBackOtpHash")).toBe(false);
    const stored = await loadOrder(recordId, orderId);
    expect(stored.readBackOtpHash.length).toBe(64);

    const plain = await MedicalRecord.findById(recordId).lean();
    expect(plain.verbalOrders[0].readBackOtpHash).toBe(undefined);

    const asDoctor = await call(confirmVerbalOrderOtp, {
      user: actors.doctor,
      params: { orderId },
      body: { otpCode: "123456", nurseId: actors.nurse.id },
    });
    expect(asDoctor.statusCode).toBe(403);
    expect((await loadOrder(recordId, orderId)).isReadBackConfirmed).toBe(false);
  });

  test("FI-02: nhập sai OTP quá 5 lần thì bị khóa, kể cả mã đúng", async () => {
    const { orderId, recordId } = await makeOrder();
    for (let i = 0; i < 5; i += 1) {
      const wrong = await call(confirmVerbalOrderOtp, { user: actors.nurse, params: { orderId }, body: { otpCode: "000000" } });
      expect(wrong.statusCode).toBe(400);
    }
    const locked = await call(confirmVerbalOrderOtp, { user: actors.nurse, params: { orderId }, body: { otpCode: "000000" } });
    expect(locked.statusCode).toBe(429);
    expect((await loadOrder(recordId, orderId)).status).toBe("pending_readback");
  });

  test("FI-09: chỉ đúng điều dưỡng được gán mới xác nhận được", async () => {
    const { orderId, recordId } = await makeOrder();
    const other = await call(confirmVerbalOrderReadBack, { user: actors.nurse2, params: { orderId } });
    expect(other.statusCode).toBe(403);
    const admin = await call(confirmVerbalOrderReadBack, { user: actors.adminA, params: { orderId } });
    expect(admin.statusCode).toBe(403);
    expect(routeAllows(emergencyRoutes, "post", "/verbal-order/:orderId/readback-confirm", "hospital_admin")).toBe(false);
    expect(routeAllows(emergencyRoutes, "post", "/verbal-order/:orderId/readback-otp", "technician")).toBe(false);

    const ok = await call(confirmVerbalOrderReadBack, { user: actors.nurse, params: { orderId } });
    expect(ok.statusCode).toBe(200);
    const stored = await loadOrder(recordId, orderId);
    expect(stored.status).toBe("readback_confirmed");
    expect(String(stored.readBackConfirmedBy)).toBe(actors.nurse.id);
    expect(stored.readBackOtpHash).toBeNull();
  });

  test("FI-10, FI-11: chỉ bác sĩ ra lệnh ký được, người ký được lưu lại, trạng thái không lùi", async () => {
    const { orderId, recordId } = await makeOrder();
    expect((await call(countersignVerbalOrder, { user: actors.doctor, params: { orderId } })).statusCode).toBe(400);
    await call(confirmVerbalOrderReadBack, { user: actors.nurse, params: { orderId } });
    expect((await call(countersignVerbalOrder, { user: actors.doctor2, params: { orderId } })).statusCode).toBe(403);

    const signed = await call(countersignVerbalOrder, { user: actors.doctor, params: { orderId } });
    expect(signed.statusCode).toBe(200);
    const stored = await loadOrder(recordId, orderId);
    expect(stored.status).toBe("fully_signed");
    expect(String(stored.countersignedBy)).toBe(actors.doctor.id);
    const firstHash = stored.signatureHash;

    expect((await call(countersignVerbalOrder, { user: actors.doctor, params: { orderId } })).statusCode).toBe(409);
    expect((await call(confirmVerbalOrderReadBack, { user: actors.nurse, params: { orderId } })).statusCode).toBe(409);
    const after = await loadOrder(recordId, orderId);
    expect(after.status).toBe("fully_signed");
    expect(after.signatureHash).toBe(firstHash);
  });

  test("Thuốc gây nghiện: người chứng kiến phải tồn tại và khác bác sĩ ra lệnh", async () => {
    const { orderId, recordId } = await makeOrder({ isControlledSubstance: true });
    await call(confirmVerbalOrderReadBack, { user: actors.nurse, params: { orderId } });
    for (const witnessUserId of [undefined, actors.doctor.id, String(oid()), actors.cleaner.id]) {
      const res = await call(countersignVerbalOrder, { user: actors.doctor, params: { orderId }, body: { witnessUserId } });
      expect(res.statusCode).toBe(400);
    }
    expect((await call(countersignVerbalOrder, { user: actors.doctor, params: { orderId }, body: { witnessUserId: actors.nurse2.id } })).statusCode).toBe(200);
    expect(String((await loadOrder(recordId, orderId)).witnessUserId)).toBe(actors.nurse2.id);
  });

  test("Q-V4-03: điều dưỡng từ chối khi đọc lại không khớp; y lệnh bị từ chối không ký được", async () => {
    const { orderId, recordId } = await makeOrder();
    expect((await call(rejectVerbalOrder, { user: actors.nurse2, params: { orderId }, body: { reason: "Không khớp liều" } })).statusCode).toBe(403);
    expect((await call(rejectVerbalOrder, { user: actors.nurse, params: { orderId }, body: { reason: "x" } })).statusCode).toBe(400);
    expect((await call(rejectVerbalOrder, { user: actors.nurse, params: { orderId }, body: { reason: "Không khớp liều" } })).statusCode).toBe(200);
    expect((await loadOrder(recordId, orderId)).status).toBe("rejected");
    expect((await call(confirmVerbalOrderReadBack, { user: actors.nurse, params: { orderId } })).statusCode).toBe(409);
  });

  test("FI-08: quá 15 phút leo thang, quá 24 giờ đánh dấu quá hạn, mỗi mốc chỉ một lần", async () => {
    const { orderId, recordId } = await makeOrder();
    const later = new Date(Date.now() + 16 * 60 * 1000);
    const first = await runVerbalOrderEscalationJob(later);
    expect(first.success).toBe(true);
    const stored = await loadOrder(recordId, orderId);
    expect(stored.escalatedReadBackAt !== null).toBe(true);
    expect(stored.status).toBe("pending_readback");
    const logs = await AuditLog.countDocuments({ action: "VERBAL_ORDER_READBACK_ESCALATED", entityId: String(recordId) });
    expect(logs).toBe(1);

    await Promise.all([runVerbalOrderEscalationJob(later), runVerbalOrderEscalationJob(later)]);
    expect(await AuditLog.countDocuments({ action: "VERBAL_ORDER_READBACK_ESCALATED", entityId: String(recordId) })).toBe(1);

    const dayLater = new Date(Date.now() + 25 * 3600 * 1000);
    await runVerbalOrderEscalationJob(dayLater);
    expect((await loadOrder(recordId, orderId)).overdueAt !== null).toBe(true);
    expect(await AuditLog.countDocuments({ action: "VERBAL_ORDER_OVERDUE", entityId: String(recordId) })).toBe(1);
  });

  // ── Ký báo cáo CĐHA ──────────────────────────────────────────────────────────────────────
  test("Q-V4-01: bác sĩ lâm sàng nhận 403 ở cả 2 đường ký khi viện có Bác sĩ CĐHA", async () => {
    const image = await makeImaging();
    const body = { conclusion: "Kết luận" };
    expect((await call(signImagingReport, { user: actors.doctor, params: { imagingResultId: String(image._id) }, body })).statusCode).toBe(403);
    expect((await call(updateImagingResult, { user: actors.doctor, params: { id: String(image._id) }, body })).statusCode).toBe(403);
    expect((await ImagingResult.findById(image._id)).isSigned).toBe(false);
  });

  test("Q-V4-11: Trưởng khoa phải được cấp quyền và ghi lý do", async () => {
    const image = await makeImaging();
    const params = { imagingResultId: String(image._id) };
    const body = { conclusion: "Kết luận" };
    expect((await call(signImagingReport, { user: actors.headNoGrant, params, body: { ...body, actingRadiologistReason: "Bác sĩ CĐHA đang cấp cứu" } })).statusCode).toBe(403);
    expect((await call(signImagingReport, { user: actors.head, params, body })).statusCode).toBe(400);
    expect((await call(updateImagingResult, { user: actors.head, params: { id: String(image._id) }, body })).statusCode).toBe(400);

    const ok = await call(signImagingReport, { user: actors.head, params, body: { ...body, actingRadiologistReason: "Bác sĩ CĐHA đang cấp cứu" } });
    expect(ok.statusCode).toBe(200);
    const stored = await ImagingResult.findById(image._id);
    expect(stored.signMode).toBe("acting_department_head");
    expect(await auditCount("IMAGING_REPORT_SIGNED", image._id)).toBe(1);
  });

  test("Q-V4-01: viện không có Bác sĩ CĐHA và đã bật chính sách thì đúng bác sĩ chỉ định được ký", async () => {
    const hospital = await Hospital.create({ name: "BV Không CĐHA", code: `V34N-${oid()}`, imagingPolicy: { allowOrderingDoctorSign: true } });
    const orderingId = oid();
    const otherId = oid();
    const makeDoc = (_id) => User.create({ _id, hospitalId: hospital._id, email: `v34_nd_${_id}@neuroscan.vn`, passwordHash: "hashed", role: "doctor", profile: { name: "BS", fullName: "BS" } });
    await makeDoc(orderingId);
    await makeDoc(otherId);
    const visit = await Visit.create({ hospitalId: hospital._id, patientId: oid(), doctorId: orderingId, status: "chờ bác sĩ đọc", mriOrder: {} });
    const image = await makeImaging({ hospitalId: hospital._id, visitId: visit._id });
    const asUser = (_id) => ({ _id, id: String(_id), role: "doctor", hospitalId: String(hospital._id), profile: { name: "BS", fullName: "BS" } });
    const params = { id: String(image._id) };
    const body = { conclusion: "Kết luận của bác sĩ chỉ định" };

    expect((await call(updateImagingResult, { user: asUser(otherId), params, body })).statusCode).toBe(403);
    expect((await call(updateImagingResult, { user: asUser(orderingId), params, body })).statusCode).toBe(200);
    expect((await ImagingResult.findById(image._id)).signMode).toBe("ordering_doctor_exception");

    await User.create({ hospitalId: hospital._id, email: `v34_rad_${oid()}@neuroscan.vn`, passwordHash: "hashed", role: "radiologist", profile: { name: "CĐHA" } });
    const image2 = await makeImaging({ hospitalId: hospital._id, visitId: visit._id });
    expect((await call(updateImagingResult, { user: asUser(orderingId), params: { id: String(image2._id) }, body })).statusCode).toBe(403);
  });

  test("DB thật: phim chỉ liên kết từ lượt khám vẫn áp dụng được ngoại lệ bác sĩ chỉ định, và cập nhật trạng thái ca", async () => {
    const hospital = await Hospital.create({ name: "BV Liên kết", code: `V34L-${oid()}`, imagingPolicy: { allowOrderingDoctorSign: true } });
    const doctorId = oid();
    await User.create({ _id: doctorId, hospitalId: hospital._id, email: `v34_l_${doctorId}@neuroscan.vn`, passwordHash: "hashed", role: "doctor", profile: { name: "BS", fullName: "BS" } });
    const image = await makeImaging({ hospitalId: hospital._id });
    const visit = await Visit.create({ hospitalId: hospital._id, patientId: oid(), doctorId, status: "chờ kết quả AI", mriOrder: { imagingResultId: image._id } });
    const user = { _id: doctorId, id: String(doctorId), role: "doctor", hospitalId: String(hospital._id), profile: { name: "BS", fullName: "BS" } };
    const res = await call(updateImagingResult, { user, params: { id: String(image._id) }, body: { conclusion: "Kết luận" } });
    expect(res.statusCode).toBe(200);
    expect((await Visit.findById(visit._id)).status).toBe("chờ bác sĩ đọc");
  });

  test("DB thật: cảnh báo cấp cứu cũ không treo banner", async () => {
    await EmergencyAlert.create({ hospitalId, source: "inpatient_crisis", level: "RED", triggeredBy: "manual", triggeredByUserId: actors.nurse._id, status: "active", triggeredAt: new Date(Date.now() - 40 * 86400000) });
    await EmergencyAlert.deleteMany({ hospitalId, triggeredAt: { $gte: new Date(Date.now() - 86400000) } });
    expect((await call(getActiveAlerts, { user: actors.cleaner })).payload.data.length).toBe(0);
    expect((await call(getActiveAlerts, { user: actors.nurse, query: { recentHours: "24" } })).payload.data.length).toBe(0);
    expect((await call(getActiveAlerts, { user: actors.nurse })).payload.data.length).toBeGreaterThan(0);
  });

  test("DB thật: đơn thuốc giữ được visitId nên không bị tính nhầm sang ca khác", async () => {
    const { Prescription } = await import("../models/prescription.model.js");
    const { buildVisitPrescriptionFilter } = await import("../utils/prescriptionScope.util.js");
    const patientId = oid();
    const visitA = await Visit.create({ hospitalId, patientId, status: "đang khám" });
    const visitB = await Visit.create({ hospitalId, patientId, status: "đang khám" });
    await Prescription.create({ hospitalId, patient_id: patientId, visitId: visitB._id, doctor_name: "BS", diagnosis: "d", drugs: [] });
    const inHospital = (visit) => ({ hospitalId, ...buildVisitPrescriptionFilter(visit) });
    expect((await Prescription.find(inHospital(visitA))).length).toBe(0);
    expect((await Prescription.find(inHospital(visitB))).length).toBe(1);
  });

  test("DB thật: lịch phòng theo sát ca chụp, công việc của ca đã kết thúc không còn treo", async () => {
    const { MriSlot } = await import("../modules/hospital/models/mriSlot.model.js");
    const { Task } = await import("../models/task.model.js");
    const { visit } = await makeVisit({ invoice: { status: "đã thanh toán" }, visit: { mriSafetyChecklist: passedChecklist } });
    const start = new Date();
    const slot = await MriSlot.create({ hospitalId, roomId: oid(), visitId: visit._id, date: "2026-11-06", startTime: start, endTime: new Date(start.getTime() + 1800000), status: "booked" });
    const task = await Task.create({ hospitalId, visitId: visit._id, patientId: visit.patientId, stepNumber: 3, title: "B", roleRequired: "technician", status: "pending" });
    const params = { id: String(visit._id) };
    await call(updateStatus, { user: actors.technician, params, body: { status: "đang chụp" } });
    expect((await MriSlot.findById(slot._id)).status).toBe("in_progress");
    await call(updateStatus, { user: actors.technician, params, body: { status: "đã hủy" } });
    expect((await MriSlot.findById(slot._id)).status).toBe("cancelled");
    expect((await Task.findById(task._id)).status).toBe("skipped");
  });

  test("OPEN-05, NEW-02: 2 Bác sĩ CĐHA ký cùng lúc thì người sau nhận 409; có audit ký", async () => {
    for (let round = 0; round < 5; round += 1) {
      const image = await makeImaging();
      const params = { imagingResultId: String(image._id) };
      const results = await Promise.all([
        call(signImagingReport, { user: actors.radiologist, params, body: { conclusion: "Kết luận của bác sĩ 1" } }),
        call(signImagingReport, { user: actors.radiologist2, params, body: { conclusion: "Kết luận của bác sĩ 2" } }),
      ]);
      expect(results.map((r) => r.statusCode).sort().join(",")).toBe("200,409");
      const winner = results[0].statusCode === 200 ? "Kết luận của bác sĩ 1" : "Kết luận của bác sĩ 2";
      expect((await ImagingResult.findById(image._id)).conclusion).toBe(winner);
      expect(await auditCount("IMAGING_REPORT_SIGNED", image._id)).toBe(1);
    }
  });

  test("Đường ký FE (PUT): ký đồng thời cũng chỉ một người thắng", async () => {
    const image = await makeImaging();
    const params = { id: String(image._id) };
    const results = await Promise.all([
      call(updateImagingResult, { user: actors.radiologist, params, body: { conclusion: "Kết luận 1", findings: "Mô tả 1" } }),
      call(updateImagingResult, { user: actors.radiologist2, params, body: { conclusion: "Kết luận 2", findings: "Mô tả 2" } }),
    ]);
    expect(results.map((r) => r.statusCode).sort().join(",")).toBe("200,409");
  });

  test("Q-V4-09, FI-17: acknowledge cho bác sĩ và Trưởng khoa, chỉ trên báo cáo đã ký, giữ lịch sử", async () => {
    const image = await makeImaging();
    const params = { id: String(image._id) };
    expect((await call(acknowledgeImagingReport, { user: actors.doctor, params })).statusCode).toBe(409);
    await ImagingResult.updateOne({ _id: image._id }, { $set: { isSigned: true } });
    expect((await call(acknowledgeImagingReport, { user: actors.radiologist, params })).statusCode).toBe(403);
    expect((await call(acknowledgeImagingReport, { user: actors.doctor, params, body: { clinicalNote: "Đã đọc lần 1" } })).statusCode).toBe(200);
    expect((await call(acknowledgeImagingReport, { user: actors.head, params, body: { clinicalNote: "Đã đọc lần 2" } })).statusCode).toBe(200);
    const stored = await ImagingResult.findById(image._id);
    expect(String(stored.attendingAcknowledgment.acknowledgedBy)).toBe(actors.head.id);
    expect(String(stored.acknowledgmentHistory[0].acknowledgedBy)).toBe(actors.doctor.id);
    expect(routeAllows(imagingRoutes, "post", "/:id/acknowledge", "radiologist")).toBe(false);
  });

  test("OPEN-06, Q-V4-09: bác sĩ lâm sàng chỉ tạo được phụ lục lâm sàng", async () => {
    const image = await makeImaging({ isSigned: true, conclusion: "Kết luận gốc" });
    const params = { id: String(image._id) };
    const spoof = await call(addImagingAddendum, { user: actors.doctor, params, body: { content: "Đính chính giả", addendumType: "radiology_amendment" } });
    expect(spoof.statusCode).toBe(201);
    expect(spoof.payload.addendum.addendumType).toBe("clinical_correlation");
    const rad = await call(addImagingAddendum, { user: actors.radiologist, params, body: { content: "Đính chính CĐHA" } });
    expect(rad.payload.addendum.addendumType).toBe("radiology_amendment");
    expect((await call(addClinicalAddendum, { user: actors.radiologist, params, body: { content: "Phụ lục" } })).statusCode).toBe(403);
    expect(await auditCount("CLINICAL_ADDENDUM_CREATED", image._id)).toBe(2);
  });

  test("NEW-03: nhân viên không tham gia điều trị không đọc được dữ liệu CĐHA", () => {
    for (const role of ["cleaner", "pharmacist", "lab_technician"]) {
      for (const path of ["/", "/:id", "/by-visit/:visitId", "/by-patient/:patientId", "/patient/:medicalId"]) {
        expect(routeAllows(imagingRoutes, "get", path, role)).toBe(false);
      }
      expect(routeAllows(dicomRoutes, "get", "/studies", role)).toBe(false);
      expect(routeAllows(aiPipelineRoutes, "get", "/jobs", role)).toBe(false);
    }
    expect(routeAllows(imagingRoutes, "get", "/:id", "patient")).toBe(true);
    expect(routeAllows(dicomRoutes, "get", "/studies/:id/viewer-manifest", "patient")).toBe(true);
    expect(routeAllows(imagingRoutes, "get", "/", "patient")).toBe(false);
  });

  test("Bệnh nhân đọc được phim đã ký của mình, không đọc được bản nháp hay phim của người khác", async () => {
    const medicalId = `BN-${oid()}`;
    const patient = await User.create({ email: `v34_owner_${oid()}@neuroscan.vn`, passwordHash: "hashed", role: "patient", profile: { name: "BN", medicalId } });
    const other = await User.create({ email: `v34_other_${oid()}@neuroscan.vn`, passwordHash: "hashed", role: "patient", profile: { name: "BN", medicalId: `BN-${oid()}` } });
    const signed = await makeImaging({ medicalId, isSigned: true, conclusion: "Kết luận đã ký" });
    const unsigned = await makeImaging({ medicalId, isSigned: false });
    const asPatient = (user, fn) => tenantStorage.run({ role: "patient", userId: String(user._id) }, fn);
    const actor = (user) => ({ _id: user._id, id: String(user._id), role: "patient", hospitalId: null, profile: user.profile });

    const own = await asPatient(patient, () => call(getResultById, { user: actor(patient), params: { id: String(signed._id) } }));
    expect(own.statusCode).toBe(200);
    const draft = await asPatient(patient, () => call(getResultById, { user: actor(patient), params: { id: String(unsigned._id) } }));
    expect(draft.statusCode).toBe(403);
    const foreign = await asPatient(other, () => call(getResultById, { user: actor(other), params: { id: String(signed._id) } }));
    expect(foreign.statusCode).toBe(403);
    const list = await asPatient(patient, () => call(getPatientResults, { user: actor(patient) }));
    expect(list.payload.data.length).toBe(1);
    expect(String(list.payload.data[0]._id)).toBe(String(signed._id));
  });

  // ── Lễ tân và cảnh báo cấp cứu ───────────────────────────────────────────────────────────
  test("REG-01, Q-V4-07: lễ tân xếp được lịch ca cấp cứu đã có chỉ định, không tự nâng ca thường", async () => {
    expect(routeAllows(mriRoomRoutes, "post", "/schedule/emergency-override", "receptionist")).toBe(true);
    expect(routeAllows(mriRoomRoutes, "post", "/schedule/confirm-reschedule", "receptionist")).toBe(true);
    expect(routeAllows(mriRoomRoutes, "post", "/schedule/emergency-override", "pharmacist")).toBe(false);

    const { visit: normal } = await makeVisit();
    const blocked = await call(handleEmergencyOverride, { user: actors.receptionistA, body: { visitId: String(normal._id) } });
    expect(blocked.statusCode).toBe(403);
    expect((await Visit.findById(normal._id)).priority).toBe("trung bình");

    const { visit: noOrder } = await makeVisit({ visit: { priority: "khẩn cấp", mriOrder: {} } });
    expect((await call(handleEmergencyOverride, { user: actors.receptionistA, body: { visitId: String(noOrder._id) } })).statusCode).toBe(403);
  });

  test("REG-03, Q-V4-07: mọi nhân viên nhận banner, vai trò ngoài kíp không thấy dữ liệu người bệnh", async () => {
    await makeEvent("triggered");
    for (const role of ["receptionist", "pharmacist", "cleaner", "lab_technician"]) {
      expect(routeAllows(emergencyRoutes, "get", "/alerts", role)).toBe(true);
    }
    expect(routeAllows(emergencyRoutes, "get", "/alerts", "patient")).toBe(false);

    const res = await call(getActiveAlerts, { user: actors.cleaner });
    expect(res.statusCode).toBe(200);
    expect(res.payload.data.length).toBeGreaterThan(0);
    const fields = Object.keys(res.payload.data[0]);
    expect(fields.includes("patientId")).toBe(false);
    expect(fields.includes("visitId")).toBe(false);
    expect(fields.includes("isbarHandoff")).toBe(false);
  });

  // ── OTP và rate limit ────────────────────────────────────────────────────────────────────
  test("OPEN-04: OTP đặt lại mật khẩu bị khóa sau 5 lần sai, kể cả mã đúng", async () => {
    const email = `v34_otp_${oid()}@neuroscan.vn`;
    await User.create({ email, passwordHash: "hashed", role: "patient", otpCode: "654321", otpExpires: new Date(Date.now() + 60000), profile: { name: "BN" } });
    for (let i = 0; i < 5; i += 1) {
      expect((await call(verifyOtp, { body: { email, otp: "000000", newPassword: "Abcd@1234" } })).statusCode).toBe(400);
    }
    const locked = await call(verifyOtp, { body: { email, otp: "654321", newPassword: "Abcd@1234" } });
    expect(locked.statusCode).toBe(429);
    expect((await User.findOne({ email })).passwordHash).toBe("hashed");
  });

  test("OPEN-04: request song song không vượt được 5 lần thử", async () => {
    const email = `v34_otp_${oid()}@neuroscan.vn`;
    await User.create({ email, passwordHash: "hashed", role: "patient", otpCode: "654321", otpExpires: new Date(Date.now() + 60000), profile: { name: "BN" } });
    const results = await Promise.all(Array.from({ length: 12 }, () => call(verifyOtp, { body: { email, otp: "000000", newPassword: "Abcd@1234" } })));
    expect(results.filter((r) => r.statusCode === 400).length).toBe(5);
    expect(results.filter((r) => r.statusCode === 429).length).toBe(7);
  });

  test("OPEN-04: OTP đăng nhập SĐT cũng bị giới hạn", async () => {
    const phone = `09${String(Date.now()).slice(-8)}`;
    await User.create({ email: `v34_phone_${oid()}@neuroscan.vn`, phone, passwordHash: "hashed", role: "patient", otpCode: "654321", otpExpires: new Date(Date.now() + 60000), profile: { name: "BN" } });
    for (let i = 0; i < 5; i += 1) {
      expect((await call(phoneLoginVerify, { body: { phone, otp: "000000" } })).statusCode).toBe(400);
    }
    expect((await call(phoneLoginVerify, { body: { phone, otp: "654321" } })).statusCode).toBe(429);
  });

  test("OPEN-04: xin mã mới phải cách 60 giây, nên không reset được bộ đếm để dò tiếp", async () => {
    const email = `v34_otp_${oid()}@neuroscan.vn`;
    await User.create({ email, passwordHash: "hashed", role: "patient", profile: { name: "BN" } });
    expect((await call(forgotPassword, { body: { email } })).statusCode).toBe(200);
    expect((await call(forgotPassword, { body: { email } })).statusCode).toBe(429);
  });

  test("NEW-05: mã 123456 không còn hiệu lực nếu không bật rõ ENABLE_DEBUG_OTP", async () => {
    const saved = process.env.ENABLE_DEBUG_OTP;
    delete process.env.ENABLE_DEBUG_OTP;
    const email = `v34_master_${oid()}@neuroscan.vn`;
    await User.create({ email, passwordHash: "hashed", role: "hospital_admin", hospitalId, otpCode: "654321", otpExpires: new Date(Date.now() + 60000), profile: { name: "QT" } });
    const res = await call(verifyOtp, { body: { email, otp: "123456", newPassword: "Abcd@1234" } });
    expect(res.statusCode).toBe(400);
    expect((await User.findOne({ email })).passwordHash).toBe("hashed");
    if (saved !== undefined) process.env.ENABLE_DEBUG_OTP = saved;
  });

  test("OPEN-04: đổi X-Forwarded-For không thoát được rate limit", async () => {
    const savedFlag = process.env.ENABLE_RATE_LIMIT;
    process.env.ENABLE_RATE_LIMIT = "true";
    const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 3 });
    const hit = (forwarded) => new Promise((resolve) => {
      const res = makeRes();
      res.json = function json() { resolve(this.statusCode); return this; };
      limiter({ ip: "203.0.113.7", headers: { "x-forwarded-for": forwarded }, baseUrl: `/v34-${savedFlag}`, body: { email: "xff@neuroscan.vn" } }, res, () => resolve("next"));
    });
    const results = [];
    for (let i = 0; i < 5; i += 1) results.push(await hit(`10.0.0.${i}`));
    expect(results.filter((r) => r === 429).length).toBe(2);
    if (savedFlag === undefined) delete process.env.ENABLE_RATE_LIMIT;
    else process.env.ENABLE_RATE_LIMIT = savedFlag;
  });
});
