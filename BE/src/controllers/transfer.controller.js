import crypto from "crypto";
import { TransferForm } from "../models/transferForm.model.js";
import { Hospital } from "../models/hospital.model.js";
import { HospitalBed } from "../models/hospitalBed.model.js";
import { Visit } from "../models/visit.model.js";
import { ImagingResult } from "../models/imagingResult.model.js";
import { createNotificationInternal } from "./notification.controller.js";
import { successResponse, errorResponse } from "../utils/response.util.js";
import { recordAuditLog, AUDIT_ACTIONS } from "../services/auditLog.service.js";

// ─── F.1 — Kiểm tra khả năng tiếp nhận phẫu thuật & giường viện đích ─────────
// @route POST /api/v1/transfers/check-capacity
// @access Private (Doctor, Admin)
export const checkSurgeryCapacity = async (req, res) => {
  try {
    const { targetHospitalId, departmentId = "KUTN-SURG" } = req.body;
    if (!targetHospitalId) return errorResponse(res, "Thiếu ID bệnh viện đích (targetHospitalId).", 400);

    const targetHospital = await Hospital.findById(targetHospitalId).lean();
    if (!targetHospital || !targetHospital.isActive) {
      return errorResponse(res, "Bệnh viện đích không tồn tại hoặc ngừng hoạt động.", 404);
    }

    // Đếm giường trống tại viện đích (Hỗ trợ chuyên khoa Ung Thư Não & tương thích ngược)
    const bedQuery = {
      hospitalId: targetHospitalId,
      status: 'available'
    };
    if (departmentId && departmentId !== 'all') {
      if (departmentId === 'KNT' || departmentId === 'KUTN-SURG') {
        bedQuery.departmentId = { $in: ['KUTN-SURG', 'KNT'] };
      } else if (departmentId === 'ICU' || departmentId === 'KUTN-ICU') {
        bedQuery.departmentId = { $in: ['KUTN-ICU', 'ICU'] };
      } else {
        bedQuery.departmentId = departmentId;
      }
    }

    const availableBeds = await HospitalBed.countDocuments(bedQuery);

    const isAvailable = availableBeds > 0;

    return successResponse(res, {
      targetHospitalId,
      targetHospitalName: targetHospital.name,
      departmentId,
      availableBeds,
      canAccept: isAvailable,
      message: isAvailable
        ? `Bệnh viện ${targetHospital.name} có ${availableBeds} giường trống tại Khoa Ung Thư Não. Đủ năng lực tiếp nhận ca phẫu thuật / điều trị u não.`
        : `Bệnh viện ${targetHospital.name} hiện hết giường trống chuyên khoa u não. Gợi ý chuyển tuyến khác.`
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

    // [BOLA/IDOR GUARD]: Chỉ nhân viên y tế thuộc bệnh viện đích (tiếp nhận) mới có thẩm quyền duyệt (Luật 15/2023 Điều 66)
    if (req.user.role !== 'admin' && req.user.hospitalId?.toString() !== transfer.targetHospitalId?.toString()) {
      return errorResponse(res, "Chỉ bác sĩ hoặc quản trị viên của bệnh viện tiếp nhận mới có quyền duyệt phiếu chuyển viện.", 403);
    }

    if (transfer.status !== 'pending') {
      return errorResponse(res, `Yêu cầu này đã ở trạng thái: ${transfer.status}.`, 400);
    }

    // [P0 CONCURRENCY FIX]: Tự động giữ chỗ giường trống nguyên tử bằng findOneAndUpdate
    // Ngăn chặn race condition khi 2 ca chuyển viện cấp cứu được duyệt đồng thời bị gán trùng 1 giường
    const availableBed = await HospitalBed.findOneAndUpdate(
      {
        hospitalId: transfer.targetHospitalId,
        $or: [
          { status: 'available' },
          { status: 'reserved', reservedUntil: { $lt: new Date() } }
        ]
      },
      {
        $set: {
          status: 'reserved',
          reservedUntil: new Date(Date.now() + 4 * 60 * 60 * 1000), // Giữ 4 tiếng
          reserveReason: 'inter_hospital_transfer',
          reservedForPatientId: transfer.patient_id,
          reservedForVisitId: transfer.visitId || null,
          reservedByUserId: req.user.id,
          reservedAt: new Date()
        }
      },
      { new: true }
    );

    if (availableBed) {
      transfer.targetBedId = availableBed._id;
      // Ghi audit log giữ chỗ giường chuyển viện
      try {
        await recordAuditLog({
          action: AUDIT_ACTIONS.BED_RESERVED,
          entity: "HospitalBed",
          entityId: availableBed._id,
          performedBy: req.user.id,
          hospitalId: transfer.targetHospitalId,
          details: `Tự động giữ chỗ giường ${availableBed.bedNumber} cho bệnh nhân chuyển viện ${transfer.patient_id}`,
          payload: { transferId: transfer._id, bedId: availableBed._id }
        });
      } catch (_) {}
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
// @access Private (Doctor/Admin at Target Hospital)
export const rejectTransferRequest = async (req, res) => {
  try {
    const transfer = await TransferForm.findById(req.params.id);
    if (!transfer) return errorResponse(res, "Không tìm thấy yêu cầu chuyển viện.", 404);

    // [BOLA/IDOR GUARD]: Chỉ bệnh viện tiếp nhận được quyền từ chối
    if (req.user.role !== 'admin' && req.user.hospitalId?.toString() !== transfer.targetHospitalId?.toString()) {
      return errorResponse(res, "Chỉ bác sĩ hoặc quản trị viên của bệnh viện tiếp nhận mới có quyền từ chối phiếu chuyển viện.", 403);
    }

    const { reason } = req.body;
    transfer.status = 'rejected';
    transfer.rejectionReason = reason || "Bệnh viện quá tải";

    // Tự động thu hồi giường giữ chỗ viện đích nếu có
    if (transfer.targetBedId) {
      await HospitalBed.findOneAndUpdate(
        { _id: transfer.targetBedId, status: 'reserved', reservedForPatientId: transfer.patient_id },
        { $set: { status: 'available', reservedUntil: null, reservedForPatientId: null, reservedForVisitId: null, reserveReason: null } }
      );
      transfer.targetBedId = null;
    }

    // Tự động hủy token xem liên viện khi ca bị từ chối
    if (transfer.crossHospitalToken) {
      transfer.crossHospitalToken = null;
      transfer.crossHospitalTokenExpiresAt = null;
      transfer.crossHospitalTokenRevokedAt = new Date();
      transfer.crossHospitalTokenRevokedBy = req.user.id;
    }

    await transfer.save();

    return successResponse(res, { transfer }, "Đã từ chối yêu cầu chuyển viện.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── F.5 — Audit log danh sách chuyển viện ───────────────────────────────────
// @route GET /api/v1/transfers
// @access Private (Doctor, Nurse, Admin)
export const getTransfers = async (req, res) => {
  try {
    if (!["doctor", "nurse", "admin", "hospital_admin"].includes(req.user?.role)) {
      return errorResponse(res, "Không có quyền xem danh sách chuyển viện của cơ sở y tế.", 403);
    }

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

    const userHosp = req.user.hospitalId?.toString();
    const isAuthorized = req.user.role === 'admin' ||
      userHosp === transfer.hospitalId?.toString() ||
      userHosp === transfer.targetHospitalId?.toString();

    if (!isAuthorized) {
      return errorResponse(res, "Không có quyền cấp token xem chéo viện cho hồ sơ chuyển viện này.", 403);
    }

    if (transfer.status !== 'accepted') {
      return errorResponse(res, "Chỉ có thể tạo token liên viện cho các ca đã được chấp nhận chuyển viện.", 400);
    }

    // Sử dụng crypto module tĩnh đã import ở đầu file
    const accessToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 ngày

    transfer.crossHospitalToken = accessToken;
    transfer.crossHospitalTokenExpiresAt = expiresAt;
    transfer.crossHospitalTokenRevokedAt = null;
    transfer.crossHospitalTokenRevokedBy = null;
    await transfer.save();

    // Ghi vết audit log
    try {
      await recordAuditLog({
        action: AUDIT_ACTIONS.CROSS_HOSPITAL_TOKEN_ISSUED,
        entity: "TransferForm",
        entityId: transfer._id,
        performedBy: req.user.id,
        hospitalId: transfer.hospitalId,
        details: `Cấp mã token xem bệnh án liên viện 7 ngày cho ca chuyển viện ${transfer.transferNo}`,
        payload: { transferId: transfer._id, expiresAt }
      });
    } catch (_) {}

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

// ─── F.5 — Thu hồi token xem bệnh án liên viện trước thời hạn ─────────────────
// @route POST /api/v1/transfers/:id/revoke-cross-view
// @access Private (Doctor, Admin at Target Hospital or Source Hospital)
export const revokeCrossHospitalView = async (req, res) => {
  try {
    const transfer = await TransferForm.findById(req.params.id);
    if (!transfer) return errorResponse(res, "Không tìm thấy yêu cầu chuyển viện.", 404);

    const userHosp = req.user.hospitalId?.toString();
    const isAuthorized = req.user.role === 'admin' ||
      userHosp === transfer.hospitalId?.toString() ||
      userHosp === transfer.targetHospitalId?.toString();

    if (!isAuthorized) {
      return errorResponse(res, "Không có quyền thu hồi token cho hồ sơ chuyển viện này.", 403);
    }

    transfer.crossHospitalToken = null;
    transfer.crossHospitalTokenExpiresAt = null;
    transfer.crossHospitalTokenRevokedAt = new Date();
    transfer.crossHospitalTokenRevokedBy = req.user.id;
    await transfer.save();

    try {
      await recordAuditLog({
        action: AUDIT_ACTIONS.CROSS_HOSPITAL_TOKEN_REVOKED,
        entity: "TransferForm",
        entityId: transfer._id,
        performedBy: req.user.id,
        hospitalId: transfer.hospitalId,
        details: `Đã thu hồi token xem bệnh án liên viện của ca chuyển viện ${transfer.transferNo}`,
        payload: { transferId: transfer._id, revokedBy: req.user.id }
      });
    } catch (_) {}

    return successResponse(res, { transferId: transfer._id }, "Đã thu hồi quyền xem bệnh án liên viện thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── F.5 — Đọc hồ sơ bệnh án liên viện thông qua Access Token ──────────────────
// @route GET /api/v1/transfers/cross-view/:token
// @access Token-Authorized (Doctor at Target Hospital)
export const accessCrossHospitalView = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) return errorResponse(res, "Thiếu mã token truy cập liên viện.", 400);

    const transfer = await TransferForm.findOne({
      crossHospitalToken: token,
      status: 'accepted'
    })
      .populate("patient_id", "profile.name profile.fullName profile.dob profile.gender profile.phone")
      .populate("hospitalId", "name code address")
      .populate("targetHospitalId", "name code address")
      .populate("imagingResultId")
      .lean();

    if (!transfer) {
      return errorResponse(res, "Mã token không hợp lệ hoặc ca chuyển viện chưa được chấp nhận/đã bị thu hồi.", 404);
    }

    // Kiểm tra thời hạn hiệu lực của Token
    if (!transfer.crossHospitalTokenExpiresAt || new Date(transfer.crossHospitalTokenExpiresAt) < new Date()) {
      return errorResponse(res, "Mã token xem bệnh án liên viện đã hết hạn hiệu lực.", 401);
    }

    // Ghi vết audit log truy cập theo TT 46/2018/TT-BYT Điều 18
    try {
      await recordAuditLog({
        action: AUDIT_ACTIONS.CROSS_HOSPITAL_VIEW_ACCESSED,
        entity: "TransferForm",
        entityId: transfer._id,
        performedBy: req.user?.id || "token_bearer",
        hospitalId: transfer.targetHospitalId?._id || transfer.targetHospitalId,
        details: `Bác sĩ truy cập hồ sơ bệnh án liên viện của bệnh nhân ${transfer.patient_id?._id} qua token an toàn.`,
        payload: { transferId: transfer._id, patientId: transfer.patient_id?._id }
      });
    } catch (_) {}

    return successResponse(res, {
      transferNo: transfer.transferNo,
      sourceHospital: transfer.hospitalId,
      targetHospital: transfer.targetHospitalId,
      patient: transfer.patient_id,
      clinicalSummary: transfer.clinicalSummary,
      labSummary: transfer.labSummary,
      diagnosis: transfer.diagnosis,
      treatment: transfer.treatment,
      drugsUsed: transfer.drugsUsed,
      patientStatus: transfer.patientStatus,
      transferPackageDriveUrl: transfer.transferPackageDriveUrl,
      imagingResult: transfer.imagingResultId,
      expiresAt: transfer.crossHospitalTokenExpiresAt
    }, "Truy xuất hồ sơ bệnh án chuyển viện thành công.");
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
