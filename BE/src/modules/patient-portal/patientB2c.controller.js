import { ImagingResult } from "../imaging/models/imagingResult.model.js";
import { Visit } from "../../models/visit.model.js";
import { User } from "../auth/models/user.model.js";
import { AiJob } from "../imaging/models/aiJob.model.js";
import { successResponse, errorResponse } from "../../utils/response.util.js";
import crypto from "crypto";

// ─── H.1 — Xem ảnh kết quả MRI đại diện (cho bệnh nhân) ─────────────────────
// @route GET /api/v1/patient-b2c/imaging/:imagingResultId
// @access Private (Patient — chỉ xem kết quả của chính mình)
export const getPatientMriResult = async (req, res) => {
  try {
    const { imagingResultId } = req.params;
    const patientId = req.user.id;

    // Lấy kết quả imaging
    const imaging = await ImagingResult.findById(imagingResultId).lean();
    if (!imaging) return errorResponse(res, "Không tìm thấy kết quả MRI.", 404);

    // Kiểm tra quyền — chỉ bệnh nhân sở hữu mới được xem
    if (req.user.role === "patient") {
      const user = await User.findById(patientId).lean();
      const isMine = user?.profile?.medicalId && user.profile.medicalId === imaging.medicalId;
      if (!isMine) return errorResponse(res, "Bạn không có quyền xem kết quả này.", 403);
    }

    // H.1 — Trả về phiên bản đời thường cho bệnh nhân (không lộ toàn bộ lâm sàng)
    const patientView = {
      id: imaging._id,
      orderDate: imaging.orderDate,
      procedure: imaging.procedure,
      reportDate: imaging.reportDate,
      radiologist: imaging.radiologist,
      // Ảnh đại diện (từ C.7)
      representativeSliceUrl: imaging.representativeSliceUrl || null,
      // Báo cáo AI dạng đời thường (nếu có)
      aiSummary: imaging.aiReport
        ? {
            tumorVolumeCm3: imaging.aiReport.tumorVolumeCm3 || null,
            midlineShiftMm: imaging.aiReport.midlineShiftMm || null,
            malignancyLevel: imaging.aiReport.malignancyLevel || null,
            // Mô tả đơn giản cho bệnh nhân
            plainDescription: generatePatientFriendlyDescription(imaging.aiReport),
          }
        : null,
      // Kết luận bác sĩ đã ký
      conclusion: imaging.isSigned ? imaging.conclusion : null,
      isSigned: imaging.isSigned,
      signedAt: imaging.signedAt,
    };

    return successResponse(res, patientView, "Lấy kết quả MRI thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── H.2 — Tải báo cáo kết quả dạng PDF (URL download) ──────────────────────
// @route GET /api/v1/patient-b2c/imaging/:imagingResultId/report-pdf
// @access Private (Patient — chỉ tải kết quả của mình; Premium để tải không giới hạn)
export const downloadPatientReport = async (req, res) => {
  try {
    const { imagingResultId } = req.params;

    const imaging = await ImagingResult.findById(imagingResultId).lean();
    if (!imaging) return errorResponse(res, "Không tìm thấy kết quả MRI.", 404);

    if (req.user.role === "patient") {
      const user = await User.findById(req.user.id).lean();
      const isMine = user?.profile?.medicalId === imaging.medicalId;
      if (!isMine) return errorResponse(res, "Bạn không có quyền tải báo cáo này.", 403);

      // H.2 — Giới hạn tải cho tài khoản thường (có thể mở rộng theo Premium)
      // isPremium check ở đây nếu cần giới hạn số lần tải
    }

    if (!imaging.isSigned) {
      return errorResponse(res, "Báo cáo chưa được bác sĩ ký duyệt. Không thể tải PDF.", 400);
    }

    // Trả về URL PDF từ Drive (nếu đã tạo) hoặc URL tạm
    // Trong thực tế, đây là Drive signed URL hoặc Firebase signed URL
    const pdfUrl = imaging.patientReportPdfUrl || null;

    if (!pdfUrl) {
      return errorResponse(res, "Báo cáo PDF chưa được tạo. Vui lòng liên hệ bệnh viện.", 404);
    }

    return successResponse(res, {
      pdfUrl,
      filename: `ket_qua_mri_${imaging._id}.pdf`,
      reportDate: imaging.reportDate,
    }, "Tải báo cáo PDF thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── H.3 — Chia sẻ kết quả qua QR code (tạo link chia sẻ có thời hạn) ────────
// @route POST /api/v1/patient-b2c/imaging/:imagingResultId/share-qr
// @access Private (Patient)
export const generateShareQr = async (req, res) => {
  try {
    const { imagingResultId } = req.params;
    const { expireDays = 30 } = req.body;

    const imaging = await ImagingResult.findById(imagingResultId).lean();
    if (!imaging) return errorResponse(res, "Không tìm thấy kết quả MRI.", 404);

    if (!imaging.isSigned) {
      return errorResponse(res, "Kết quả chưa được bác sĩ ký duyệt. Không thể chia sẻ.", 400);
    }

    // Kiểm tra quyền bệnh nhân
    if (req.user.role === "patient") {
      const user = await User.findById(req.user.id).lean();
      if (user?.profile?.medicalId !== imaging.medicalId) {
        return errorResponse(res, "Bạn không có quyền chia sẻ kết quả này.", 403);
      }
    }

    // H.3 — Tạo token chia sẻ ngẫu nhiên (không cần đăng nhập)
    const shareToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Math.min(expireDays, 30));

    // Lưu token vào DB (cập nhật ImagingResult)
    await ImagingResult.findByIdAndUpdate(imagingResultId, {
      shareToken,
      shareTokenExpiresAt: expiresAt,
    });

    const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const shareUrl = `${baseUrl}/shared-result/${shareToken}`;

    // Ghi AuditLog (chỉ log nếu có model AuditLog)
    try {
      const { AuditLog } = await import("../models/auditLog.model.js");
      await AuditLog.create({
        action: "H3_SHARE_QR_GENERATED",
        performedBy: req.user.id,
        targetId: imagingResultId,
        targetModel: "ImagingResult",
        note: `Tạo link chia sẻ QR, hết hạn ${expiresAt.toLocaleDateString("vi-VN")}`,
        hospitalId: req.user.hospitalId,
      });
    } catch { /* auditLog optional */ }

    return successResponse(res, {
      shareUrl,
      shareToken,
      expiresAt,
      // QR code data (FE sẽ dùng thư viện QR để render)
      qrData: shareUrl,
    }, "Tạo link chia sẻ QR thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── H.3 — Xem kết quả chia sẻ qua token (không cần đăng nhập) ──────────────
// @route GET /api/v1/patient-b2c/shared/:shareToken
// @access Public
export const viewSharedResult = async (req, res) => {
  try {
    const { shareToken } = req.params;

    const imaging = await ImagingResult.findOne({ shareToken }).lean();
    if (!imaging) return errorResponse(res, "Link chia sẻ không hợp lệ hoặc đã hết hạn.", 404);

    if (imaging.shareTokenExpiresAt && new Date() > imaging.shareTokenExpiresAt) {
      return errorResponse(res, "Link chia sẻ đã hết hạn.", 410);
    }

    // Trả về dữ liệu xem công khai (giới hạn trường)
    return successResponse(res, {
      procedure: imaging.procedure,
      orderDate: imaging.orderDate,
      reportDate: imaging.reportDate,
      radiologist: imaging.radiologist,
      conclusion: imaging.conclusion,
      representativeSliceUrl: imaging.representativeSliceUrl,
      isSigned: imaging.isSigned,
      signedAt: imaging.signedAt,
      shareTokenExpiresAt: imaging.shareTokenExpiresAt,
    }, "Xem kết quả chia sẻ thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── H.4 — Đặt lịch tái khám / chụp lại ────────────────────────────────────
// @route POST /api/v1/patient-b2c/book-followup
// @access Private (Patient)
export const bookFollowUp = async (req, res) => {
  try {
    const { preferredDate, reason, doctorId } = req.body;
    const patientId = req.user.id;

    if (!reason) return errorResponse(res, "Vui lòng nêu lý do tái khám.", 400);

    // Tạo Visit mới với trạng thái đặt lịch
    const { Visit } = await import("../models/visit.model.js");
    const newVisit = new Visit({
      hospitalId: req.user.hospitalId,
      patientId,
      doctorId: doctorId || null,
      date: preferredDate ? new Date(preferredDate) : null,
      reason: reason || "Tái khám định kỳ",
      visitType: "follow_up",
      status: "đang chờ",
      priority: "trung bình",
    });

    await newVisit.save();

    return successResponse(res, {
      visitId: newVisit._id,
      status: newVisit.status,
      date: newVisit.date,
      message: "Lịch tái khám đã được ghi nhận. Bệnh viện sẽ xác nhận và thông báo sớm.",
    }, "Đặt lịch tái khám thành công.", 201);
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── H.5 — Lịch sử các lần khám ─────────────────────────────────────────────
// @route GET /api/v1/patient-b2c/my-visits
// @access Private (Patient)
export const getMyVisits = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const total = await Visit.countDocuments({ patientId });
    const visits = await Visit.find({ patientId })
      .populate("doctorId", "profile.name profile.specialty")
      .populate("mriOrder.imagingResultId", "procedure reportDate isSigned")
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    // Bổ sung thông tin AI job nếu có
    const enrichedVisits = await Promise.all(visits.map(async (v) => {
      const aiJob = await AiJob.findOne({ visitId: v._id })
        .select("status progress currentStep completedAt")
        .lean();
      return { ...v, aiJob: aiJob || null };
    }));

    return successResponse(res, {
      visits: enrichedVisits,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    }, "Lấy lịch sử khám thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── H.6 — Cập nhật FCM token (nhận push notification khi kết quả sẵn sàng) ──
// @route PUT /api/v1/patient-b2c/fcm-token
// @access Private (Patient — cập nhật token mỗi lần app mở)
export const updateFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) return errorResponse(res, "Thiếu fcmToken.", 400);

    await User.findByIdAndUpdate(req.user.id, {
      "profile.fcmToken": fcmToken,
    });

    return successResponse(res, null, "Cập nhật FCM token thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── Hàm nội bộ — Tạo mô tả đời thường từ kết quả AI ─────────────────────────
function generatePatientFriendlyDescription(aiReport) {
  if (!aiReport) return "Chưa có kết quả phân tích AI.";

  const parts = [];

  if (aiReport.tumorVolumeCm3 != null) {
    parts.push(`Kích thước vùng bất thường phát hiện: khoảng ${aiReport.tumorVolumeCm3.toFixed(1)} cm³.`);
  }
  if (aiReport.midlineShiftMm != null && aiReport.midlineShiftMm > 0) {
    parts.push(`Có dấu hiệu lệch nhẹ cấu trúc não: ${aiReport.midlineShiftMm.toFixed(1)} mm.`);
  }
  if (aiReport.malignancyLevel) {
    const levelMap = {
      low: "mức thấp (ít đáng ngại)",
      moderate: "mức trung bình (cần theo dõi)",
      high: "mức cao (cần tham khảo bác sĩ sớm)",
    };
    parts.push(`Mức độ cần chú ý của bác sĩ: ${levelMap[aiReport.malignancyLevel] || aiReport.malignancyLevel}.`);
  }

  if (parts.length === 0) return "Kết quả phân tích đã hoàn thành. Vui lòng hỏi bác sĩ để biết thêm chi tiết.";
  parts.push("Đây là kết quả phân tích sơ bộ của hệ thống. Kết luận chính thức sẽ do bác sĩ xem xét và ký duyệt.");
  return parts.join(" ");
}
