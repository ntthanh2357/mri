import mongoose from "mongoose";
import { Visit } from "../models/visit.model.js";
import { User } from "../models/user.model.js";
import { Invoice } from "../models/invoice.model.js";
import { Hospital } from "../models/hospital.model.js";
import { LabOrder } from "../modules/laboratory/models/labOrder.model.js";
import { ImagingResult } from "../modules/imaging/models/imagingResult.model.js";
import { createNotificationInternal } from "../controllers/notification.controller.js";
import { getDayRangeVN } from "../utils/date.util.js";
import { contrastConsentPending, contrastRiskBlockMessage } from "./contrastConsent.service.js";
import { evaluateVitalSigns } from "./vitalsSafety.service.js";
import { recordAuditLog, AUDIT_ACTIONS } from "./auditLog.service.js";
import { MriSlot } from "../modules/hospital/models/mriSlot.model.js";
import StoredMedicalFile from "../models/storedMedicalFile.model.js";

/**
 * Helper: Đánh giá Cổng Viện phí (Payment Gate) bắt buộc phía Server (Q-BILLING-01)
 */
const INPATIENT_VISIT_TYPES = new Set(["inpatient", "nội trú", "noi_tru", "noi tru"]);
export const isInpatientVisitType = (visitType) =>
  INPATIENT_VISIT_TYPES.has(String(visitType || "").trim().toLowerCase());

export const shouldEnforcePaymentGate = (visit, inv, { partialDebtThreshold = 0 } = {}) => {
  if (!visit) {
    const err = new Error("Không tìm thấy lượt khám.");
    err.statusCode = 404;
    throw err;
  }
  // 1. Cấp cứu — KHÔNG BAO GIỜ chặn
  if (visit.priority === "khẩn cấp") {
    return { enforce: false, reason: "EMERGENCY_BYPASS" };
  }
  // 2. Nội trú / Hậu phẫu — ghi sổ nội trú, thanh toán khi ra viện
  if (
    isInpatientVisitType(visit.visitType) ||
    visit.status === "chờ nhập viện" ||
    visit.status === "chờ chụp sau phẫu thuật" ||
    visit.mriOrder?.clinicalScenario === "post_op_72h"
  ) {
    return { enforce: false, reason: "INPATIENT_POSTOP_DEFERRED" };
  }
  if (!inv) {
    return { enforce: false, reason: "NO_INVOICE_REQUIRED" };
  }
  // 3. BHYT 100% hoặc gói tài trợ / thử nghiệm lâm sàng
  if (
    inv.bhytInfo?.coverageRate === 100 ||
    inv.paymentMethod === "BHYT chi trả" ||
    ["clinical_trial", "sponsored", "charity"].includes(inv.billingType)
  ) {
    return { enforce: false, reason: "FULL_COVERAGE_OR_SPONSORED" };
  }
  const owed = inv.patientPayAmount ?? (inv.totalAmount - (inv.bhytInfo?.bhytAmount || 0));
  const paidAmount = inv.status === "thanh toán một phần" ? Number(inv.paidAmount || 0) : 0;
  const remainingOwed = Math.max(0, owed - paidAmount);
  // 4. Bảo lãnh nợ từ Ban Giám đốc: còn hạn và đủ hạn mức cho số tiền còn nợ
  if (
    visit.debtApproval?.isApproved === true &&
    visit.debtApproval.expiresAt &&
    new Date(visit.debtApproval.expiresAt) > new Date() &&
    remainingOwed <= Number(visit.debtApproval.maxAmount || 0)
  ) {
    return { enforce: false, reason: "DEBT_APPROVED_BY_ADMIN" };
  }
  // 5. Hóa đơn đã hoàn trả hoặc đã hủy: không còn khoản thu nào cho ca này, cần lập hóa đơn mới
  if (inv.status === "hoàn trả" || inv.status === "hủy") {
    return { enforce: true, reason: "INVOICE_VOIDED", owed };
  }
  // 6. Đã thu tiền. "đang xử lý" = tiền đã về, chỉ còn kẹt bước trừ kho (xem invoice.controller)
  if (inv.status === "đã thanh toán" || inv.status === "đang xử lý" || inv.status === "PAID" || owed <= 0) {
    return { enforce: false, reason: "ALREADY_PAID" };
  }
  // 7. Thanh toán một phần: mức nợ cho phép do từng viện cấu hình, mặc định phải trả đủ
  if (inv.status === "thanh toán một phần" && partialDebtThreshold > 0 && remainingOwed <= partialDebtThreshold) {
    return { enforce: false, reason: "PARTIAL_PAYMENT_WITHIN_THRESHOLD" };
  }
  // Mặc định: Ngoại trú thường chưa đóng tiền -> BẮT BUỘC CHẶN (bất kể client gửi enforcePaymentGate gì)
  return { enforce: true, reason: "OUTPATIENT_UNPAID", owed };
};

const GATE_MESSAGES = {
  INVOICE_VOIDED: "CHẶN CỔNG VIỆN PHÍ: Hóa đơn của ca chụp đã hoàn trả hoặc đã hủy. Vui lòng lập hóa đơn mới trước khi vào buồng chụp, hoặc xin bảo lãnh viện phí của Ban Giám đốc.",
  OUTPATIENT_UNPAID: "CHẶN CỔNG VIỆN PHÍ: Hóa đơn tạm tính chụp MRI chưa được thanh toán. Vui lòng hướng dẫn bệnh nhân hoàn tất thu ngân trước khi vào buồng chụp (trừ ca Cấp cứu, Nội trú/Hậu phẫu, BHYT 100%, hoặc có Bảo lãnh viện phí của Ban Giám đốc).",
};

/**
 * Đánh giá cổng viện phí của một lượt khám (đọc hóa đơn và chính sách viện) rồi ghi audit nếu được miễn.
 * Dùng chung cho mọi đường đưa bệnh nhân vào buồng chụp. Ném lỗi 402 khi bị chặn.
 */
export const assertPaymentGateOpen = async (visit, user, req = null) => {
  const inv = visit.invoiceId
    ? await Invoice.findById(visit.invoiceId)
        .select("status totalAmount patientPayAmount paidAmount paymentMethod billingType bhytInfo")
        .lean()
    : null;
  const hospital = await Hospital.findById(visit.hospitalId).select("billingPolicy").lean();
  const decision = shouldEnforcePaymentGate(visit, inv, {
    partialDebtThreshold: Number(hospital?.billingPolicy?.partialPaymentDebtThreshold || 0),
  });

  if (decision.enforce) {
    const err = new Error(GATE_MESSAGES[decision.reason] || GATE_MESSAGES.OUTPATIENT_UNPAID);
    err.statusCode = 402;
    err.code = "ERR_INVOICE_NOT_PAID";
    throw err;
  }

  if (decision.reason !== "ALREADY_PAID") {
    await recordAuditLog({
      action: AUDIT_ACTIONS.PAYMENT_GATE_BYPASSED,
      actorId: user.id || user._id || null,
      actorRole: user.role,
      hospitalId: visit.hospitalId,
      targetModel: "Visit",
      targetId: String(visit._id),
      metadata: { bypassReason: decision.reason, invoiceId: visit.invoiceId ? String(visit.invoiceId) : null },
      req,
    });
  }
  return decision;
};

// Lịch phòng phản ánh đúng ca đang chụp: nếu không, phòng cứ hiện "đã đặt" dù ca đã xong.
export const syncMriSlotWithVisit = async (visit, previousStatus) => {
  try {
    if (visit.status === "đang chụp") {
      await MriSlot.updateMany({ hospitalId: visit.hospitalId, visitId: visit._id, status: "booked" }, { $set: { status: "in_progress" } });
    } else if (previousStatus === "đang chụp") {
      await MriSlot.updateMany(
        { hospitalId: visit.hospitalId, visitId: visit._id, status: "in_progress" },
        { $set: { status: visit.status === "đã hủy" ? "cancelled" : "completed" } }
      );
    }
  } catch (err) {
    console.warn("Không đồng bộ được lịch phòng MRI:", err.message);
  }
};

/**
 * Helper: Tra cứu chỉ số eGFR gần nhất từ LIS (LabOrder) của bệnh nhân
 */
export const findLatestPatientEgfr = async (hospitalId, patientId) => {
  if (!patientId) return null;
  try {
    const latestOrder = await LabOrder.findOne({
      hospitalId,
      patient_id: patientId,
      status: { $in: ["RESULTED", "VERIFIED", "COMPLETED"] },
      "results.biomarker_code": { $regex: /^e?gfr$/i }
    })
      .sort({ ordered_at: -1, createdAt: -1 })
      .lean();
    if (!latestOrder || !Array.isArray(latestOrder.results)) return null;
    const egfrItem = latestOrder.results.find(r => /^e?gfr$/i.test(String(r.biomarker_code || "")));
    return egfrItem && Number.isFinite(Number(egfrItem.value_result)) ? Number(egfrItem.value_result) : null;
  } catch {
    return null;
  }
};

/**
 * Service: Lấy danh sách nhân sự (Bác sĩ, Điều dưỡng, KTV) kèm tải hàng đợi trong ngày
 */
export const getStaffService = async ({ hospitalId }) => {
  if (!hospitalId) {
    const err = new Error("Bạn chưa được gán vào bệnh viện nào.");
    err.statusCode = 403;
    throw err;
  }

  const [doctorsList, nurses, dbTechnicians, radiologists] = await Promise.all([
    User.find({ hospitalId, role: { $in: ["doctor", "department_head"] } }).select("profile email role departmentId").lean(),


    User.find({ hospitalId, role: { $in: ["nurse", "receptionist"] } }).select("profile email role"),
    User.find({ hospitalId, role: "technician" }).select("profile email role"),
    User.find({ hospitalId, role: "radiologist" }).select("profile email role departmentId").lean(),
  ]);

  const { startOfDay } = getDayRangeVN();

  const activeVisits = await Visit.find({
    hospitalId,
    status: { $in: ["đang chờ", "đang khám"] },
    createdAt: { $gte: startOfDay }
  }).select("doctorId").lean();

  const queueMap = {};
  activeVisits.forEach(v => {
    if (v.doctorId) {
      const docId = v.doctorId.toString();
      queueMap[docId] = (queueMap[docId] || 0) + 1;
    }
  });

  const doctors = doctorsList.map(doc => ({
    ...doc,
    queueSize: queueMap[doc._id.toString()] || 0
  }));

  const technicians = dbTechnicians.length > 0 ? dbTechnicians : doctors;
  return { doctors, nurses, technicians, radiologists };
};

/**
 * Service: Lễ tân tạo lượt khám mới
 */
export const createVisitService = async ({ hospitalId, userId, patientId, doctorId, nurseId, reason, visitType }) => {
  if (!hospitalId) {
    const err = new Error("Bạn chưa được gán vào bệnh viện nào.");
    err.statusCode = 403;
    throw err;
  }

  if (!patientId || !doctorId || !nurseId) {
    const err = new Error("Vui lòng cung cấp bệnh nhân, bác sĩ và điều dưỡng.");
    err.statusCode = 400;
    throw err;
  }

  const { startOfDay, endOfDay } = getDayRangeVN();

  const [visitCountToday, hospital] = await Promise.all([
    Visit.countDocuments({
      hospitalId,
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    }),
    Hospital.findById(hospitalId)
  ]);

  const maxPatients = hospital?.pricing?.maxPatients ?? 50;
  if (visitCountToday >= maxPatients) {
    const err = new Error(`Đã đạt số lượng bệnh nhân tối đa trong ngày (${maxPatients} bệnh nhân)!`);
    err.statusCode = 400;
    throw err;
  }

  const visit = new Visit({
    hospitalId,
    patientId,
    doctorId,
    nurseId,
    reason,
    visitType: visitType || "Ngoại trú",
    status: "đang chờ"
  });

  await visit.save();

  // Tự động tạo task quy trình nếu có
  try {
    const { createTasksForVisit } = await import("../controllers/task.controller.js");
    await createTasksForVisit(visit._id, hospitalId);
  } catch (taskErr) {
    console.warn("⚠️ Không thể tự động tạo task quy trình:", taskErr.message);
  }

  // Gửi thông báo cho bác sĩ và điều dưỡng
  try {
    const patient = await User.findById(patientId).lean();
    const patientName = patient?.profile?.name || patient?.profile?.fullName || "Bệnh nhân";

    await createNotificationInternal({
      hospitalId,
      recipientId: doctorId,
      senderId: userId,
      type: "new_visit",
      title: "🩺 Lượt khám mới",
      message: `Bệnh nhân ${patientName} đang ở hàng đợi của bạn. Lý do khám: "${reason || 'Kiểm tra thần kinh'}".`,
      relatedId: visit._id,
    });

    await createNotificationInternal({
      hospitalId,
      recipientId: nurseId,
      senderId: userId,
      type: "new_visit",
      title: "🏥 Phân công hỗ trợ khám",
      message: `Hỗ trợ bác sĩ khám bệnh nhân ${patientName}. Chuẩn bị đo sinh hiệu khi bệnh nhân vào phòng.`,
      relatedId: visit._id,
    });
  } catch (notifErr) {
    console.warn("⚠️ Không thể gửi thông báo khi tạo lượt khám:", notifErr.message);
  }

  return visit;
};

/**
 * Service: Lấy danh sách hàng đợi theo vai trò người dùng (Bác sĩ, KTV, ĐD)
 */
export const getMyQueueService = async ({ role, id, hospitalId, query = {} }) => {
  if (!hospitalId) {
    const err = new Error("Bạn chưa được gán vào bệnh viện nào.");
    err.statusCode = 403;
    throw err;
  }

  let filter = { hospitalId };
  const { startOfDay } = getDayRangeVN();

  if (role === "doctor") {
    filter.$or = [
      { doctorId: id },
      { 
        status: { $in: ["chờ chụp", "chờ chụp lại", "chờ chụp sau phẫu thuật", "đang chụp", "chờ kết quả AI", "chờ bác sĩ đọc", "chờ hội chẩn", "chờ nhập viện", "tái khám định kỳ", "hoàn tất"] },
        "mriOrder.orderedAt": { $exists: true }
      }
    ];
  } else if (role === "radiologist") {
    filter.status = { $in: ["đang chụp", "chờ kết quả AI", "chờ bác sĩ đọc", "chờ hội chẩn", "hoàn tất"] };
    filter["mriOrder.orderedAt"] = { $exists: true };
  } else if (role === "department_head") {
    filter.$or = [
      { doctorId: id },
      { status: { $in: ["đang chờ", "đang khám", "chờ chụp", "chờ chụp lại", "chờ chụp sau phẫu thuật", "đang chụp", "chờ kết quả AI", "chờ bác sĩ đọc", "chờ hội chẩn", "chờ nhập viện", "tái khám định kỳ", "hoàn tất"] } }
    ];
  } else if (role === "nurse") {
    filter.$or = [
      { nurseId: id, status: "đang chờ", hospitalId },
      { createdAt: { $gte: startOfDay }, hospitalId }
    ];
  } else if (role === "technician") {
    filter.$or = [
      { technicianId: id },
      { technicianId: null },
      { technicianId: { $exists: false } }
    ];
    filter.status = { $in: ["chờ chụp", "chờ chụp lại", "chờ chụp sau phẫu thuật", "đang chụp", "chờ kết quả AI", "chờ bác sĩ đọc", "chờ hội chẩn", "chờ nhập viện", "tái khám định kỳ", "hoàn tất"] };
  }

  if (role === "receptionist" || role === "admin" || role === "hospital_admin" || query.today === "true") {
    filter.createdAt = { $gte: startOfDay };
  }

  if (query.status) {
    filter.status = query.status;
  }

  const visits = await Visit.find(filter)
    .populate("patientId", "email profile")
    .populate("doctorId", "profile.name profile.fullName")
    .populate("nurseId", "profile.name profile.fullName")
    .populate("technicianId", "profile.name profile.fullName")
    .populate("invoiceId", "status totalAmount items paymentMethod paidAt")
    .sort({ createdAt: -1 });

  return visits;
};

/**
 * Service: Cập nhật sinh hiệu bệnh nhân
 */
export const updateVitalsService = async ({ visitId, hospitalId, vitals, keepWaitingStatus = false }) => {
  const visit = await Visit.findById(visitId);
  if (!visit) {
    const err = new Error("Không tìm thấy lượt khám");
    err.statusCode = 404;
    throw err;
  }
  
  if (visit.hospitalId.toString() !== hospitalId.toString()) {
    const err = new Error("Không có quyền thao tác");
    err.statusCode = 403;
    throw err;
  }

  let patientContext = {};
  if (visit.patientId) {
    if (typeof visit.patientId === 'object') {
      patientContext = {
        age: vitals.age ?? visit.patientId.profile?.age ?? visit.patientId.age,
        gender: vitals.gender ?? visit.patientId.profile?.gender ?? visit.patientId.gender,
        birthYear: vitals.birthYear ?? visit.patientId.profile?.birthYear
      };
    } else {
      patientContext = {
        age: vitals.age,
        gender: vitals.gender,
        birthYear: vitals.birthYear
      };
    }
  }

  const evaluation = evaluateVitalSigns(vitals, patientContext);

  visit.vitals = {
    ...vitals,
    measuredAt: new Date(),
    isAbnormal: evaluation.isAbnormal,
    alerts: evaluation.alertMessages,
    alertDetails: evaluation.alerts,
    flags: evaluation.flags,
    patientContext: evaluation.patientContext
  };

  if (evaluation.isAbnormal && evaluation.alerts.some(a => a.severity === 'danger')) {
    if (['thấp', 'trung bình'].includes(visit.priority)) {
      visit.priority = 'cao';
    }
  }

  if (visit.status === "đang chờ" && !keepWaitingStatus) {
    visit.status = "đang khám";
  }

  await visit.save();
  return { visit, evaluation };
};

/**
 * Service: Ra y lệnh chụp MRI và tạo hóa đơn tạm tính
 */
export const createMriOrderService = async ({
  visitId,
  hospitalId,
  userId,
  technicianId,
  region,
  instructions,
  requestAiAnalysis,
  withContrast,
  clinicalScenario,
  protocolCode,
  priorStudyId,
  creatinineEgfr,
  slotId
}) => {
  const visit = await Visit.findById(visitId);
  if (!visit) {
    const err = new Error("Không tìm thấy lượt khám");
    err.statusCode = 404;
    throw err;
  }

  if (visit.hospitalId.toString() !== hospitalId.toString()) {
    const err = new Error("Không có quyền thao tác lượt khám này.");
    err.statusCode = 403;
    throw err;
  }

  if (technicianId) {
    const technician = await User.findOne({ _id: technicianId, hospitalId, role: { $in: ["technician", "doctor"] } });
    if (!technician) {
      const err = new Error("Kỹ thuật viên không hợp lệ hoặc không thuộc bệnh viện này.");
      err.statusCode = 400;
      throw err;
    }
  }

  let resolvedEgfr = creatinineEgfr !== undefined && creatinineEgfr !== null ? Number(creatinineEgfr) : null;
  if (withContrast && resolvedEgfr === null) {
    resolvedEgfr = await findLatestPatientEgfr(hospitalId, visit.patientId);
  }

  let resolvedPriorStudyId = priorStudyId || null;
  if (!resolvedPriorStudyId && ["surveillance_rano", "post_op_72h"].includes(clinicalScenario)) {
    try {
      const patientDoc = await User.findById(visit.patientId).select("profile.medicalId").lean();
      const priorVisits = await Visit.find({ hospitalId, patientId: visit.patientId, _id: { $ne: visit._id } }).select("_id").lean();
      const orClauses = [
        ...(patientDoc?.profile?.medicalId ? [{ medicalId: patientDoc.profile.medicalId }] : []),
        ...(priorVisits.length > 0 ? [{ visitId: { $in: priorVisits.map((pv) => pv._id) } }] : []),
        { patientUserId: visit.patientId }
      ];
      const prior = await ImagingResult.findOne({ hospitalId, isSigned: true, $or: orClauses }).sort({ reportDate: -1, createdAt: -1 }).select("_id").lean();
      if (prior) resolvedPriorStudyId = prior._id;


      if (prior) resolvedPriorStudyId = prior._id;
      if (prior) resolvedPriorStudyId = prior._id;
    } catch { /* ignore */ }
  }

  visit.technicianId = technicianId;
  visit.mriOrder = {
    region: region || "Sọ não",
    instructions: instructions || "",
    requestAiAnalysis: Boolean(requestAiAnalysis),
    withContrast: Boolean(withContrast),
    clinicalScenario: ["initial_diagnosis", "pre_op", "post_op_72h", "surveillance_rano"].includes(clinicalScenario)
      ? clinicalScenario
      : "initial_diagnosis",
    protocolCode: protocolCode || "BRAIN_TUMOR_STANDARD",
    mriStatus: "ordered",
    priorStudyId: resolvedPriorStudyId,
    creatinineEgfr: resolvedEgfr,
    slotId: slotId || null,
    orderedAt: new Date()
  };
  visit.status = clinicalScenario === "post_op_72h" ? "chờ chụp sau phẫu thuật" : "chờ chụp";

  // Lập hóa đơn tạm tính
  try {
    if (!visit.invoiceId) {
      const hospital = await Hospital.findById(visit.hospitalId);
      const examFee = hospital?.pricing?.examFee ?? 50000;
      const mriFee = hospital?.pricing?.mriFee ?? 1500000;
      const aiFee = hospital?.pricing?.aiFee ?? 200000;

      const items = [
        { description: "Khám bệnh lâm sàng", amount: examFee, type: "exam" },
        { description: `Chụp MRI vùng ${region || "Não bộ"}`, amount: mriFee, type: "mri" },
      ];
      if (requestAiAnalysis) {
        items.push({ description: "Phân tích AI hỗ trợ chẩn đoán", amount: aiFee, type: "ai" });
      }
      const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

      const draftInvoice = new Invoice({
        hospitalId: visit.hospitalId,
        patientId: visit.patientId,
        visitId: visit._id,
        items,
        totalAmount,
        status: "chờ thanh toán"
      });
      await draftInvoice.save();
      visit.invoiceId = draftInvoice._id;
    } else {
      const existingInvoice = await Invoice.findById(visit.invoiceId);
      if (existingInvoice && existingInvoice.status === "chờ thanh toán") {
        const hospital = await Hospital.findById(visit.hospitalId);
        const mriFee = hospital?.pricing?.mriFee ?? 1500000;
        const aiFee = hospital?.pricing?.aiFee ?? 200000;
        if (!existingInvoice.items.some((i) => i.type === "mri")) {
          existingInvoice.items.push({ description: `Chụp MRI vùng ${region || "Não bộ"}`, amount: mriFee, type: "mri" });
        }
        if (requestAiAnalysis && !existingInvoice.items.some((i) => i.type === "ai")) {
          existingInvoice.items.push({ description: "Phân tích AI hỗ trợ chẩn đoán", amount: aiFee, type: "ai" });
        }
        existingInvoice.totalAmount = existingInvoice.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        await existingInvoice.save();
      }
    }
  } catch (invErr) {
    console.warn("⚠️ Không thể tạo hóa đơn tạm tính khi ra y lệnh MRI:", invErr.message);
  }

  await visit.save();
  return visit;
};

const SAFETY_ANSWER_FIELDS = ["hasPacemakerOrMetal", "hasClaustrophobia", "hasKidneyDisease", "isPregnant"];
const MRI_REVIEW_ROLES = ["doctor", "department_head", "radiologist"];
const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 });

/** eGFR gửi lên phải là số hữu hạn. Chuỗi rỗng, chữ hay object bị từ chối thay vì thành NaN hoặc 0. */
export const parseEgfrInput = (value) => {
  if (value === undefined || value === null) return null;
  const num = typeof value === "number" ? value : (typeof value === "string" && value.trim() !== "" ? Number(value) : NaN);
  if (!Number.isFinite(num)) throw badRequest("Chỉ số eGFR không hợp lệ: phải là số (mL/phút/1.73m²).");
  return num;
};

const logMriSafetyCheck = async (visit, user, result) => {
  const c = visit.mriSafetyChecklist || {};
  try {
    await recordAuditLog({
      action: AUDIT_ACTIONS.MRI_SAFETY_CHECKLIST_SUBMITTED,
      entity: "Visit",
      entityId: String(visit._id),
      performedBy: String(user.id || user._id || "system"),
      hospitalId: visit.hospitalId,
      details: `Bảng kiểm an toàn MRI (${user.role}): ${result}. Kim loại=${c.hasPacemakerOrMetal}, sợ buồng kín=${c.hasClaustrophobia}, thận=${c.hasKidneyDisease}, thai=${c.isPregnant}${c.overrideReason ? `, lý do xác nhận: ${c.overrideReason}` : ""}${c.mrConditionalDocFileId ? `, giấy MR-conditional: ${c.mrConditionalDocFileId}` : ""}.`,
      payload: { result, status: visit.status, hasPacemakerOrMetal: c.hasPacemakerOrMetal, hasClaustrophobia: c.hasClaustrophobia, hasKidneyDisease: c.hasKidneyDisease, isPregnant: c.isPregnant, passed: c.passed, overrideReason: c.overrideReason || "", mrConditionalDocFileId: c.mrConditionalDocFileId || "" },
    });
  } catch (err) {
    console.warn("Không ghi được nhật ký bảng kiểm an toàn MRI:", err.message);
  }
};

/**
 * Service: Thẩm định Bảng kiểm An toàn MRI (MRI Safety Screening)
 */
export const submitMriSafetyCheckService = async ({ visitId, hospitalId, user, checklistData }) => {
  // Spec: KTV phải trả lời đủ 4 câu. Thiếu câu hoặc sai kiểu không được hiểu là "không có".
  if (SAFETY_ANSWER_FIELDS.some((k) => typeof checklistData?.[k] !== "boolean")) {
    throw badRequest("Bảng kiểm an toàn MRI chưa trả lời đủ 4 câu (Có/Không). Vui lòng hỏi lại bệnh nhân từng câu.");
  }
  if (checklistData.overrideReason !== undefined && checklistData.overrideReason !== null && typeof checklistData.overrideReason !== "string") {
    throw badRequest("Lý do xác nhận phải là văn bản.");
  }
  const submittedEgfr = parseEgfrInput(checklistData.creatinineEgfr);

  const {
    hasPacemakerOrMetal,
    hasClaustrophobia,
    hasKidneyDisease,
    isPregnant,
    metalDetails,
    notes,
    screeningDeclaredAt,
    overrideReason
  } = checklistData;

  const visit = await Visit.findById(visitId);
  if (!visit) {
    const err = new Error("Không tìm thấy lượt khám tương ứng.");
    err.statusCode = 404;
    throw err;
  }

  if (visit.hospitalId.toString() !== hospitalId.toString()) {
    const err = new Error("Không có quyền thao tác lượt khám này.");
    err.statusCode = 403;
    throw err;
  }

  // Bệnh nhân có tự khai phiếu sàng lọc trên app: KTV phải xác nhận đúng bản lời khai mới nhất
  // (bệnh nhân sửa phiếu sau khi KTV mở bảng kiểm → bảng kiểm đang dựa trên lời khai cũ)
  const declaredAt = visit.patientMriScreening?.declaredAt;
  if (declaredAt && new Date(screeningDeclaredAt || 0).getTime() !== new Date(declaredAt).getTime()) {
    const err = new Error("Bệnh nhân vừa cập nhật phiếu tự khai sàng lọc MRI. Hãy mở lại bảng kiểm để xem lời khai mới nhất.");
    err.statusCode = 409;
    throw err;
  }

  // Chống chỉ định đã ghi nhận thì không xóa được bằng cách gửi lại "không": hủy ca, hoặc bác sĩ xác nhận ghi đè
  const prior = visit.mriSafetyChecklist;
  if (prior?.isScreened && prior.hasPacemakerOrMetal && !prior.passed && hasPacemakerOrMetal !== true) {
    const err = new Error("Ca này đã được ghi nhận chống chỉ định kim loại hoặc máy tạo nhịp. Hãy hủy ca chụp, hoặc bác sĩ xác nhận lại trong bảng kiểm.");
    err.statusCode = 409;
    throw err;
  }

  // Hai người gửi bảng kiểm cùng lúc: chỉ lưu khi trạng thái và bảng kiểm chưa đổi kể từ lúc đọc (lệnh ghi có điều kiện)
  const readGuard = { status: visit.status, "mriSafetyChecklist.screenedAt": prior?.screenedAt ?? null };
  const guardedSave = async () => {
    visit.$where = readGuard;
    try {
      await visit.save();
    } catch (err) {
      if (err?.name === "DocumentNotFoundError") {
        const conflict = new Error("Bảng kiểm an toàn MRI vừa được người khác cập nhật. Hãy tải lại và kiểm tra lại.");
        conflict.statusCode = 409;
        throw conflict;
      }
      throw err;
    }
  };

  // ── AN TOÀN NGƯỜI BỆNH (P0-1): máy chủ TỰ quyết định, KHÔNG tin `passed` do client gửi lên ──
  // Trước đây `{ hasPacemakerOrMetal: true, passed: true }` bypass được chống chỉ định tuyệt đối.
  const screening = visit.patientMriScreening?.answers || {};
  const patientDeclaredPacemaker = screening.pacemaker === 'yes';
  const metalFlagged = Boolean(hasPacemakerOrMetal) || patientDeclaredPacemaker;
  const pregnant = Boolean(isPregnant) || screening.pregnant === 'yes';
  const withContrast = Boolean(visit.mriOrder?.withContrast);

  // Kiểm tra tự động chỉ số eGFR từ LIS nếu ca chụp có tiêm thuốc đối quang từ Gadolinium
  let egfrValue = submittedEgfr ?? (visit.mriOrder?.creatinineEgfr ?? null);
  if (withContrast && egfrValue === null) {
    egfrValue = await findLatestPatientEgfr(hospitalId, visit.patientId);
    if (egfrValue !== null && visit.mriOrder) {
      visit.mriOrder.creatinineEgfr = egfrValue;
    }
  }
  const egfrLowRisk = withContrast && egfrValue !== null && egfrValue < 30;
  const kidneyDisease = Boolean(hasKidneyDisease) || egfrLowRisk;

  // Kiểm tra Cổng Viện phí (Payment Gate) bắt buộc phía Server (Q-BILLING-01 / BUG-VISIT-001)
  // Lưu ý: Không bao giờ tin cờ `checklistData.enforcePaymentGate = false` từ client!
  await assertPaymentGateOpen(visit, user);

  // Kim loại/thiết bị cấy ghép: chỉ Bác sĩ CĐHA được ghi đè, phải có lý do chuyên môn và giấy xác nhận MR-conditional
  // đã tải lên cho đúng ca này (lưu vết). Máy tạo nhịp tim (bệnh nhân tự khai) là chống chỉ định tuyệt đối — KHÔNG có ngoại lệ.
  const overrideReasonText = String(overrideReason || "").trim();
  const allowedToOverride = user.role === 'radiologist' && !patientDeclaredPacemaker;
  const hasOverride = metalFlagged && allowedToOverride && overrideReasonText.length >= 10;
  let mrConditionalDocFileId = "";
  if (hasOverride) {
    const docId = typeof checklistData.mrConditionalDocFileId === "string" ? checklistData.mrConditionalDocFileId.trim() : "";
    const doc = docId
      ? await StoredMedicalFile.findOne({ fileId: docId, hospitalId: visit.hospitalId, studyId: String(visit._id) }).select("fileId").lean()
      : null;
    if (!doc) throw badRequest("Cần tải lên giấy xác nhận thiết bị MR-conditional của ca này trước khi ghi đè chống chỉ định.");
    mrConditionalDocFileId = doc.fileId;
  }
  const isSafe = !metalFlagged || hasOverride;

  // Suy thận + có cản quang, hoặc đang mang thai: cần bác sĩ xác nhận trước khi vào buồng.
  // Bác sĩ tự làm bảng kiểm vẫn phải ghi lý do xác nhận (spec S.1: override với xác nhận lý do).
  const needsReview = pregnant || (kidneyDisease && withContrast);
  const isReviewer = MRI_REVIEW_ROLES.includes(user.role);
  const doctorConfirmed = isSafe && !hasOverride && needsReview && isReviewer && overrideReasonText.length >= 10;
  const requiresDoctorReview = isSafe && !hasOverride && needsReview && !doctorConfirmed;
  const recordedReason = hasOverride || doctorConfirmed;

  const screenerName = user.profile?.fullName || user.profile?.name || user.email || "Kỹ thuật viên";

  visit.mriSafetyChecklist = {
    hasPacemakerOrMetal: metalFlagged,
    hasClaustrophobia: Boolean(hasClaustrophobia),
    hasKidneyDisease: kidneyDisease,
    isPregnant: pregnant,
    metalDetails: metalDetails || "",
    isScreened: true,
    screenedBy: screenerName,
    screenedAt: new Date(),
    passed: isSafe && !requiresDoctorReview,
    notes: notes || (egfrLowRisk ? `Cảnh báo LIS tự động: eGFR = ${egfrValue} mL/phút/1.73m² (< 30) — Nguy cơ xơ hóa hệ thống do thận (NSF) khi tiêm Gadolinium.` : ""),
    overrideReason: recordedReason ? overrideReasonText : "",
    overriddenBy: recordedReason ? (user.id || user._id || null) : null,
    overriddenByName: recordedReason ? screenerName : "",
    overriddenAt: recordedReason ? new Date() : null,
    mrConditionalDocFileId: hasOverride ? mrConditionalDocFileId : ""
  };

  // Phát hiện chống chỉ định tuyệt đối chưa được bác sĩ chấp thuận -> chặn ngay
  if (!isSafe) {
    await guardedSave();
    await logMriSafetyCheck(visit, user, "chống chỉ định");
    const err = new Error("CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI: Bệnh nhân mang máy tạo nhịp tim hoặc mảnh kim loại từ tính! Không được phép đưa vào buồng chụp từ trường 1.5T/3T. Nếu thiết bị là MR-conditional, Bác sĩ CĐHA xác nhận kèm lý do và giấy xác nhận.");
    err.statusCode = 400;
    err.checklist = visit.mriSafetyChecklist;
    err.visit = visit;
    throw err;
  }

  // Nếu an toàn, tự động chuyển sang 'đang chụp' — trừ khi có tiêm cản quang mà bệnh nhân chưa ký phiếu (UC-PAT-06)
  // hoặc trường hợp cần bác sĩ xác nhận (thai kỳ / suy thận + cản quang).
  const consentPending = await contrastConsentPending(visit);
  const contrastBlocked = consentPending ? null : await contrastRiskBlockMessage(visit);
  if (isSafe && !requiresDoctorReview && !consentPending && !contrastBlocked && ['chờ chụp', 'chờ chụp lại', 'chờ chụp sau phẫu thuật'].includes(visit.status)) {
    visit.status = 'đang chụp';
    if (visit.mriOrder) visit.mriOrder.mriStatus = 'scanning';
  } else if (visit.mriOrder && isSafe) {
    visit.mriOrder.mriStatus = 'safety_checked';
  }

  await guardedSave();
  // Đồng bộ lịch phòng sau khi lưu thành công, để lần lưu bị từ chối không làm lệch lịch
  if (visit.status === 'đang chụp') await syncMriSlotWithVisit(visit, null);
  await logMriSafetyCheck(visit, user, requiresDoctorReview ? "cần bác sĩ xác nhận" : visit.status === "đang chụp" ? "đạt, vào buồng chụp" : "đạt, chờ điều kiện khác");
  // Bác sĩ CĐHA ghi đè chống chỉ định kim loại: báo mọi Trưởng khoa của viện
  if (hasOverride) {
    const heads = await User.find({ hospitalId: visit.hospitalId, role: "department_head", isLocked: { $ne: true } }).select("_id").lean();
    for (const head of heads) {
      await createNotificationInternal({
        hospitalId: visit.hospitalId,
        recipientId: head._id,
        senderId: user.id || user._id || null,
        type: "other",
        title: "Bác sĩ CĐHA ghi đè chống chỉ định MRI",
        message: `${screenerName} cho phép chụp MRI dù có thiết bị kim loại (MR-conditional). Lý do: ${overrideReasonText}`,
        relatedId: visit._id,
      });
    }
  }
  // Spec S.1: có yếu tố nguy cơ thì cảnh báo bác sĩ chỉ định
  if (requiresDoctorReview && visit.doctorId && String(visit.doctorId) !== String(user.id || user._id)) {
    await createNotificationInternal({
      hospitalId: visit.hospitalId,
      recipientId: visit.doctorId,
      senderId: user.id || user._id || null,
      type: "other",
      title: "Ca chụp MRI cần bác sĩ xác nhận",
      message: "Bảng kiểm an toàn MRI có yếu tố nguy cơ (thai kỳ hoặc suy thận khi có cản quang). Bác sĩ cần xác nhận kèm lý do trước khi đưa bệnh nhân vào buồng chụp.",
      relatedId: visit._id,
    });
  }
  return {
    checklist: visit.mriSafetyChecklist,
    visit,
    contrastConsentPending: consentPending,
    contrastBlocked: Boolean(contrastBlocked),
    reviewReasonRequired: requiresDoctorReview && isReviewer,
    requiresDoctorReview,
    paymentPending: false,
    creatinineEgfr: egfrValue
  };
};

/**
 * Service: Yêu cầu chụp lại do ảnh bị nhiễu động (Motion Artifact)
 */
export const requestMriRescanService = async ({ visitId, hospitalId, user, reason }) => {
  if (!reason || !reason.trim()) {
    const err = new Error("Vui lòng cung cấp lý do chuyên môn cần chụp lại (ví dụ: Bệnh nhân cử động đầu gây nhòe ảnh).");
    err.statusCode = 400;
    throw err;
  }

  const visit = await Visit.findById(visitId);
  if (!visit) {
    const err = new Error("Không tìm thấy lượt khám.");
    err.statusCode = 404;
    throw err;
  }

  if (visit.hospitalId.toString() !== hospitalId.toString()) {
    const err = new Error("Không có quyền thao tác lượt khám này.");
    err.statusCode = 403;
    throw err;
  }

  visit.status = 'chờ chụp lại';
  visit.mriRescanReason = reason.trim();
  visit.mriRescanRequestedAt = new Date();
  visit.mriRescanRequestedBy = user.id;
  if (visit.mriOrder) {
    visit.mriOrder.mriStatus = 'ordered';
  }

  if (visit.mriSafetyChecklist) {
    visit.mriSafetyChecklist.isScreened = false;
    visit.mriSafetyChecklist.passed = false;
  }

  await visit.save();

  // Gửi thông báo đến Bác sĩ chỉ định
  if (visit.doctorId) {
    try {
      const patient = await User.findById(visit.patientId).lean();
      const patientName = patient?.profile?.name || patient?.profile?.fullName || "Bệnh nhân";

      await createNotificationInternal({
        hospitalId: visit.hospitalId,
        recipientId: visit.doctorId,
        senderId: user.id,
        type: "mri_order",
        title: "🔄 Yêu cầu chụp lại MRI",
        message: `Ca chụp MRI của bệnh nhân ${patientName} cần chụp lại. Lý do: "${reason.trim()}".`,
        relatedId: visit._id,
      });
    } catch (notifErr) {
      console.warn("⚠️ Không thể gửi thông báo yêu cầu chụp lại:", notifErr.message);
    }
  }

  return visit;
};

/**
 * Service: Hủy ca chụp MRI (hỗ trợ hoàn trả về bác sĩ khám + tự động gỡ phí MRI/AI khỏi hóa đơn tạm tính)
 */
export const cancelMriOrderService = async ({ visitId, hospitalId, user, reason, returnToDoctor = false }) => {
  if (!reason || !reason.trim()) {
    const err = new Error("Vui lòng cung cấp lý do hủy ca chụp MRI.");
    err.statusCode = 400;
    throw err;
  }

  const visit = await Visit.findById(visitId);
  if (!visit) {
    const err = new Error("Không tìm thấy lượt khám.");
    err.statusCode = 404;
    throw err;
  }

  if (visit.hospitalId.toString() !== hospitalId.toString()) {
    const err = new Error("Không có quyền thao tác lượt khám này.");
    err.statusCode = 403;
    throw err;
  }

  visit.status = returnToDoctor ? 'đang khám' : 'đã hủy';
  visit.mriCancelReason = reason.trim();
  visit.mriCancelledAt = new Date();
  visit.mriCancelledBy = user.id || user._id || null;
  if (visit.mriOrder) {
    visit.mriOrder.mriStatus = 'cancelled';
  }

  // Tự động điều chỉnh hóa đơn tạm tính: gỡ phí chụp MRI & phân tích AI nếu chưa thanh toán
  try {
    const invoiceQuery = visit.invoiceId ? { _id: visit.invoiceId } : { visitId: visit._id, status: "chờ thanh toán" };
    const draftInvoice = await Invoice.findOne(invoiceQuery);
    if (draftInvoice && draftInvoice.status === "chờ thanh toán" && Array.isArray(draftInvoice.items)) {
      const filteredItems = draftInvoice.items.filter(item => !["mri", "ai"].includes(item.type));
      if (filteredItems.length !== draftInvoice.items.length) {
        draftInvoice.items = filteredItems;
        draftInvoice.totalAmount = filteredItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        await draftInvoice.save();
      }
    }
  } catch (invErr) {
    console.warn("⚠️ Không thể điều chỉnh hóa đơn tạm tính khi hủy lệnh MRI:", invErr.message);
  }

  // Giải phóng MriSlot nếu ca chụp có giữ slot
  if (visit.mriOrder?.slotId) {
    try {
      const { MriSlot } = await import("../models/mriSlot.model.js");
      await MriSlot.findByIdAndUpdate(visit.mriOrder.slotId, {
        status: "available",
        visitId: null,
        patientId: null
      });
    } catch { /* ignore if slot model unavailable */ }
  }

  await visit.save();

  if (visit.doctorId) {
    try {
      const patient = await User.findById(visit.patientId).lean();
      const patientName = patient?.profile?.name || patient?.profile?.fullName || "Bệnh nhân";

      await createNotificationInternal({
        hospitalId: visit.hospitalId,
        recipientId: visit.doctorId,
        senderId: user.id,
        type: "mri_order",
        title: "✕ Ca chụp MRI đã bị hủy",
        message: `Ca chụp MRI của bệnh nhân ${patientName} đã bị hủy. Lý do: "${reason.trim()}". Đề nghị bác sĩ xem xét chỉ định khác.`,
        relatedId: visit._id,
      });
    } catch (notifErr) {
      console.warn("⚠️ Không thể gửi thông báo hủy ca MRI:", notifErr.message);
    }
  }

  return visit;
};
