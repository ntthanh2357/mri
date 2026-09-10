import { TransferForm } from "../models/transferForm.model.js";
import { Hospital } from "../models/hospital.model.js";
import { HospitalBed } from "../models/hospitalBed.model.js";
import { Visit } from "../models/visit.model.js";
import { ImagingResult } from "../models/imagingResult.model.js";
import { createNotificationInternal } from "./notification.controller.js";
import { successResponse, errorResponse } from "../utils/response.util.js";

// ─── F.1 — Kiểm tra khả năng tiếp nhận phẫu thuật & giường viện đích ─────────
// @route POST /api/v1/transfers/check-capacity
// @access Private (Doctor, Admin)
export const checkSurgeryCapacity = async (req, res) => {
  try {
    const { targetHospitalId, departmentId = "KNT" } = req.body;
    if (!targetHospitalId) return errorResponse(res, "Thiếu ID bệnh viện đích (targetHospitalId).", 400);

    const targetHospital = await Hospital.findById(targetHospitalId).lean();
    if (!targetHospital || !targetHospital.isActive) {
      return errorResponse(res, "Bệnh viện đích không tồn tại hoặc ngừng hoạt động.", 404);
    }

    // Đếm giường trống tại viện đích
    const availableBeds = await HospitalBed.countDocuments({
      hospitalId: targetHospitalId,
      departmentId,
      status: 'available'
    });

    const isAvailable = availableBeds > 0;

    return successResponse(res, {
      targetHospitalId,
      targetHospitalName: targetHospital.name,
      departmentId,
      availableBeds,
      canAccept: isAvailable,
      message: isAvailable
        ? `Bệnh viện ${targetHospital.name} có ${availableBeds} giường trống tại khoa ${departmentId}. Có thể chuyển viện.`
        : `Bệnh viện ${targetHospital.name} hiện hết giường trống tại khoa ${departmentId}. Gợi ý chuyển viện khác.`
    }, "Kiểm tra khả năng tiếp nhận thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── F.2 — Tạo yêu cầu chuyển viện + đóng gói dữ liệu ────────────────────────
// @route POST /api/v1/transfers
// @access Private (Doctor, Admin)
export const createTransferRequest = async (req, res) => {
  try {
    if (!["doctor", "admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ bác sĩ mới có thể tạo yêu cầu chuyển viện.", 403);
    }

    const hospitalId = req.user.hospitalId;
    const {
      patient_id,
      visitId,
      imagingResultId,
      targetHospitalId,
      transferTo,
      clinicalSummary,
      labSummary,
      diagnosis,
      treatment,
      drugsUsed,
      patientStatus,
      reason = "1",
      reasonDetail,
      transportation,
      escort
    } = req.body;

    if (!patient_id || !targetHospitalId) {
      return errorResponse(res, "Thiếu patient_id hoặc targetHospitalId.", 400);
    }

    // Kiểm tra bệnh viện đích
    const targetHospital = await Hospital.findById(targetHospitalId).lean();
    if (!targetHospital) return errorResponse(res, "Không tìm thấy bệnh viện đích.", 404);

    // F.2 — Đóng gói zip URL (gói chuyển viện bao gồm DICOM/AI)
    let transferPackageDriveUrl = "";
    if (imagingResultId) {
      const imagingResult = await ImagingResult.findById(imagingResultId).lean();
      transferPackageDriveUrl = imagingResult?.representativeSliceUrl || imagingResult?.segmentationUrl || "";
    }

    const transferForm = new TransferForm({
      hospitalId,
      targetHospitalId,
      patient_id,
      visitId: visitId || null,
      imagingResultId: imagingResultId || null,
      doctor_name: req.user.name || "Bác sĩ điều trị",
      transferNo: `CV-${Date.now().toString().slice(-6)}`,
      transferTo: transferTo || targetHospital.name,
      clinicalSummary: clinicalSummary || "",
      labSummary: labSummary || "",
      diagnosis: diagnosis || "",
      treatment: treatment || "",
      drugsUsed: drugsUsed || "",
      patientStatus: patientStatus || "",
      reason,
      reasonDetail: reasonDetail || "Không phù hợp khả năng chuyên môn",
      transportation: transportation || "Xe cấp cứu",
      escort: escort || "",
      transferPackageDriveUrl,
      status: 'pending',
    });
    await transferForm.save();

    // Thông báo cho admin/bác sĩ trực tại bệnh viện đích
    try {
      await notifyTargetHospital(targetHospitalId, transferForm, req.user.id);
    } catch (notifErr) {
      console.warn("⚠️ Không thể gửi thông báo chuyển viện tới viện đích:", notifErr.message);
    }

    return successResponse(res, { transferForm }, "Tạo hồ sơ chuyển viện thành công. Đã gửi tới viện đích.", 201);
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── F.3 — Viện đích chấp nhận chuyển viện + tự động giữ chỗ giường ───────────
// @route PUT /api/v1/transfers/:id/accept
// @access Private (Doctor/Admin at Target Hospital)
export const acceptTransferRequest = async (req, res) => {
  try {
    const transfer = await TransferForm.findById(req.params.id);
    if (!transfer) return errorResponse(res, "Không tìm thấy yêu cầu chuyển viện.", 404);

    if (transfer.status !== 'pending') {
      return errorResponse(res, `Yêu cầu này đã ở trạng thái: ${transfer.status}.`, 400);
    }

    // F.3 — Tự động giữ chỗ giường trống tại viện đích
    const availableBed = await HospitalBed.findOne({
      hospitalId: transfer.targetHospitalId,
      status: 'available'
    });

    if (availableBed) {
      const reservedUntil = new Date(Date.now() + 4 * 60 * 60 * 1000); // Giữ 4 tiếng
      availableBed.status = 'reserved';
      availableBed.reservedUntil = reservedUntil;
      availableBed.reservedForPatientId = transfer.patient_id;
      availableBed.reservedForVisitId = transfer.visitId;
      availableBed.reservedByUserId = req.user.id;
      await availableBed.save();

      transfer.targetBedId = availableBed._id;
    }

    transfer.status = 'accepted';
    transfer.acceptedByUserId = req.user.id;
    transfer.acceptedAt = new Date();
    await transfer.save();

    // Thông báo lại viện gửi
    try {
      const { User } = await import("../models/user.model.js");
      const sourceAdmins = await User.find({ hospitalId: transfer.hospitalId, role: { $in: ['doctor', 'admin'] } }, "_id");
      for (const admin of sourceAdmins) {
        await createNotificationInternal({
          hospitalId: transfer.hospitalId,
          recipientId: admin._id,
          senderId: req.user.id,
          type: "transfer_accepted",
          title: "✅ Chuyển viện được chấp nhận",
          message: `Viện đích đã duyệt nhận bệnh nhân. Giường số ${availableBed?.bedNumber || 'chưa xếp'} đã được giữ chỗ.`,
          relatedId: transfer._id,
        });
      }
    } catch (notifErr) {
      console.warn("⚠️ Lỗi gửi notif chuyển viện duyệt:", notifErr.message);
    }

    return successResponse(res, {
      transfer,
      reservedBed: availableBed ? { bedNumber: availableBed.bedNumber, roomNumber: availableBed.roomNumber } : null
    }, "Đã chấp nhận chuyển viện và giữ chỗ giường thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── Từ chối chuyển viện ──────────────────────────────────────────────────────
// @route PUT /api/v1/transfers/:id/reject
// @access Private
export const rejectTransferRequest = async (req, res) => {
  try {
    const transfer = await TransferForm.findById(req.params.id);
    if (!transfer) return errorResponse(res, "Không tìm thấy yêu cầu chuyển viện.", 404);

    const { reason } = req.body;
    transfer.status = 'rejected';
    transfer.rejectionReason = reason || "Bệnh viện quá tải";
    await transfer.save();

    return successResponse(res, { transfer }, "Đã từ chối yêu cầu chuyển viện.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── F.5 — Audit log danh sách chuyển viện ───────────────────────────────────
// @route GET /api/v1/transfers
// @access Private
export const getTransfers = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    const { type = 'outgoing', status } = req.query;

    const filter = type === 'incoming'
      ? { targetHospitalId: hospitalId }
      : { hospitalId };

    if (status) filter.status = status;

    const transfers = await TransferForm.find(filter)
      .populate("patient_id", "profile.name profile.fullName email")
      .populate("hospitalId", "name code")
      .populate("targetHospitalId", "name code")
      .populate("targetBedId", "bedNumber roomNumber")
      .sort({ createdAt: -1 });

    return successResponse(res, transfers, "Lấy danh sách chuyển viện thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── F.5 — Cấp token xem bệnh án liên viện tạm thời (7 ngày) ───────────────────
// @route POST /api/v1/transfers/:id/grant-cross-view
// @access Private (Doctor, Admin at Target Hospital or Source Hospital)
export const grantCrossHospitalView = async (req, res) => {
  try {
    const transfer = await TransferForm.findById(req.params.id);
    if (!transfer) return errorResponse(res, "Không tìm thấy yêu cầu chuyển viện.", 404);

    if (transfer.status !== 'accepted') {
      return errorResponse(res, "Chỉ có thể tạo token liên viện cho các ca đã được chấp nhận chuyển viện.", 400);
    }

    const { crypto } = await import("crypto");
    const accessToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 ngày

    transfer.crossHospitalToken = accessToken;
    transfer.crossHospitalTokenExpiresAt = expiresAt;
    await transfer.save();

    return successResponse(res, {
      transferId: transfer._id,
      accessToken,
      expiresAt,
      viewUrl: `/api/v1/transfers/cross-view/${accessToken}`
    }, "Cấp token xem bệnh án liên viện 7 ngày thành công (F.5).");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── Internal — Gửi notification tới viện đích ────────────────────────────────
async function notifyTargetHospital(targetHospitalId, transferForm, senderId) {
  const { User } = await import("../models/user.model.js");
  const targetDoctors = await User.find({
    hospitalId: targetHospitalId,
    role: { $in: ['doctor', 'hospital_admin'] },
    isLocked: false
  }, "_id");

  for (const doc of targetDoctors) {
    await createNotificationInternal({
      hospitalId: targetHospitalId,
      recipientId: doc._id,
      senderId,
      type: "transfer_incoming",
      title: "🚑 Yêu cầu chuyển viện mới",
      message: `Có yêu cầu chuyển viện mới (Mã: ${transferForm.transferNo}). Vui lòng xem xét duyệt.`,
      relatedId: transferForm._id,
    });
  }
}
