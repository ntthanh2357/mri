import * as service from "../services/patientRecord.service.js";
import { toPublicIdentity } from "../services/patientIdentity.service.js";
import { User } from "../models/user.model.js";
import { MedicineReminder } from "../models/medicineReminder.model.js";
import { successResponse, errorResponse } from "../utils/response.util.js";
import { checkPatientTenancy } from "../utils/tenancy.util.js";
import { getDayRangeVN } from "../utils/date.util.js";
import * as reminderService from "../services/medicineReminder.service.js";

const getTargetPatientId = async (req) => {
  if (req.user && req.user.role !== 'patient') {
    const patientId = req.query.patientId || req.body.patientId || req.user.id;
    if (patientId !== req.user.id) {
      // [BUG-03 FIX]: BẢO VỆ BỆNH NHÂN B2C KHỎI IDOR BẰNG TENANCY CHUẨN HÓA
      const authorizedPatient = await checkPatientTenancy(patientId, req.user);
      if (!authorizedPatient) {
        throw { status: 403, message: "Không tìm thấy bệnh nhân hoặc không có quyền truy cập hồ sơ." };
      }
    }
    return patientId;
  }
  return req.user ? req.user.id : null;
};

// ── Identity ──────────────────────────────────────────────────────────────────

// Nhân viên tiếp đón cần xem đủ số thẻ để đối chiếu với thẻ thật; người khác chỉ thấy dạng che
const CARD_REVIEW_ROLES = ["receptionist", "nurse", "hospital_admin", "admin"];
const canReviewCard = (req) => CARD_REVIEW_ROLES.includes(req.user?.role);

export const getIdentity = async (req, res, next) => {
  try {
    const targetId = await getTargetPatientId(req);
    const profile = await service.getOrCreateProfile(targetId);
    return successResponse(res, toPublicIdentity(profile, { revealCard: canReviewCard(req) }));
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const updateIdentity = async (req, res, next) => {
  try {
    const targetId = await getTargetPatientId(req);
    const profile = await service.updateProfile(targetId, req.body);
    return successResponse(res, toPublicIdentity(profile, { revealCard: canReviewCard(req) }), "Cập nhật thông tin thành công.");
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status, err.errors || null);
    next(err);
  }
};

// PUT /api/v1/patient/profile/identity/bhyt-review?patientId=… { action: "verify" | "reject" }
export const reviewDeclaredBhyt = async (req, res, next) => {
  try {
    if (!canReviewCard(req)) return errorResponse(res, "Chỉ nhân viên tiếp đón được xác nhận thẻ BHYT.", 403);
    const targetId = await getTargetPatientId(req);
    const profile = await service.reviewDeclaredBhyt(targetId, req.body?.action, req.user.id);
    return successResponse(res, toPublicIdentity(profile, { revealCard: true }),
      req.body?.action === "verify" ? "Đã xác nhận thẻ BHYT." : "Đã đánh dấu thông tin thẻ BHYT chưa đúng.");
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

// ── Visits ────────────────────────────────────────────────────────────────────

export const listVisits = async (req, res, next) => {
  try {
    const targetId = await getTargetPatientId(req);
    const visits = await service.listVisits(targetId);
    return successResponse(res, visits);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const createVisit = async (req, res, next) => {
  try {
    const { facility, visitType } = req.body;
    if (!facility || !visitType) {
      return errorResponse(res, "Thiếu trường bắt buộc: facility, visitType.", 400);
    }
    const targetId = await getTargetPatientId(req);
    const visit = await service.createVisit(targetId, req.body);
    return successResponse(res, visit, "Đã tạo lượt khám.", 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const getVisit = async (req, res, next) => {
  try {
    const targetId = await getTargetPatientId(req);
    const visit = await service.getVisit(targetId, req.params.visitId);
    return successResponse(res, visit);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const updateVisit = async (req, res, next) => {
  try {
    const targetId = await getTargetPatientId(req);
    const visit = await service.updateVisit(targetId, req.params.visitId, req.body);
    return successResponse(res, visit, "Đã cập nhật lượt khám.");
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const deleteVisit = async (req, res, next) => {
  try {
    const targetId = await getTargetPatientId(req);
    await service.deleteVisit(targetId, req.params.visitId, req.user);
    return successResponse(res, null, "Đã hủy/ẩn lượt khám theo quy định y tế.");
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

// ── Documents ─────────────────────────────────────────────────────────────────

export const uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) return errorResponse(res, "Không có file được tải lên.", 400);

    const { docKey, groupKey, label } = req.body;
    if (!docKey || !groupKey || !label) {
      return errorResponse(res, "Thiếu trường: docKey, groupKey, label.", 400);
    }

    const targetId = await getTargetPatientId(req);
    const visit = await service.addDocumentUpload(targetId, req.params.visitId, {
      docKey,
      groupKey,
      label,
      fileBuffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
    });
    return successResponse(res, visit, "Tải lên tài liệu thành công.", 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    if (err.message?.includes("GCS")) return errorResponse(res, err.message, 503);
    next(err);
  }
};

export const saveManualDocument = async (req, res, next) => {
  try {
    const { docKey, groupKey, label, manualData } = req.body;
    if (!docKey || !groupKey || !label || !manualData) {
      return errorResponse(res, "Thiếu trường: docKey, groupKey, label, manualData.", 400);
    }

    const targetId = await getTargetPatientId(req);
    const visit = await service.addDocumentManual(targetId, req.params.visitId, {
      docKey,
      groupKey,
      label,
      manualData,
    });
    return successResponse(res, visit, "Đã lưu tài liệu điền tay.", 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const deleteDocument = async (req, res, next) => {
  try {
    const targetId = await getTargetPatientId(req);
    const visit = await service.deleteDocument(
      targetId,
      req.params.visitId,
      req.params.docId,
      req.user
    );
    return successResponse(res, visit, "Đã xóa tài liệu.");
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

// ── Medicine Reminders ───────────────────────────────────────────────────────

export const getTodayReminders = async (req, res, next) => {
  try {
    const targetId = await getTargetPatientId(req);
    const { startOfDay, endOfDay } = getDayRangeVN();

    const reminders = await MedicineReminder.find({
      patientId: targetId,
      date: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ time: 1 });

    return successResponse(res, reminders, "Lấy lịch trình uống thuốc hôm nay thành công.");
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

// UC-PAT-13 — giờ nhắc theo khung Sáng/Trưa/Chiều/Tối của chính bệnh nhân
// GET /api/v1/patient/reminders/settings
export const getReminderSettings = async (req, res, next) => {
  try {
    if (req.user.role !== "patient") return errorResponse(res, "Chỉ bệnh nhân mới cài giờ nhắc của mình.", 403);
    const times = await reminderService.getReminderTimes(req.user.id);
    return successResponse(res, { times, defaults: { morning: "08:00", noon: "12:00", afternoon: "17:00", evening: "20:00" } });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/patient/reminders/settings { morning, noon, afternoon, evening }
export const updateReminderSettings = async (req, res, next) => {
  try {
    if (req.user.role !== "patient") return errorResponse(res, "Chỉ bệnh nhân mới cài giờ nhắc của mình.", 403);
    const updated = await reminderService.saveReminderTimes(req.user.id, req.body, req.user.hospitalId);
    const times = await reminderService.getReminderTimes(req.user.id);
    return successResponse(res, { times, updated }, updated
      ? `Đã lưu giờ nhắc và đổi giờ ${updated} lần uống thuốc sắp tới.`
      : "Đã lưu giờ nhắc uống thuốc.");
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const markReminderDone = async (req, res, next) => {
  try {
    const targetId = await getTargetPatientId(req);
    const reminder = await MedicineReminder.findOneAndUpdate(
      { _id: req.params.id, patientId: targetId },
      { status: "done" },
      { new: true }
    );
    if (!reminder) return errorResponse(res, "Không tìm thấy lịch nhắc thuốc.", 404);
    return successResponse(res, reminder, "Đã đánh dấu đã uống thuốc.");
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const skipReminder = async (req, res, next) => {
  try {
    const targetId = await getTargetPatientId(req);
    const reminder = await MedicineReminder.findOneAndUpdate(
      { _id: req.params.id, patientId: targetId },
      { status: "skipped" },
      { new: true }
    );
    if (!reminder) return errorResponse(res, "Không tìm thấy lịch nhắc thuốc.", 404);
    return successResponse(res, reminder, "Đã bỏ qua lịch nhắc thuốc.");
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};
