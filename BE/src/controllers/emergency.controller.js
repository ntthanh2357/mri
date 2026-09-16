import { EmergencyAlert } from "../models/emergencyAlert.model.js";
import { Visit } from "../models/visit.model.js";
import { ImagingResult } from "../models/imagingResult.model.js";
import { AiJob } from "../models/aiJob.model.js";
import { MriSlot } from "../models/mriSlot.model.js";
import { createNotificationInternal } from "./notification.controller.js";
import { successResponse, errorResponse } from "../utils/response.util.js";

// ─── E.2 — Kích hoạt cấp cứu thủ công (bác sĩ bấm) ─────────────────────────
// @route POST /api/v1/emergency/trigger
// @access Private (Doctor, Admin)
export const triggerEmergency = async (req, res) => {
  try {
    if (!["doctor", "admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ bác sĩ hoặc admin mới có thể kích hoạt cấp cứu.", 403);
    }

    const hospitalId = req.user.hospitalId;
    const { visitId, imagingResultId, level = 'RED', reason } = req.body;

    if (!visitId) return errorResponse(res, "Thiếu ID lượt khám.", 400);

    const visit = await Visit.findOne({ _id: visitId, hospitalId });
    if (!visit) return errorResponse(res, "Không tìm thấy lượt khám.", 404);

    // Kiểm tra đã có cảnh báo active chưa
    const existingAlert = await EmergencyAlert.findOne({
      visitId,
      status: 'active'
    });
    if (existingAlert) {
      return errorResponse(res, "Lượt khám này đã có cảnh báo cấp cứu đang active.", 409);
    }

    // Tạo EmergencyAlert
    const alert = new EmergencyAlert({
      hospitalId,
      visitId,
      imagingResultId: imagingResultId || visit.mriOrder?.imagingResultId || null,
      level: ['RED', 'ORANGE'].includes(level) ? level : 'RED',
      triggeredBy: 'manual',
      triggeredByUserId: req.user.id,
      triggerReason: reason || "Bác sĩ kích hoạt thủ công.",
      status: 'active',
    });
    await alert.save();

    // Cập nhật Visit priority
    visit.priority = 'khẩn cấp';
    await visit.save();

    // E.5 — Đẩy AI Job lên đầu hàng nếu đang có job queued
    const pendingJob = await AiJob.findOne({ visitId, status: { $in: ['queued', 'running'] } });
    if (pendingJob) {
      pendingJob.priority = 1;
      await pendingJob.save();
    }

    // E.3 — Broadcast WebSocket alert (thực tế qua socket.io)
    // Gửi notification tới tất cả bác sĩ đang trực
    try {
      await broadcastEmergencyAlert(alert, hospitalId, req.user.id);
    } catch (broadcastErr) {
      console.warn("⚠️ Không thể broadcast emergency alert:", broadcastErr.message);
    }

    return successResponse(res, {
      alert,
      visitId,
      action: "Cảnh báo cấp cứu đã được gửi tới tất cả bác sĩ đang trực."
    }, "🚨 Cảnh báo cấp cứu đã được kích hoạt.", 201);
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── E.3 — Xác nhận nhận cảnh báo (Acknowledge) ─────────────────────────────
// @route PUT /api/v1/emergency/alerts/:alertId/acknowledge
// @access Private (Doctor, Admin)
export const acknowledgeAlert = async (req, res) => {
  try {
    const alert = await EmergencyAlert.findOne({
      _id: req.params.alertId,
      hospitalId: req.user.hospitalId
    });
    if (!alert) return errorResponse(res, "Không tìm thấy cảnh báo.", 404);
    if (alert.status === 'resolved') return errorResponse(res, "Cảnh báo này đã được giải quyết.", 400);

    // Kiểm tra đã acknowledge chưa
    const alreadyAcknowledged = alert.acknowledgedBy.some(
      a => a.userId.toString() === req.user.id.toString()
    );
    if (alreadyAcknowledged) {
      return errorResponse(res, "Bạn đã xác nhận cảnh báo này rồi.", 400);
    }

    alert.acknowledgedBy.push({ userId: req.user.id, acknowledgedAt: new Date() });
    if (alert.status === 'active') alert.status = 'acknowledged';
    await alert.save();

    return successResponse(res, { alert }, "Đã xác nhận nhận cảnh báo cấp cứu.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── Giải quyết cảnh báo cấp cứu ─────────────────────────────────────────────
// @route PUT /api/v1/emergency/alerts/:alertId/resolve
// @access Private (Doctor, Admin)
export const resolveAlert = async (req, res) => {
  try {
    if (!["doctor", "admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ bác sĩ hoặc admin mới có thể đánh dấu giải quyết.", 403);
    }
    const alert = await EmergencyAlert.findOne({
      _id: req.params.alertId,
      hospitalId: req.user.hospitalId
    });
    if (!alert) return errorResponse(res, "Không tìm thấy cảnh báo.", 404);
    if (alert.status === 'resolved') return errorResponse(res, "Cảnh báo này đã được giải quyết.", 400);

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    alert.resolvedBy = req.user.id;
    alert.resolutionNote = req.body.note || "";
    await alert.save();

    return successResponse(res, { alert }, "Đã đánh dấu cảnh báo cấp cứu là đã giải quyết.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── E.4 — Lấy danh sách cảnh báo đang active (Emergency Dashboard) ─────────
// @route GET /api/v1/emergency/alerts
// @access Private (Doctor, Admin)
export const getActiveAlerts = async (req, res) => {
  try {
    if (!["doctor", "admin", "hospital_admin", "nurse"].includes(req.user.role)) {
      return errorResponse(res, "Không có quyền xem cảnh báo cấp cứu.", 403);
    }
    const hospitalId = req.user.hospitalId;
    const { status = 'active' } = req.query;

    const alerts = await EmergencyAlert.find({ hospitalId, status })
      .populate("visitId", "patientId status priority")
      .populate("triggeredByUserId", "profile.name profile.fullName")
      .populate("acknowledgedBy.userId", "profile.name")
      .sort({ triggeredAt: -1 })
      .limit(50);

    // Tính countdown cho mỗi cảnh báo (thời gian từ khi tạo)
    const alertsWithCountdown = alerts.map(a => ({
      ...a.toObject(),
      minutesSinceTriggered: Math.floor((Date.now() - new Date(a.triggeredAt).getTime()) / 60000),
      isEscalated: !a.acknowledgedBy.length && (Date.now() - new Date(a.triggeredAt).getTime()) > 30 * 60000
    }));

    return successResponse(res, alertsWithCountdown, "Lấy danh sách cảnh báo cấp cứu thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── Lịch sử cảnh báo cấp cứu ────────────────────────────────────────────────
// @route GET /api/v1/emergency/alerts/history
// @access Private (Admin)
export const getAlertHistory = async (req, res) => {
  try {
    if (!["admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ admin mới xem được lịch sử.", 403);
    }
    const { from, to, level, limit = 30, page = 1 } = req.query;
    const filter = { hospitalId: req.user.hospitalId };
    if (level) filter.level = level;
    if (from || to) {
      filter.triggeredAt = {};
      if (from) filter.triggeredAt.$gte = new Date(from);
      if (to) filter.triggeredAt.$lte = new Date(to);
    }

    const total = await EmergencyAlert.countDocuments(filter);
    const alerts = await EmergencyAlert.find(filter)
      .populate("triggeredByUserId", "profile.name profile.fullName")
      .sort({ triggeredAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    return successResponse(res, { alerts, total }, "Lấy lịch sử cảnh báo cấp cứu thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── Internal — Broadcast tới tất cả bác sĩ đang trực ────────────────────────
async function broadcastEmergencyAlert(alert, hospitalId, senderId) {
  const { User } = await import("../models/user.model.js");
  const { sendFcmNotification } = await import("../services/fcm.service.js");

  // Lấy tất cả bác sĩ isOnCall
  const onCallDoctors = await User.find({
    hospitalId,
    role: { $in: ['doctor'] },
    isLocked: false,
    "profile.isOnCall": true
  }, "_id profile.fcmToken");

  const notifications = onCallDoctors.map(doctor =>
    createNotificationInternal({
      hospitalId,
      recipientId: doctor._id,
      senderId,
      type: "emergency_alert",
      title: `🚨 CẤP CỨU ${alert.level}: Ca cần xử lý khẩn cấp`,
      message: alert.triggerReason || "Phát hiện ca cần can thiệp khẩn cấp. Vui lòng kiểm tra ngay.",
      relatedId: alert._id,
    }).catch(err => console.warn(`Không gửi được thông báo cho bác sĩ:`, err.message))
  );

  // Gửi FCM Push Notification cho các bác sĩ có fcmToken
  const fcmTokens = onCallDoctors
    .map(d => d.profile?.fcmToken)
    .filter(token => typeof token === 'string' && token.trim() !== '');

  if (fcmTokens.length > 0) {
    sendFcmNotification(fcmTokens, {
      title: `🚨 CẤP CỨU ${alert.level}`,
      body: alert.triggerReason || "Phát hiện ca cần can thiệp khẩn cấp. Vui lòng kiểm tra ngay.",
      data: { alertId: String(alert._id), visitId: String(alert.visitId), type: "emergency" }
    }).catch(fcmErr => console.warn("⚠️ FCM error in emergency alert:", fcmErr.message));
  }

  await Promise.allSettled(notifications);
}
