import crypto from "crypto";
import mongoose from "mongoose";
import { EmergencyAlert, EmergencyEvent } from "../models/emergencyAlert.model.js";
import { Visit } from "../models/visit.model.js";
import { User } from "../models/user.model.js";
import { MedicalRecord } from "../modules/emr/models/medicalRecord.model.js";
import { AiJob } from "../models/aiJob.model.js";
import { createNotificationInternal } from "./notification.controller.js";
import { successResponse, errorResponse } from "../utils/response.util.js";
import { recordAuditLog, AUDIT_ACTIONS } from "../services/auditLog.service.js";
import { sendOtpEmail } from "../services/email.service.js";

// Kíp lâm sàng cấp cứu của bệnh viện; tài khoản nền tảng (admin, system_admin) không xem/thao tác sự kiện cấp cứu.
const CLINICAL_EMERGENCY_ROLES = [
  "doctor",
  "department_head",
  "nurse",
  "technician",
  "radiologist",
  "hospital_admin",
];

// Giải trừ báo động, đề xuất chèn lịch MRI/giữ giường, đóng sự kiện, đóng cảnh báo là quyết định chuyên môn:
// chỉ Bác sĩ hoặc Trưởng khoa (khớp thông báo lỗi). Tài khoản quản trị không tham gia.
const DOCTOR_LEAD_ROLES = ["doctor", "department_head"];

/**
 * Tra cứu kíp trực Roster hiện tại theo WorkSchedule & isOnCall
 * Phân bổ đúng 4 vai trò cốt lõi: Neurosurgeon, Neuro-ICU, Nurse Lead, Radiology Tech
 */
export async function getRosterOnDuty(hospitalId) {
  try {
    const { User } = await import("../models/user.model.js");
    const { WorkSchedule } = await import("../models/workSchedule.model.js");

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todaySchedules = await WorkSchedule.find({
      hospitalId,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: "confirmed"
    }).populate("staffId", "profile role isLocked");

    const onCallUsers = await User.find({
      hospitalId,
      isLocked: false,
      "profile.isOnCall": true
    });

    const candidateMap = new Map();
    onCallUsers.forEach(u => candidateMap.set(u._id.toString(), u));
    todaySchedules.forEach(s => {
      if (s.staffId && !s.staffId.isLocked) {
        candidateMap.set(s.staffId._id.toString(), s.staffId);
      }
    });

    const candidates = Array.from(candidateMap.values());
    const assigned = [];

    // 1. Bác sĩ Ngoại Thần Kinh trực (Neurosurgeon)
    const neurosurgeon = candidates.find(u =>
      ['doctor', 'department_head'].includes(u.role) && (
        /ngoại|thần kinh|phẫu thuật|neuro/i.test(u.profile?.specialty || "") ||
        /ngoại|thần kinh/i.test(u.profile?.department || "")
      )
    ) || candidates.find(u => ['doctor', 'department_head'].includes(u.role));

    if (neurosurgeon) {
      assigned.push({
        role: 'neurosurgeon',
        staffId: neurosurgeon._id,
        staffName: neurosurgeon.profile?.name || neurosurgeon.profile?.fullName || "Bác sĩ Ngoại Thần Kinh Trực",
        isAcknowledged: false,
        acknowledgedAt: null
      });
    }

    // 2. Bác sĩ / Điều dưỡng Hồi sức Cấp cứu U Não (Neuro-ICU)
    const neuroIcu = candidates.find(u =>
      u._id.toString() !== neurosurgeon?._id.toString() && (
        /icu|hồi sức/i.test(u.profile?.department || "") ||
        /hồi sức|cấp cứu|icu/i.test(u.profile?.specialty || "")
      )
    ) || candidates.find(u => ['doctor', 'department_head'].includes(u.role) && u._id.toString() !== neurosurgeon?._id.toString());

    if (neuroIcu) {
      assigned.push({
        role: 'neuro_icu',
        staffId: neuroIcu._id,
        staffName: neuroIcu.profile?.name || neuroIcu.profile?.fullName || "Bác sĩ Neuro-ICU Trực",
        isAcknowledged: false,
        acknowledgedAt: null
      });
    }

    // 3. Điều dưỡng trưởng kíp (Nurse Lead)
    const nurseLead = candidates.find(u => u.role === 'nurse');
    if (nurseLead) {
      assigned.push({
        role: 'nurse_lead',
        staffId: nurseLead._id,
        staffName: nurseLead.profile?.name || nurseLead.profile?.fullName || "Điều dưỡng trưởng trực",
        isAcknowledged: false,
        acknowledgedAt: null
      });
    }

    // 4. Kỹ thuật viên / Bác sĩ Chẩn đoán hình ảnh (Radiology Tech)
    const radTech = candidates.find(u =>
      ['technician', 'radiologist'].includes(u.role) ||
      (u.role === 'doctor' && /hình ảnh|radiolog|mri|ct/i.test(u.profile?.specialty || ""))
    );
    if (radTech) {
      assigned.push({
        role: 'radiology_tech',
        staffId: radTech._id,
        staffName: radTech.profile?.name || radTech.profile?.fullName || "KTV Chẩn đoán hình ảnh trực",
        isAcknowledged: false,
        acknowledgedAt: null
      });
    }

    return assigned;
  } catch (err) {
    console.warn("⚠️ Không thể truy xuất Roster ca trực:", err.message);
    return [];
  }
}

/**
 * Phát cảnh báo đa kênh (WebSocket, FCM Push, Notification nội bộ)
 */
async function broadcastEmergencyEvent(event, hospitalId, senderId, isStandDown = false) {
  try {
    const { User } = await import("../models/user.model.js");
    const { sendFcmNotification } = await import("../services/fcm.service.js");

    // Lấy tất cả nhân sự trong Roster hoặc đang trực
    const recipientIds = (event.assignedRoster || [])
      .map(r => r.staffId)
      .filter(Boolean);

    const onCallDoctors = await User.find({
      hospitalId,
      isLocked: false,
      $or: [
        { _id: { $in: recipientIds } },
        { "profile.isOnCall": true, role: { $in: ['doctor', 'department_head', 'radiologist', 'nurse', 'technician'] } }
      ]
    }, "_id profile.fcmToken profile.name");

    const title = isStandDown
      ? `✅ GIẢI TRỪ BÁO ĐỘNG (STAND-DOWN)`
      : `🚨 BÁO ĐỘNG CẤP CỨU [${event.level}]: BỆNH NHÂN NGUY KỊCH`;

    const message = isStandDown
      ? `Sự cố cấp cứu đã được giải trừ. Lý do: ${event.cancellationDetails?.cancelReason || 'Ấn nhầm'}.`
      : `${event.clinicalSeverity?.reasonNotes || event.triggerReason || 'Phát hiện ca diễn biến xấu đột ngột. Kíp trực xử trí ngay!'}`;

    // 1. Notification trong DB
    const notifications = onCallDoctors.map(staff =>
      createNotificationInternal({
        hospitalId,
        recipientId: staff._id,
        senderId,
        type: isStandDown ? "emergency_stand_down" : "emergency_alert",
        title,
        message,
        relatedId: event._id,
      }).catch(err => console.warn(`Không gửi được thông báo cho nhân sự ${staff._id}:`, err.message))
    );

    // 2. FCM Push Notification cho ứng dụng di động
    const fcmTokens = onCallDoctors
      .map(d => d.profile?.fcmToken)
      .filter(token => typeof token === 'string' && token.trim() !== '');

    if (fcmTokens.length > 0) {
      sendFcmNotification(fcmTokens, {
        title,
        body: message,
        data: {
          alertId: String(event._id),
          type: isStandDown ? "emergency_stand_down" : "emergency_alert",
          level: event.level,
          source: event.source
        }
      }).catch(fcmErr => console.warn("⚠️ FCM error in emergency alert:", fcmErr.message));
    }

    // 3. WebSocket Broadcast nếu có global.io
    if (global.io) {
      const socketChannel = `hospital_${hospitalId}`;
      global.io.to(socketChannel).emit(isStandDown ? "emergency:stand_down" : "emergency:alert", {
        event,
        title,
        message,
        timestamp: new Date()
      });
    }

    await Promise.allSettled(notifications);
  } catch (err) {
    console.warn("⚠️ Lỗi trong broadcastEmergencyEvent:", err.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. NÚT 1-CHẠM CẤP CỨU NỘI VIỆN (INPATIENT ONE-TOUCH TRIGGER)
// POST /api/v1/emergency/inpatient-trigger
// ══════════════════════════════════════════════════════════════════════════════
export const inpatientTrigger = async (req, res) => {
  try {
    if (!CLINICAL_EMERGENCY_ROLES.includes(req.user?.role)) {
      return errorResponse(res, "Chỉ nhân sự lâm sàng mới có quyền kích hoạt báo động cấp cứu nội viện.", 403);
    }
    const hospitalId = req.user.hospitalId;
    const { patientId, bedNumber, roomNumber, level = 'RED', reason } = req.body;

    if (!patientId) {
      return errorResponse(res, "Thiếu ID bệnh nhân để phát lệnh cấp cứu.", 400);
    }

    // Kiểm tra bệnh nhân
    const patient = await User.findOne({ _id: patientId, hospitalId });
    if (!patient) {
      return errorResponse(res, "Không tìm thấy thông tin bệnh nhân.", 404);
    }

    // Tìm lượt khám (Visit) hoặc Bệnh án (MedicalRecord) đang điều trị
    const visit = await Visit.findOne({
      hospitalId,
      patientId,
      status: { $nin: ['hoàn tất', 'đã đóng', 'đã hủy'] }
    }).sort({ createdAt: -1 });

    // [BUG-EMR-001 FIX]: Tìm theo cả patientId (string/medicalId) và userId (ObjectId)
    const medicalRecord = await MedicalRecord.findOne({
      hospitalId,
      $or: [{ patientId: String(patientId) }, { userId: patientId }],
      status: "Đang điều trị"
    }).sort({ createdAt: -1 });

    // Tra cứu kíp trực đích danh từ Roster
    const assignedRoster = await getRosterOnDuty(hospitalId);

    // Khởi tạo EmergencyEvent
    const event = new EmergencyAlert({
      hospitalId,
      patientId,
      visitId: visit?._id || null,
      medicalRecordId: medicalRecord?._id || null,
      source: 'inpatient_crisis',
      location: {
        department: 'Khoa Ung Thư Não',
        roomNumber: roomNumber || patient.inpatientDetails?.room || "",
        bedNumber: bedNumber || patient.inpatientDetails?.bed || ""
      },
      level: ['RED', 'ORANGE'].includes(level) ? level : 'RED',
      triggeredBy: 'manual',
      triggeredByUserId: req.user.id,
      triggeredAt: new Date(),
      status: 'triggered',
      clinicalSeverity: {
        level: ['RED', 'ORANGE'].includes(level) ? level : 'RED',
        reasonNotes: reason || "Báo động 1-chạm: Bệnh nhân diễn biến xấu đột ngột tại giường bệnh."
      },
      assignedRoster,
      timelineMilestones: [
        {
          action: "Báo động 1-chạm nội viện được kích hoạt",
          performedBy: req.user.id,
          performedByName: req.user.profile?.name || req.user.username,
          timestamp: new Date(),
          notes: reason || "Điều dưỡng/Bác sĩ tại giường phát tín hiệu cấp cứu khẩn cấp."
        }
      ]
    });

    await event.save();

    // Cập nhật Visit priority nếu có
    if (visit) {
      visit.priority = 'khẩn cấp';
      await visit.save();
    }

    // Broadcast tới kíp trực đích danh
    await broadcastEmergencyEvent(event, hospitalId, req.user.id);

    return successResponse(res, {
      event,
      action: "Đã phát tín hiệu cấp cứu 1-chạm tới kíp trực Roster. Hotline nội bộ sẵn sàng."
    }, "Phát lệnh cấp cứu 1-chạm thành công.", 201);
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ phát lệnh cấp cứu: " + err.message, 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 2. BỔ SUNG THÔNG TIN LÂM SÀNG SAU KHI PHÁT LỆNH (POST-TRIGGER ENRICHMENT)
// PATCH /api/v1/emergency/post-enrich/:id
// ══════════════════════════════════════════════════════════════════════════════
export const postEnrich = async (req, res) => {
  try {
    if (!CLINICAL_EMERGENCY_ROLES.includes(req.user?.role)) {
      return errorResponse(res, "Không có quyền cập nhật thông số lâm sàng cấp cứu.", 403);
    }
    const { id } = req.params;
    const { gcsScore, news2Score, acuteSigns = [], reasonNotes, level } = req.body;

    const event = await EmergencyAlert.findOne({ _id: id, hospitalId: req.user.hospitalId });
    if (!event) return errorResponse(res, "Không tìm thấy sự kiện cấp cứu.", 404);

    if (gcsScore !== undefined) event.clinicalSeverity.gcsScore = gcsScore;
    if (news2Score !== undefined) event.clinicalSeverity.news2Score = news2Score;
    if (acuteSigns && acuteSigns.length > 0) event.clinicalSeverity.acuteSigns = acuteSigns;
    if (reasonNotes) event.clinicalSeverity.reasonNotes = reasonNotes;
    if (level && ['RED', 'ORANGE'].includes(level)) {
      event.level = level;
      event.clinicalSeverity.level = level;
    }

    event.timelineMilestones.push({
      action: "Bổ sung thông số lâm sàng",
      performedBy: req.user.id,
      performedByName: req.user.profile?.name || req.user.username,
      timestamp: new Date(),
      notes: `GCS: ${gcsScore ?? 'N/A'}, NEWS2: ${news2Score ?? 'N/A'}, Dấu hiệu: ${acuteSigns.join(', ')}`
    });

    await event.save();
    return successResponse(res, { event }, "Đã cập nhật thông số lâm sàng.");
  } catch (err) {
    return errorResponse(res, "Lỗi cập nhật thông số: " + err.message, 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 3. TIẾP NHẬN BÀN GIAO TỪ KHOA CẤP CỨU (ED INBOUND ISBAR HANDOFF)
// POST /api/v1/emergency/ed-handoff
// ══════════════════════════════════════════════════════════════════════════════
export const edHandoff = async (req, res) => {
  try {
    if (!CLINICAL_EMERGENCY_ROLES.includes(req.user?.role)) {
      return errorResponse(res, "Chỉ nhân sự lâm sàng mới có quyền tạo bàn giao ca cấp cứu ISBAR.", 403);
    }
    const hospitalId = req.user.hospitalId;
    if (!hospitalId) return errorResponse(res, "Tài khoản chưa được gán vào bệnh viện nào.", 403);
    const {
      hisPatientCode,
      isUnidentifiedPatient = false,
      patientName,
      age,
      gender,
      edDoctorName,
      situation,
      background,
      assessment,
      recommendation,
      pacsAccessionNumber,
      level = 'RED'
    } = req.body;

    let patient = null;

    if (hisPatientCode && !isUnidentifiedPatient) {
      patient = await User.findOne({
        hospitalId,
        $or: [
          { "profile.patientId": hisPatientCode },
          { "profile.identityCardNumber": hisPatientCode }
        ]
      });
    }

    // Nếu là bệnh nhân vô danh hoặc chưa có trên hệ thống, tạo bản ghi bệnh nhân cấp cứu
    if (!patient) {
      const generatedCode = isUnidentifiedPatient
        ? `BN_VODANH_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Math.floor(100 + Math.random() * 900)}`
        : (hisPatientCode || `BN_ED_${Date.now().toString().slice(-6)}`);

      patient = new User({
        hospitalId,
        email: `emergency_${Date.now()}_${Math.floor(Math.random() * 10000)}@hospital.local`,
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789dummyhashforpatient",
        role: "patient",
        profile: {
          patientId: generatedCode,
          name: patientName || (isUnidentifiedPatient ? `Bệnh nhân Vô Danh (${generatedCode})` : "Bệnh nhân cấp cứu ED"),
          age: Number(age) > 0 ? Number(age) : null, // chưa rõ thì để trống
          gender: ["Nam", "Nữ", "Khác"].includes(gender) ? gender : "", // chưa rõ thì để trống
          phone: ""
        }
      });
      await patient.save();
    }

    // Tạo lượt khám Cấp cứu với cơ chế: Chụp trước, thu sau
    const visit = new Visit({
      hospitalId,
      patientId: patient._id,
      visitType: 'Cấp cứu',
      priority: 'khẩn cấp',
      status: 'đang khám',
      reason: situation || "Tiếp nhận cấp cứu chuyển từ Khoa Cấp Cứu",
      diagnosis: assessment || ""
    });
    await visit.save();

    // Tra cứu Roster trực
    const assignedRoster = await getRosterOnDuty(hospitalId);

    const event = new EmergencyAlert({
      hospitalId,
      patientId: patient._id,
      visitId: visit._id,
      source: 'ed_transfer',
      location: {
        department: 'Khoa Cấp Cứu chuyển giao sang Khoa Ung Thư Não',
        roomNumber: 'Khu Cấp Cứu Tiếp Nhận'
      },
      level: ['RED', 'ORANGE'].includes(level) ? level : 'RED',
      triggeredBy: 'manual',
      triggeredByUserId: req.user.id,
      triggeredAt: new Date(),
      status: 'triggered',
      isbarHandoff: {
        hisPatientCode: hisPatientCode || patient.profile?.patientId,
        isUnidentifiedPatient,
        edDoctorName: edDoctorName || req.user.profile?.name || "Bác sĩ Cấp cứu ED",
        situation: situation || "",
        background: background || "",
        assessment: assessment || "",
        recommendation: recommendation || "",
        pacsAccessionNumber: pacsAccessionNumber || "",
        clinicalResponsibility: 'with_ed' // Trách nhiệm lâm sàng vẫn thuộc ED cho tới khi Bác sĩ Ngoại TK Accept
      },
      clinicalSeverity: {
        level: ['RED', 'ORANGE'].includes(level) ? level : 'RED',
        reasonNotes: situation || "Tiếp nhận ca bệnh nguy kịch từ Khoa Cấp Cứu"
      },
      assignedRoster,
      timelineMilestones: [
        {
          action: "Khoa Cấp Cứu bàn giao bệnh nhân (Chuẩn ISBAR)",
          performedBy: req.user.id,
          performedByName: req.user.profile?.name || req.user.username,
          timestamp: new Date(),
          notes: `Bác sĩ ED: ${edDoctorName || 'N/A'}. PACS Accession: ${pacsAccessionNumber || 'Chưa chụp CT'}`
        }
      ]
    });

    await event.save();
    await broadcastEmergencyEvent(event, hospitalId, req.user.id);

    return successResponse(res, {
      event,
      patient,
      visit,
      notice: "Đã tạo hồ sơ bàn giao ISBAR. Trách nhiệm theo dõi thuộc ED cho đến khi Bác sĩ Ngoại Thần Kinh chấp thuận nhận bệnh."
    }, "Tạo bàn giao ca cấp cứu ISBAR thành công.", 201);
  } catch (err) {
    return errorResponse(res, "Lỗi tiếp nhận ca từ Cấp cứu: " + err.message, 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 4. BÁC SĨ NGOẠI THẦN KINH CHẤP THUẬN TIẾP NHẬN BỆNH (ACCEPT HANDOFF)
// PUT /api/v1/emergency/ed-accept/:id
// ══════════════════════════════════════════════════════════════════════════════
export const edAccept = async (req, res) => {
  try {
    if (!DOCTOR_LEAD_ROLES.includes(req.user.role)) {
      return errorResponse(res, "Chỉ Bác sĩ Ngoại Thần Kinh mới có thẩm quyền chấp thuận nhận bệnh.", 403);
    }

    const event = await EmergencyAlert.findOne({ _id: req.params.id, hospitalId: req.user.hospitalId });
    if (!event) return errorResponse(res, "Không tìm thấy sự kiện cấp cứu.", 404);

    event.isbarHandoff.acceptedByDoctorId = req.user.id;
    event.isbarHandoff.acceptedAt = new Date();
    event.isbarHandoff.clinicalResponsibility = 'transferred_to_neuro';
    if (event.status === 'triggered') event.status = 'acknowledged';

    // Cập nhật ACK cho vai trò neurosurgeon trong Roster
    const rosterIdx = (event.assignedRoster || []).findIndex(r => r.role === 'neurosurgeon');
    if (rosterIdx !== -1) {
      event.assignedRoster[rosterIdx].isAcknowledged = true;
      event.assignedRoster[rosterIdx].acknowledgedAt = new Date();
      event.assignedRoster[rosterIdx].staffId = req.user.id;
      event.assignedRoster[rosterIdx].staffName = req.user.profile?.name || req.user.username;
    }

    event.timelineMilestones.push({
      action: "Bác sĩ Ngoại Thần Kinh chấp thuận nhận bệnh",
      performedBy: req.user.id,
      performedByName: req.user.profile?.name || req.user.username,
      timestamp: new Date(),
      notes: "Chuyển giao trách nhiệm lâm sàng hoàn tất sang Khoa Ung Thư Não."
    });

    await event.save();
    return successResponse(res, { event }, "Đã chấp thuận tiếp nhận bệnh nhân.");
  } catch (err) {
    return errorResponse(res, "Lỗi chấp thuận ca bệnh: " + err.message, 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 5. XÁC NHẬN NHẬN CA THEO VAI TRÒ (ROLE-SPECIFIC ACKNOWLEDGE)
// PUT /api/v1/emergency/ack/:id
// ══════════════════════════════════════════════════════════════════════════════
export const acknowledgeByRole = async (req, res) => {
  try {
    if (!CLINICAL_EMERGENCY_ROLES.includes(req.user?.role)) {
      return errorResponse(res, "Không có quyền xác nhận tiếp nhận ca cấp cứu.", 403);
    }
    // Fix 0011: route chuẩn PUT /ack/:id và route legacy PUT /alerts/:alertId/acknowledge
    // dùng chung handler này nhưng tên param khác nhau — đọc cả hai để route legacy
    // không bị 404 (alertId === undefined khi gọi qua /ack/:id và ngược lại).
    const { id, alertId } = req.params;
    const eventId = id || alertId;
    const { role } = req.body; // 'neurosurgeon' | 'neuro_icu' | 'nurse_lead' | 'radiology_tech'

    const event = await EmergencyAlert.findOne({ _id: eventId, hospitalId: req.user.hospitalId });
    if (!event) return errorResponse(res, "Không tìm thấy sự kiện cấp cứu.", 404);
    if (['closed', 'cancelled_false_alarm'].includes(event.status)) {
      return errorResponse(res, "Sự kiện cấp cứu này đã kết thúc hoặc bị hủy.", 400);
    }

    // Xác định vai trò của người gọi
    let matchedRole = role;
    if (!matchedRole) {
      if (req.user.role === 'nurse') matchedRole = 'nurse_lead';
      else if (['technician', 'radiologist'].includes(req.user.role)) matchedRole = 'radiology_tech';
      else matchedRole = 'neurosurgeon';
    }

    // Cập nhật assignedRoster
    let foundInRoster = false;
    (event.assignedRoster || []).forEach(r => {
      if (r.role === matchedRole || String(r.staffId) === String(req.user.id)) {
        r.isAcknowledged = true;
        r.acknowledgedAt = new Date();
        r.staffId = req.user.id;
        r.staffName = req.user.profile?.name || req.user.username;
        foundInRoster = true;
      }
    });

    if (!foundInRoster) {
      event.assignedRoster.push({
        role: matchedRole,
        staffId: req.user.id,
        staffName: req.user.profile?.name || req.user.username,
        isAcknowledged: true,
        acknowledgedAt: new Date()
      });
    }

    // Tương thích ngược acknowledgedBy
    const alreadyAcked = event.acknowledgedBy.some(a => String(a.userId) === String(req.user.id));
    if (!alreadyAcked) {
      event.acknowledgedBy.push({
        userId: req.user.id,
        role: matchedRole,
        acknowledgedAt: new Date()
      });
    }

    if (event.status === 'triggered' || event.status === 'active') {
      event.status = 'acknowledged';
    }

    event.timelineMilestones.push({
      action: `Vai trò [${matchedRole}] xác nhận tiếp nhận (ACK)`,
      performedBy: req.user.id,
      performedByName: req.user.profile?.name || req.user.username,
      timestamp: new Date(),
      notes: "Kíp trực đã nhận cảnh báo và đang tiếp cận bệnh nhân."
    });

    await event.save();
    return successResponse(res, { event }, `Đã xác nhận tiếp nhận ca cấp cứu (${matchedRole}).`);
  } catch (err) {
    return errorResponse(res, "Lỗi xác nhận nhận ca: " + err.message, 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 6. HỦY BÁO ĐỘNG NHẦM (STAND-DOWN PROTOCOL)
// POST /api/v1/emergency/cancel-stand-down/:id
// ══════════════════════════════════════════════════════════════════════════════
export const cancelStandDown = async (req, res) => {
  try {
    if (!DOCTOR_LEAD_ROLES.includes(req.user?.role)) {
      return errorResponse(res, "Chỉ Bác sĩ hoặc Trưởng khoa mới có thẩm quyền giải trừ báo động cấp cứu (Stand-Down).", 403);
    }
    const { id } = req.params;
    const { cancelReason } = req.body;

    if (typeof cancelReason !== "string" || cancelReason.trim() === '') {
      return errorResponse(res, "Bắt buộc phải nhập lý do hủy báo động nhầm để lưu vết kiểm toán.", 400);
    }

    const event = await EmergencyAlert.findOne({ _id: id, hospitalId: req.user.hospitalId });
    if (!event) return errorResponse(res, "Không tìm thấy sự kiện cấp cứu.", 404);
    if (event.status === 'closed') {
      return errorResponse(res, "Sự kiện đã đóng chính thức, không thể đánh dấu hủy nhầm.", 400);
    }

    event.status = 'cancelled_false_alarm';
    event.cancellationDetails = {
      cancelledBy: req.user.id,
      cancelledByName: req.user.profile?.name || req.user.username,
      cancelledAt: new Date(),
      cancelReason: cancelReason.trim()
    };

    event.timelineMilestones.push({
      action: "Giải trừ báo động (Stand-Down)",
      performedBy: req.user.id,
      performedByName: req.user.profile?.name || req.user.username,
      timestamp: new Date(),
      notes: `Hủy báo động nhầm. Lý do: ${cancelReason.trim()}`
    });

    await event.save();

    // Bắn thông báo giải trừ tới kíp trực
    await broadcastEmergencyEvent(event, req.user.hospitalId, req.user.id, true);

    return successResponse(res, { event }, "Đã giải trừ báo động nhầm và thông báo kíp trực.");
  } catch (err) {
    return errorResponse(res, "Lỗi hủy báo động: " + err.message, 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 7. Y LỆNH MIỆNG CẤP CỨU: tạo → điều dưỡng đọc lại → bác sĩ ký bổ sung
//
// Trạng thái: pending_readback → readback_confirmed → fully_signed; pending_readback → rejected.
// Quá hạn là mốc thời gian riêng (escalatedReadBackAt, overdueAt) vì y lệnh có thể quá hạn ở nhiều bước.
// Thời hạn 15 phút và 24 giờ là quy định nội bộ: văn bản đã rà soát của Bộ Y tế không đặt các mốc này.
// Điều dưỡng được thực hiện thuốc ngay trong cấp cứu rồi xác nhận sau; trước khi xác nhận,
// hệ thống không ghi là đã đọc lại (không có cờ nào từ client bỏ qua được bước này).
// POST /api/v1/emergency/verbal-order
// ══════════════════════════════════════════════════════════════════════════════
const VERBAL_ORDER_PRESCRIBER_ROLES = ["doctor", "department_head"];
const ALERT_BANNER_MAX_AGE_HOURS = 24;
const VERBAL_ORDER_COUNTERSIGN_HOURS = 24;
const READBACK_OTP_TTL_MS = 15 * 60 * 1000;
const READBACK_OTP_MAX_ATTEMPTS = 5;
const OPEN_EVENT_STATUSES = ["active", "triggered", "acknowledged", "in_progress", "escalated"];
const WITNESS_ROLES = ["doctor", "department_head", "nurse", "radiologist", "pharmacist"];

const hashReadBackOtp = (orderId, code) =>
  crypto.createHash("sha256").update(`${orderId}|${code}`).digest("hex");

// Không bao giờ trả mã OTP (kể cả bản băm) về cho client
const serializeVerbalOrder = (order) => {
  const plain = typeof order?.toObject === "function" ? order.toObject() : { ...order };
  delete plain.readBackOtpHash;
  delete plain.readBackOtpAttempts;
  return plain;
};

const findActiveStaff = (userId, hospitalId, roles) =>
  mongoose.isValidObjectId(userId)
    ? User.findOne({
        _id: userId,
        hospitalId,
        role: { $in: roles },
        isLocked: { $ne: true },
        isDeleted: { $ne: true },
      }).select("email role profile").lean()
    : null;

const staffDisplayName = (user, fallback) =>
  user?.profile?.fullName || user?.profile?.name || user?.username || user?.email || fallback;

export const createVerbalOrder = async (req, res) => {
  try {
    if (!VERBAL_ORDER_PRESCRIBER_ROLES.includes(req.user?.role)) {
      return errorResponse(res, "Chỉ Bác sĩ hoặc Trưởng khoa mới có thẩm quyền ra y lệnh miệng cấp cứu.", 403);
    }
    const hospitalId = req.user.hospitalId;
    const { emergencyEventId, medicalRecordId, isControlledSubstance = false, nurseReceivedId } = req.body || {};
    const orderText = String(req.body?.orderText || "").trim();

    if (!emergencyEventId || !orderText) {
      return errorResponse(res, "Thiếu ID sự kiện cấp cứu hoặc nội dung y lệnh.", 400);
    }
    if (!nurseReceivedId) {
      return errorResponse(res, "Vui lòng chọn điều dưỡng nhận y lệnh để đọc lại.", 400);
    }

    const event = await EmergencyAlert.findOne({ _id: emergencyEventId, hospitalId });
    if (!event) return errorResponse(res, "Không tìm thấy sự kiện cấp cứu liên kết.", 404);
    if (!OPEN_EVENT_STATUSES.includes(event.status)) {
      return errorResponse(res, "Sự kiện cấp cứu đã đóng. Y lệnh miệng chỉ được ra trong sự kiện cấp cứu đang mở.", 409);
    }

    const nurse = await findActiveStaff(nurseReceivedId, hospitalId, ["nurse"]);
    if (!nurse) {
      return errorResponse(res, "Người nhận y lệnh phải là điều dưỡng đang hoạt động của bệnh viện.", 400);
    }

    // Tìm MedicalRecord tương ứng (Fix BUG-EMR-001: khớp cả patientId string và userId ObjectId)
    let record = null;
    if (medicalRecordId || event.medicalRecordId) {
      record = await MedicalRecord.findOne({ _id: medicalRecordId || event.medicalRecordId, hospitalId });
    }
    if (!record && event.patientId) {
      record = await MedicalRecord.findOne({
        hospitalId,
        $or: [{ patientId: String(event.patientId) }, { userId: event.patientId }],
        status: { $in: ["Đang điều trị", "Cấp cứu"] }
      }).sort({ createdAt: -1 });
    }

    if (!record) {
      return errorResponse(res, "Không tìm thấy hồ sơ bệnh án để ghi nhận y lệnh miệng.", 404);
    }

    const now = new Date();
    const orderId = new mongoose.Types.ObjectId();
    const otpCode = String(crypto.randomInt(100000, 1000000));
    const prescriberName = staffDisplayName(req.user, "Bác sĩ");

    record.verbalOrders.push({
      _id: orderId,
      emergencyEventId: event._id,
      orderText,
      isControlledSubstance: Boolean(isControlledSubstance),
      prescribedAt: now,
      prescribedByDoctorId: req.user.id,
      prescribedByDoctorName: prescriberName,
      nurseReceivedId: nurse._id,
      nurseReceivedName: staffDisplayName(nurse, "Điều dưỡng"),
      isReadBackConfirmed: false,
      readBackOtpHash: hashReadBackOtp(orderId, otpCode),
      readBackOtpExpires: new Date(now.getTime() + READBACK_OTP_TTL_MS),
      readBackOtpAttempts: 0,
      countersignDeadline: new Date(now.getTime() + VERBAL_ORDER_COUNTERSIGN_HOURS * 3600 * 1000),
      status: "pending_readback",
    });
    await record.save();
    const savedVerbalOrder = record.verbalOrders.id(orderId);

    // Ghi nhận mốc thời gian vào EmergencyEvent
    event.timelineMilestones.push({
      action: `Ra y lệnh miệng: ${orderText}`,
      performedBy: req.user.id,
      performedByName: prescriberName,
      timestamp: now,
      notes: `Chờ điều dưỡng ${savedVerbalOrder.nurseReceivedName} xác nhận đọc lại. ${isControlledSubstance ? "[THUỐC GÂY NGHIỆN/HƯỚNG THẦN] " : ""}Hạn ký bổ sung: ${VERBAL_ORDER_COUNTERSIGN_HOURS} giờ.`
    });

    if (event.status === 'acknowledged' || event.status === 'triggered') {
      event.status = 'in_progress';
    }
    await event.save();

    await recordAuditLog({
      action: AUDIT_ACTIONS.VERBAL_ORDER_CREATED,
      actorId: req.user.id,
      actorRole: req.user.role,
      hospitalId,
      targetModel: "MedicalRecord",
      targetId: String(record._id),
      metadata: {
        verbalOrderId: String(orderId),
        status: savedVerbalOrder.status,
        isControlledSubstance: Boolean(isControlledSubstance),
        nurseReceivedId: String(nurse._id),
      },
      req,
    });

    await createNotificationInternal({
      hospitalId,
      recipientId: nurse._id,
      senderId: req.user.id,
      type: "emergency_alert",
      title: "Y lệnh miệng cần đọc lại",
      message: `BS ${prescriberName}: ${orderText}. Vui lòng xác nhận đã đọc lại trên ứng dụng.`,
      relatedId: record._id,
    });
    // Mã OTP chỉ gửi tới điều dưỡng, không bao giờ trả về cho bác sĩ ra lệnh
    sendOtpEmail(nurse.email, otpCode, {
      subject: "[NeuroScan AI] Mã xác nhận đọc lại y lệnh miệng",
      purpose: `Bác sĩ ${prescriberName} vừa ra y lệnh miệng cho bạn. Dùng mã dưới đây để xác nhận đã đọc lại nếu chưa thao tác được trực tiếp trên ứng dụng.`,
      validity: "15 phút",
    }).catch((mailErr) => {
      console.warn("Không gửi được mã đọc lại y lệnh miệng:", mailErr.message);
    });

    return successResponse(res, {
      verbalOrder: serializeVerbalOrder(savedVerbalOrder),
      recordId: record._id,
      event
    }, "Đã ghi nhận y lệnh miệng. Chờ điều dưỡng xác nhận đọc lại, sau đó bác sĩ ký bổ sung trong 24 giờ.", 201);
  } catch (err) {
    return errorResponse(res, "Lỗi tạo y lệnh miệng: " + err.message, 500);
  }
};

// Chỉ đúng điều dưỡng được gán mới xác nhận được, từ đúng trạng thái chờ đọc lại.
const loadOrderForReadBack = async (req, orderId, { withOtp = false } = {}) => {
  const hospitalId = req.user?.hospitalId;
  if (!hospitalId || !mongoose.isValidObjectId(orderId)) {
    return { error: { message: "Không tìm thấy y lệnh miệng.", status: 404 } };
  }
  const query = MedicalRecord.findOne({ "verbalOrders._id": orderId, hospitalId });
  if (withOtp) query.select("+verbalOrders.readBackOtpHash");
  const record = await query;
  const order = record?.verbalOrders.id(orderId);
  if (!order) return { error: { message: "Không tìm thấy y lệnh miệng.", status: 404 } };

  const currentUserId = String(req.user.id || req.user._id);
  if (String(order.prescribedByDoctorId) === currentUserId) {
    return { error: { message: "Bác sĩ ra y lệnh miệng không được tự xác nhận đọc lại thay cho điều dưỡng nhận lệnh.", status: 403 } };
  }
  if (req.user.role !== "nurse" || String(order.nurseReceivedId) !== currentUserId) {
    return { error: { message: "Chỉ điều dưỡng được gán nhận y lệnh mới có quyền xác nhận đọc lại.", status: 403 } };
  }
  if (order.status !== "pending_readback") {
    return { error: { message: `Y lệnh không ở trạng thái chờ đọc lại (hiện tại: ${order.status}).`, status: 409 } };
  }
  return { record, order, currentUserId };
};

const markReadBackConfirmed = async (req, res, { record, orderId, currentUserId, method }) => {
  const confirmedAt = new Date();
  const updated = await MedicalRecord.findOneAndUpdate(
    {
      _id: record._id,
      hospitalId: record.hospitalId,
      verbalOrders: { $elemMatch: { _id: orderId, status: "pending_readback" } },
    },
    {
      $set: {
        "verbalOrders.$.status": "readback_confirmed",
        "verbalOrders.$.isReadBackConfirmed": true,
        "verbalOrders.$.readBackConfirmedBy": currentUserId,
        "verbalOrders.$.readBackConfirmedAt": confirmedAt,
        "verbalOrders.$.readBackMethod": method,
        "verbalOrders.$.readBackOtpHash": null,
        "verbalOrders.$.readBackOtpExpires": null,
      },
    },
    { new: true }
  );
  if (!updated) {
    return errorResponse(res, "Y lệnh này vừa được xử lý, vui lòng tải lại.", 409);
  }

  await recordAuditLog({
    action: AUDIT_ACTIONS.VERBAL_ORDER_READBACK_CONFIRMED,
    actorId: currentUserId,
    actorRole: req.user.role,
    hospitalId: updated.hospitalId,
    targetModel: "MedicalRecord",
    targetId: String(updated._id),
    metadata: { verbalOrderId: String(orderId), readBackMethod: method },
    req,
  });

  return successResponse(
    res,
    { verbalOrder: serializeVerbalOrder(updated.verbalOrders.id(orderId)), recordId: updated._id },
    "Điều dưỡng đã xác nhận đọc lại y lệnh miệng thành công."
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// 7B. ĐIỀU DƯỠNG XÁC NHẬN ĐỌC LẠI Y LỆNH MIỆNG TRÊN APP
// POST /api/v1/emergency/verbal-order/:orderId/readback-confirm
// ══════════════════════════════════════════════════════════════════════════════
export const confirmVerbalOrderReadBack = async (req, res) => {
  try {
    const { orderId } = req.params;
    const loaded = await loadOrderForReadBack(req, orderId);
    if (loaded.error) return errorResponse(res, loaded.error.message, loaded.error.status);
    return await markReadBackConfirmed(req, res, {
      record: loaded.record,
      orderId,
      currentUserId: loaded.currentUserId,
      method: "app_confirm",
    });
  } catch (err) {
    return errorResponse(res, "Lỗi xác nhận đọc lại: " + err.message, 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 7C. XÁC NHẬN ĐỌC LẠI BẰNG MÃ OTP GỬI TỚI ĐIỀU DƯỠNG
// POST /api/v1/emergency/verbal-order/:orderId/readback-otp
// ══════════════════════════════════════════════════════════════════════════════
export const confirmVerbalOrderOtp = async (req, res) => {
  try {
    const { orderId } = req.params;
    const loaded = await loadOrderForReadBack(req, orderId, { withOtp: true });
    if (loaded.error) return errorResponse(res, loaded.error.message, loaded.error.status);
    const { record, order, currentUserId } = loaded;

    const otpCode = String(req.body?.otpCode || "").trim();
    if (!otpCode) return errorResponse(res, "Vui lòng nhập mã OTP đọc lại.", 400);

    // Đếm atomic trước khi so khớp để request song song không lách được giới hạn
    const counted = await MedicalRecord.findOneAndUpdate(
      {
        _id: record._id,
        hospitalId: record.hospitalId,
        verbalOrders: {
          $elemMatch: {
            _id: orderId,
            status: "pending_readback",
            readBackOtpAttempts: { $not: { $gte: READBACK_OTP_MAX_ATTEMPTS } },
          },
        },
      },
      { $inc: { "verbalOrders.$.readBackOtpAttempts": 1 } }
    ).select("_id");
    if (!counted) {
      return errorResponse(res, "Đã nhập sai mã OTP quá số lần cho phép. Vui lòng xác nhận đọc lại trực tiếp trên ứng dụng.", 429);
    }

    if (!order.readBackOtpHash || hashReadBackOtp(orderId, otpCode) !== order.readBackOtpHash) {
      return errorResponse(res, "Mã OTP đọc lại không chính xác.", 400);
    }
    if (!order.readBackOtpExpires || new Date(order.readBackOtpExpires) < new Date()) {
      return errorResponse(res, "Mã OTP đọc lại đã hết hạn (quá 15 phút). Vui lòng xác nhận trực tiếp trên ứng dụng.", 400);
    }

    return await markReadBackConfirmed(req, res, { record, orderId, currentUserId, method: "otp" });
  } catch (err) {
    return errorResponse(res, "Lỗi xác nhận OTP đọc lại: " + err.message, 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 7E. TỪ CHỐI Y LỆNH KHI ĐỌC LẠI KHÔNG KHỚP (hoặc bác sĩ tự thu hồi trước khi xác nhận)
// POST /api/v1/emergency/verbal-order/:orderId/reject
// ══════════════════════════════════════════════════════════════════════════════
export const rejectVerbalOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const hospitalId = req.user?.hospitalId;
    const reason = String(req.body?.reason || "").trim();
    if (reason.length < 5) return errorResponse(res, "Vui lòng ghi lý do từ chối y lệnh, tối thiểu 5 ký tự.", 400);
    if (!hospitalId || !mongoose.isValidObjectId(orderId)) return errorResponse(res, "Không tìm thấy y lệnh miệng.", 404);

    const record = await MedicalRecord.findOne({ "verbalOrders._id": orderId, hospitalId });
    const order = record?.verbalOrders.id(orderId);
    if (!order) return errorResponse(res, "Không tìm thấy y lệnh miệng.", 404);

    const currentUserId = String(req.user.id || req.user._id);
    const isAssignedNurse = req.user.role === "nurse" && String(order.nurseReceivedId) === currentUserId;
    const isPrescriber = String(order.prescribedByDoctorId) === currentUserId;
    if (!isAssignedNurse && !isPrescriber) {
      return errorResponse(res, "Chỉ điều dưỡng được gán hoặc bác sĩ ra lệnh mới được từ chối y lệnh này.", 403);
    }

    const updated = await MedicalRecord.findOneAndUpdate(
      {
        _id: record._id,
        hospitalId,
        verbalOrders: { $elemMatch: { _id: orderId, status: "pending_readback" } },
      },
      {
        $set: {
          "verbalOrders.$.status": "rejected",
          "verbalOrders.$.rejectionReason": reason,
          "verbalOrders.$.readBackOtpHash": null,
          "verbalOrders.$.readBackOtpExpires": null,
        },
      },
      { new: true }
    );
    if (!updated) return errorResponse(res, "Chỉ từ chối được y lệnh đang chờ đọc lại.", 409);

    await recordAuditLog({
      action: AUDIT_ACTIONS.VERBAL_ORDER_REJECTED,
      actorId: currentUserId,
      actorRole: req.user.role,
      hospitalId,
      targetModel: "MedicalRecord",
      targetId: String(updated._id),
      metadata: { verbalOrderId: String(orderId), reason },
      req,
    });

    if (isAssignedNurse) {
      await createNotificationInternal({
        hospitalId,
        recipientId: order.prescribedByDoctorId,
        senderId: currentUserId,
        type: "emergency_alert",
        title: "Y lệnh miệng bị từ chối khi đọc lại",
        message: `${order.orderText}. Lý do: ${reason}`,
        relatedId: updated._id,
      });
    }

    return successResponse(res, { verbalOrder: serializeVerbalOrder(updated.verbalOrders.id(orderId)) }, "Đã từ chối y lệnh miệng.");
  } catch (err) {
    return errorResponse(res, "Lỗi từ chối y lệnh miệng: " + err.message, 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 7F. Y LỆNH MIỆNG ĐANG CHỜ TÔI XỬ LÝ
// GET /api/v1/emergency/verbal-orders/my-pending
// ══════════════════════════════════════════════════════════════════════════════
export const getMyPendingVerbalOrders = async (req, res) => {
  try {
    const hospitalId = req.user?.hospitalId;
    const me = String(req.user.id || req.user._id);
    const isNurse = req.user.role === "nurse";
    const matcher = isNurse
      ? { nurseReceivedId: me, status: "pending_readback" }
      : { prescribedByDoctorId: me, status: { $in: ["pending_readback", "readback_confirmed"] } };

    const records = await MedicalRecord.find({ hospitalId, verbalOrders: { $elemMatch: matcher } })
      .select("patientName patientId verbalOrders")
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    const statuses = isNurse ? ["pending_readback"] : ["pending_readback", "readback_confirmed"];
    const ownerField = isNurse ? "nurseReceivedId" : "prescribedByDoctorId";
    const orders = records.flatMap((record) =>
      record.verbalOrders
        .filter((order) => statuses.includes(order.status) && String(order[ownerField]) === me)
        .map((order) => ({
          ...serializeVerbalOrder(order),
          recordId: record._id,
          patientName: record.patientName,
        }))
    ).sort((a, b) => new Date(a.prescribedAt) - new Date(b.prescribedAt));

    return successResponse(res, orders, "Lấy danh sách y lệnh miệng chờ xử lý thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi lấy danh sách y lệnh miệng: " + err.message, 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 7D. BÁC SĨ RA LỆNH KÝ BỔ SUNG TRONG 24H
// POST /api/v1/emergency/verbal-order/:orderId/countersign
// ══════════════════════════════════════════════════════════════════════════════
export const countersignVerbalOrder = async (req, res) => {
  try {
    if (!VERBAL_ORDER_PRESCRIBER_ROLES.includes(req.user?.role)) {
      return errorResponse(res, "Chỉ Bác sĩ hoặc Trưởng khoa mới có thẩm quyền ký bổ sung y lệnh miệng.", 403);
    }

    const { orderId } = req.params;
    const { witnessUserId, notes } = req.body || {};
    const hospitalId = req.user?.hospitalId;
    if (!hospitalId || !mongoose.isValidObjectId(orderId)) {
      return errorResponse(res, "Không tìm thấy y lệnh miệng.", 404);
    }

    const record = await MedicalRecord.findOne({ "verbalOrders._id": orderId, hospitalId });
    const order = record?.verbalOrders.id(orderId);
    if (!order) return errorResponse(res, "Không tìm thấy y lệnh miệng.", 404);

    const currentUserId = String(req.user.id || req.user._id);
    if (String(order.prescribedByDoctorId) !== currentUserId) {
      return errorResponse(res, "Chỉ bác sĩ đã ra y lệnh miệng mới được ký bổ sung.", 403);
    }
    if (order.status === "pending_readback" || order.isReadBackConfirmed !== true) {
      return errorResponse(res, "Y lệnh miệng chưa được điều dưỡng xác nhận đọc lại. Vui lòng hoàn tất đọc lại trước khi ký bổ sung.", 400);
    }
    if (order.status !== "readback_confirmed") {
      return errorResponse(res, `Y lệnh không ở trạng thái chờ ký bổ sung (hiện tại: ${order.status}).`, 409);
    }

    // Quy định nội bộ: thuốc gây nghiện, hướng thần cần nhân viên y tế chứng kiến độc lập với người ra lệnh
    let witness = null;
    if (order.isControlledSubstance === true) {
      witness = witnessUserId && String(witnessUserId) !== currentUserId
        ? await findActiveStaff(witnessUserId, hospitalId, WITNESS_ROLES)
        : null;
      if (!witness) {
        return errorResponse(res, "Y lệnh thuốc gây nghiện/hướng thần cần chọn nhân viên y tế chứng kiến độc lập với bác sĩ ra lệnh.", 400);
      }
    }

    const signedAt = new Date();
    const signatureHash = crypto
      .createHash("sha256")
      .update(`${order._id}|${currentUserId}|${order.orderText}|${signedAt.toISOString()}`)
      .digest("hex");

    const updated = await MedicalRecord.findOneAndUpdate(
      {
        _id: record._id,
        hospitalId,
        verbalOrders: { $elemMatch: { _id: orderId, status: "readback_confirmed" } },
      },
      {
        $set: {
          "verbalOrders.$.status": "fully_signed",
          "verbalOrders.$.countersignedBy": currentUserId,
          "verbalOrders.$.countersignedByName": staffDisplayName(req.user, "Bác sĩ"),
          "verbalOrders.$.countersignedAt": signedAt,
          "verbalOrders.$.signatureHash": signatureHash,
          ...(witness
            ? {
                "verbalOrders.$.witnessUserId": witness._id,
                "verbalOrders.$.witnessUserName": staffDisplayName(witness, "Nhân viên y tế chứng kiến"),
              }
            : {}),
        },
      },
      { new: true }
    );
    if (!updated) return errorResponse(res, "Y lệnh này vừa được ký, vui lòng tải lại.", 409);

    await recordAuditLog({
      action: AUDIT_ACTIONS.VERBAL_ORDER_COUNTERSIGNED,
      actorId: currentUserId,
      actorRole: req.user.role,
      hospitalId: updated.hospitalId,
      targetModel: "MedicalRecord",
      targetId: String(updated._id),
      metadata: {
        verbalOrderId: String(orderId),
        isControlledSubstance: Boolean(order.isControlledSubstance),
        witnessUserId: witness ? String(witness._id) : null,
        signatureHash,
        notes: notes || "",
      },
      req,
    });

    return successResponse(
      res,
      { verbalOrder: serializeVerbalOrder(updated.verbalOrders.id(orderId)), recordId: updated._id, signatureHash },
      "Bác sĩ đã ký bổ sung y lệnh miệng thành công."
    );
  } catch (err) {
    return errorResponse(res, "Lỗi ký bổ sung y lệnh miệng: " + err.message, 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 8. ĐỀ XUẤT CHÈN LỊCH MRI 3.0T KHẨN (PRE-MRI SAFETY GATE)
// POST /api/v1/emergency/request-mri-override
// ══════════════════════════════════════════════════════════════════════════════
export const requestMriOverride = async (req, res) => {
  try {
    if (!DOCTOR_LEAD_ROLES.includes(req.user?.role)) {
      return errorResponse(res, "Chỉ Bác sĩ hoặc Trưởng khoa mới có thẩm quyền đề xuất chèn lịch MRI khẩn cấp.", 403);
    }
    const { emergencyEventId, preMriSafetyGate, note } = req.body;

    if (!emergencyEventId) return errorResponse(res, "Thiếu ID sự kiện cấp cứu.", 400);

    const event = await EmergencyAlert.findOne({ _id: emergencyEventId, hospitalId: req.user.hospitalId });
    if (!event) return errorResponse(res, "Không tìm thấy sự kiện cấp cứu.", 404);

    // Kiểm tra an toàn sinh hiệu & vật liệu cấy ghép
    const {
      hemodynamicallyStable = false,
      respiratoryStable = false,
      implantScreeningPassed = false,
      mrConditionalEquipmentReady = false
    } = preMriSafetyGate || {};

    if (!hemodynamicallyStable || !respiratoryStable) {
      return errorResponse(res, "Cảnh báo an toàn: Bệnh nhân chưa ổn định huyết động/hô hấp, không được đưa vào buồng chụp MRI 3.0T. Ưu tiên chụp CT hoặc hồi sức trước.", 422);
    }

    if (!implantScreeningPassed) {
      return errorResponse(res, "Cảnh báo an toàn: Chưa vượt qua sàng lọc vật liệu cấy ghép từ tính (Clip phình mạch, van VP shunt, máy tạo nhịp).", 422);
    }

    event.preMriSafetyGate = {
      hemodynamicallyStable,
      respiratoryStable,
      implantScreeningPassed,
      mrConditionalEquipmentReady,
      verifiedBy: req.user.id,
      verifiedAt: new Date()
    };

    event.mriOverrideProposal = {
      status: 'pending',
      requestedAt: new Date(),
      requestedBy: req.user.id,
      note: note || "Đề xuất chèn lịch MRI sọ não cấp cứu 3.0T (Đã vượt qua Pre-MRI Safety Gate)."
    };

    event.timelineMilestones.push({
      action: "Gửi đề xuất chèn lịch chụp MRI 3.0T khẩn",
      performedBy: req.user.id,
      performedByName: req.user.profile?.name || req.user.username,
      timestamp: new Date(),
      notes: "Pre-MRI Safety Gate đã được xác nhận đạt chuẩn an toàn."
    });

    await event.save();
    return successResponse(res, { event }, "Đã gửi đề xuất chèn lịch MRI sang Kỹ thuật viên trưởng CĐHA phê duyệt.");
  } catch (err) {
    return errorResponse(res, "Lỗi gửi đề xuất MRI: " + err.message, 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 9. ĐỀ XUẤT GIỮ GIƯỜNG HỒI SỨC CẤP CỨU U NÃO (NEURO-ICU BED PROPOSAL)
// POST /api/v1/emergency/request-icu-bed
// ══════════════════════════════════════════════════════════════════════════════
export const requestIcuBed = async (req, res) => {
  try {
    if (!DOCTOR_LEAD_ROLES.includes(req.user?.role)) {
      return errorResponse(res, "Chỉ Bác sĩ hoặc Trưởng khoa mới có thẩm quyền đề xuất giữ giường Neuro-ICU.", 403);
    }
    const { emergencyEventId, requestedBedType = 'KUTN-ICU', note } = req.body;

    const event = await EmergencyAlert.findOne({ _id: emergencyEventId, hospitalId: req.user.hospitalId });
    if (!event) return errorResponse(res, "Không tìm thấy sự kiện cấp cứu.", 404);

    event.icuBedProposal = {
      requestedBedType,
      status: 'pending',
      requestedAt: new Date(),
      requestedBy: req.user.id,
      note: note || "Đề xuất giữ giường Hồi sức Cấp cứu U Não (Neuro-ICU) 4 giờ."
    };

    event.timelineMilestones.push({
      action: "Đề xuất giữ giường Neuro-ICU khẩn cấp",
      performedBy: req.user.id,
      performedByName: req.user.profile?.name || req.user.username,
      timestamp: new Date(),
      notes: `Yêu cầu Đơn nguyên Hồi sức phê duyệt giữ giường (${requestedBedType}).`
    });

    await event.save();
    return successResponse(res, { event }, "Đã gửi đề xuất giữ giường Neuro-ICU sang Bác sĩ trực Hồi sức duyệt.");
  } catch (err) {
    return errorResponse(res, "Lỗi gửi đề xuất giường ICU: " + err.message, 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 10. ĐÓNG SỰ KIỆN CẤP CỨU & KẾT CỤC LÂM SÀNG (EVENT CLOSURE & AUDIT TIMELINE)
// POST /api/v1/emergency/close-event/:id
// ══════════════════════════════════════════════════════════════════════════════
export const closeEmergencyEvent = async (req, res) => {
  try {
    if (!DOCTOR_LEAD_ROLES.includes(req.user?.role)) {
      return errorResponse(res, "Chỉ Bác sĩ hoặc Trưởng khoa mới có thẩm quyền đóng sự kiện cấp cứu.", 403);
    }
    const { id } = req.params;
    const { outcome, summaryNotes, isBackfilled = false, backfillReason, backfillMilestones = [] } = req.body;

    const validOutcomes = [
      'emergency_or_transferred',
      'neuro_icu_admitted',
      'stabilized_in_ward',
      'transfer_higher_hospital',
      'fatal'
    ];

    if (!validOutcomes.includes(outcome)) {
      return errorResponse(res, "Kết cục lâm sàng không hợp lệ. Vui lòng chọn kết cục điều trị thực tế.", 400);
    }

    const event = await EmergencyAlert.findOne({ _id: id, hospitalId: req.user.hospitalId });
    if (!event) return errorResponse(res, "Không tìm thấy sự kiện cấp cứu.", 404);

    event.status = 'closed';
    event.resolvedAt = new Date();
    event.resolvedBy = req.user.id;
    event.closureDetails = {
      closedBy: req.user.id,
      closedByName: req.user.profile?.name || req.user.username,
      closedAt: new Date(),
      outcome,
      summaryNotes: summaryNotes || "",
      isBackfilled: Boolean(isBackfilled),
      backfillReason: backfillReason || ""
    };

    // Bổ sung các mốc thời gian nhập bù nếu có
    if (Array.isArray(backfillMilestones) && backfillMilestones.length > 0) {
      backfillMilestones.forEach(m => {
        event.timelineMilestones.push({
          action: m.action || "Mốc thời gian nhập bù",
          performedBy: req.user.id,
          performedByName: req.user.profile?.name || req.user.username,
          timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
          notes: `[Nhập bù sau sự cố]: ${m.notes || ''}`
        });
      });
      // Sắp xếp lại timeline theo thứ tự thời gian
      event.timelineMilestones.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    event.timelineMilestones.push({
      action: `Đóng sự kiện cấp cứu chính thức. Kết cục: ${outcome}`,
      performedBy: req.user.id,
      performedByName: req.user.profile?.name || req.user.username,
      timestamp: new Date(),
      notes: summaryNotes || "Bệnh nhân đã được xử trí và bàn giao an toàn."
    });

    await event.save();
    return successResponse(res, { event }, "Đã đóng sự kiện cấp cứu và hoàn thiện chuỗi Timeline Audit.");
  } catch (err) {
    return errorResponse(res, "Lỗi đóng sự kiện cấp cứu: " + err.message, 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 11. LẤY DANH SÁCH SỰ KIỆN CẤP CỨU ACTIVE & COUNTDOWN
// GET /api/v1/emergency/alerts & GET /api/v1/emergency/active-events
// ══════════════════════════════════════════════════════════════════════════════
export const getActiveAlerts = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    if (!hospitalId) return errorResponse(res, "Tài khoản chưa được gán vào bệnh viện nào.", 403);
    const { status } = req.query;

    const query = {
      hospitalId,
      status: status || { $in: ['active', 'triggered', 'acknowledged', 'in_progress', 'escalated'] }
    };

    // Banner chỉ báo cấp cứu còn mới. Sự kiện cũ chưa đóng vẫn xem được ở danh sách của kíp lâm sàng.
    const isClinical = CLINICAL_EMERGENCY_ROLES.includes(req.user.role);
    const recentHours = isClinical ? Number(req.query.recentHours) : ALERT_BANNER_MAX_AGE_HOURS;
    if (recentHours > 0) query.triggeredAt = { $gte: new Date(Date.now() - recentHours * 3600 * 1000) };

    // Nhân viên ngoài kíp lâm sàng chỉ cần biết có cấp cứu ở đâu: không trả dữ liệu người bệnh.
    if (!isClinical) {
      const minimal = await EmergencyAlert.find(query)
        .select("level status location triggeredAt")
        .sort({ triggeredAt: -1 })
        .limit(50)
        .lean();
      return successResponse(res, minimal, "Lấy cảnh báo cấp cứu thành công.");
    }

    const alerts = await EmergencyAlert.find(query)
      .populate("patientId", "profile")
      .populate("visitId", "patientId status priority")
      .populate("triggeredByUserId", "profile.name profile.fullName profile.role")
      .populate("acknowledgedBy.userId", "profile.name profile.role")
      .sort({ triggeredAt: -1 })
      .limit(50);

    const now = Date.now();
    const alertsWithCountdown = alerts.map(a => {
      const elapsedMinutes = Math.floor((now - new Date(a.triggeredAt).getTime()) / 60000);
      const isUnacked = !a.acknowledgedBy || a.acknowledgedBy.length === 0;

      // Leo thang Cấp 1 (T1: sau 90 giây = 1.5 phút chưa ai ACK)
      const isLevel1Escalated = isUnacked && elapsedMinutes >= 1.5;
      // Leo thang Cấp 2 (T2: sau 5 phút chưa được xử trí)
      const isLevel2Escalated = elapsedMinutes >= 5 && a.status !== 'in_progress';

      return {
        ...a.toObject(),
        minutesSinceTriggered: elapsedMinutes,
        isLevel1Escalated,
        isLevel2Escalated,
        isEscalated: isLevel1Escalated || isLevel2Escalated
      };
    });

    return successResponse(res, alertsWithCountdown, "Lấy danh sách sự kiện cấp cứu thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi lấy danh sách cấp cứu: " + err.message, 500);
  }
};

export const getActiveEvents = getActiveAlerts;

// ══════════════════════════════════════════════════════════════════════════════
// 12. CÁC HÀM TƯƠNG THÍCH NGƯỢC (BACKWARD COMPATIBILITY)
// ══════════════════════════════════════════════════════════════════════════════
export const triggerEmergency = async (req, res) => {
  try {
    if (!CLINICAL_EMERGENCY_ROLES.includes(req.user.role)) {
      return errorResponse(res, "Chỉ nhân viên y tế mới có thể kích hoạt cấp cứu.", 403);
    }

    const hospitalId = req.user.hospitalId;
    if (!hospitalId) return errorResponse(res, "Tài khoản chưa được gán vào bệnh viện nào.", 403);
    const { visitId, patientId, imagingResultId, level = 'RED', reason } = req.body || {};

    let targetPatientId = patientId;
    let visit = null;

    if (visitId) {
      visit = await Visit.findOne({ _id: visitId, hospitalId });
      if (visit) targetPatientId = visit.patientId;
    }

    const assignedRoster = await getRosterOnDuty(hospitalId);

    const alert = new EmergencyAlert({
      hospitalId,
      visitId: visitId || null,
      patientId: targetPatientId || null,
      imagingResultId: imagingResultId || visit?.mriOrder?.imagingResultId || null,
      level: ['RED', 'ORANGE'].includes(level) ? level : 'RED',
      triggeredBy: 'manual',
      triggeredByUserId: req.user.id,
      triggerReason: reason || "Bác sĩ kích hoạt cấp cứu thủ công.",
      status: 'active',
      assignedRoster,
      timelineMilestones: [
        {
          action: "Kích hoạt cảnh báo cấp cứu thủ công",
          performedBy: req.user.id,
          performedByName: req.user.profile?.name || req.user.username,
          timestamp: new Date(),
          notes: reason || ""
        }
      ]
    });
    await alert.save();

    if (visit) {
      visit.priority = 'khẩn cấp';
      await visit.save();
    }

    // Ưu tiên AI job
    if (visitId) {
      const pendingJob = await AiJob.findOne({ visitId, status: { $in: ['queued', 'running'] } });
      if (pendingJob) {
        pendingJob.priority = 1;
        await pendingJob.save();
      }
    }

    await broadcastEmergencyEvent(alert, hospitalId, req.user.id);

    return successResponse(res, {
      alert,
      action: "Cảnh báo cấp cứu đã được kích hoạt và gửi tới kíp trực."
    }, "Cảnh báo cấp cứu đã được kích hoạt.", 201);
  } catch (err) {
    return errorResponse(res, "Lỗi kích hoạt cấp cứu: " + err.message, 500);
  }
};

export const acknowledgeAlert = async (req, res) => {
  return acknowledgeByRole(req, res);
};

export const resolveAlert = async (req, res) => {
  try {
    if (!DOCTOR_LEAD_ROLES.includes(req.user?.role)) {
      return errorResponse(res, "Chỉ Bác sĩ hoặc Trưởng khoa mới có thẩm quyền đóng giải quyết cảnh báo cấp cứu.", 403);
    }
    const alert = await EmergencyAlert.findOne({
      _id: req.params.alertId,
      hospitalId: req.user.hospitalId
    });
    if (!alert) return errorResponse(res, "Không tìm thấy cảnh báo.", 404);

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    alert.resolvedBy = req.user.id;
    alert.resolutionNote = req.body.note || "Đã giải quyết xử trí cấp cứu.";

    alert.timelineMilestones.push({
      action: "Giải quyết sự cố cấp cứu (Resolved)",
      performedBy: req.user.id,
      performedByName: req.user.profile?.name || req.user.username,
      timestamp: new Date(),
      notes: alert.resolutionNote
    });

    await alert.save();
    return successResponse(res, { alert }, "Đã đánh dấu giải quyết cảnh báo cấp cứu.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

export const getAlertHistory = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    if (!hospitalId) return errorResponse(res, "Tài khoản chưa được gán vào bệnh viện nào.", 403);
    const { page = 1, limit = 20, status } = req.query;

    const filter = { hospitalId };
    if (status) filter.status = status;

    const total = await EmergencyAlert.countDocuments(filter);
    const alerts = await EmergencyAlert.find(filter)
      .populate("patientId", "profile")
      .populate("triggeredByUserId", "profile.name profile.fullName")
      .populate("closureDetails.closedBy", "profile.name")
      .sort({ triggeredAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    return successResponse(res, { alerts, total }, "Lấy lịch sử cảnh báo cấp cứu thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};
