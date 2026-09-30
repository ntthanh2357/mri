import { EmergencyAlert, EmergencyEvent } from "../models/emergencyAlert.model.js";
import { Visit } from "../models/visit.model.js";
import { User } from "../models/user.model.js";
import { MedicalRecord } from "../modules/emr/models/medicalRecord.model.js";
import { AiJob } from "../models/aiJob.model.js";
import { createNotificationInternal } from "./notification.controller.js";
import { successResponse, errorResponse } from "../utils/response.util.js";

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
      u.role === 'doctor' && (
        /ngoại|thần kinh|phẫu thuật|neuro/i.test(u.profile?.specialty || "") ||
        /ngoại|thần kinh/i.test(u.profile?.department || "")
      )
    ) || candidates.find(u => u.role === 'doctor');

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
    ) || candidates.find(u => u.role === 'doctor' && u._id.toString() !== neurosurgeon?._id.toString());

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
      u.role === 'technician' ||
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
        { "profile.isOnCall": true, role: { $in: ['doctor', 'nurse', 'technician'] } }
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

    const medicalRecord = await MedicalRecord.findOne({
      hospitalId,
      patientId: String(patientId),
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
    const hospitalId = req.user.hospitalId;
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
          age: age || 40,
          gender: gender || "Nam",
          phone: "0000000000"
        }
      });
      await patient.save();
    }

    // Tạo lượt khám Cấp cứu với cơ chế: Chụp trước, thu sau
    const visit = new Visit({
      hospitalId,
      patientId: patient._id,
      type: 'cấp cứu',
      priority: 'khẩn cấp',
      status: 'đang khám',
      reason: situation || "Tiếp nhận cấp cứu chuyển từ Khoa Cấp Cứu",
      diagnosis: assessment || "Nghi ngờ tổn thương u não nguy kịch"
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
    if (!["doctor", "admin", "hospital_admin"].includes(req.user.role)) {
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
    const { id } = req.params;
    const { role } = req.body; // 'neurosurgeon' | 'neuro_icu' | 'nurse_lead' | 'radiology_tech'

    const event = await EmergencyAlert.findOne({ _id: id, hospitalId: req.user.hospitalId });
    if (!event) return errorResponse(res, "Không tìm thấy sự kiện cấp cứu.", 404);
    if (['closed', 'cancelled_false_alarm'].includes(event.status)) {
      return errorResponse(res, "Sự kiện cấp cứu này đã kết thúc hoặc bị hủy.", 400);
    }

    // Xác định vai trò của người gọi
    let matchedRole = role;
    if (!matchedRole) {
      if (req.user.role === 'nurse') matchedRole = 'nurse_lead';
      else if (req.user.role === 'technician') matchedRole = 'radiology_tech';
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
    const { id } = req.params;
    const { cancelReason } = req.body;

    if (!cancelReason || cancelReason.trim() === '') {
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
// 7. Y LỆNH MIỆNG CẤP CỨU & KÝ BỔ SUNG (VERBAL ORDER)
// POST /api/v1/emergency/verbal-order
// ══════════════════════════════════════════════════════════════════════════════
export const createVerbalOrder = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    const {
      emergencyEventId,
      medicalRecordId,
      orderText,
      isControlledSubstance = false,
      nurseReceivedId,
      nurseReceivedName,
      countersignHours = 24
    } = req.body;

    if (!emergencyEventId || !orderText) {
      return errorResponse(res, "Thiếu ID sự kiện cấp cứu hoặc nội dung y lệnh.", 400);
    }

    const event = await EmergencyAlert.findOne({ _id: emergencyEventId, hospitalId });
    if (!event) return errorResponse(res, "Không tìm thấy sự kiện cấp cứu liên kết.", 404);

    // Tìm MedicalRecord tương ứng
    let record = null;
    if (medicalRecordId) {
      record = await MedicalRecord.findOne({ _id: medicalRecordId, hospitalId });
    } else if (event.patientId) {
      record = await MedicalRecord.findOne({
        hospitalId,
        patientId: String(event.patientId),
        status: { $in: ["Đang điều trị", "Cấp cứu"] }
      }).sort({ createdAt: -1 });
    }

    if (!record) {
      return errorResponse(res, "Không tìm thấy hồ sơ bệnh án để ghi nhận y lệnh miệng.", 404);
    }

    const deadline = new Date(Date.now() + countersignHours * 3600 * 1000);

    const newVerbalOrder = {
      emergencyEventId: event._id,
      orderText,
      isControlledSubstance: Boolean(isControlledSubstance),
      prescribedAt: new Date(),
      prescribedByDoctorId: req.user.id,
      prescribedByDoctorName: req.user.profile?.name || req.user.username,
      nurseReceivedId: nurseReceivedId || req.user.id,
      nurseReceivedName: nurseReceivedName || req.user.profile?.name || "Điều dưỡng trực tiếp nhận",
      isReadBackConfirmed: true,
      countersignDeadline: deadline,
      status: "pending_countersign"
    };

    record.verbalOrders.push(newVerbalOrder);
    await record.save();

    // Ghi nhận mốc thời gian vào EmergencyEvent
    event.timelineMilestones.push({
      action: `Ra y lệnh miệng: ${orderText}`,
      performedBy: req.user.id,
      performedByName: req.user.profile?.name || req.user.username,
      timestamp: new Date(),
      notes: `Đọc lại (Read-Back) xác nhận. ${isControlledSubstance ? '[THUỐC HƯỚNG THẦN/GÂY NGHIỆN: TT 20/2017]' : ''}. Hạn ký bổ sung EMR: ${countersignHours} giờ.`
    });

    if (event.status === 'acknowledged' || event.status === 'triggered') {
      event.status = 'in_progress';
    }
    await event.save();

    return successResponse(res, {
      verbalOrder: newVerbalOrder,
      recordId: record._id,
      event
    }, "Ghi nhận y lệnh miệng thành công. Chờ ký số bổ sung trong 24 giờ.", 201);
  } catch (err) {
    return errorResponse(res, "Lỗi tạo y lệnh miệng: " + err.message, 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 8. ĐỀ XUẤT CHÈN LỊCH MRI 3.0T KHẨN (PRE-MRI SAFETY GATE)
// POST /api/v1/emergency/request-mri-override
// ══════════════════════════════════════════════════════════════════════════════
export const requestMriOverride = async (req, res) => {
  try {
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
    const { status } = req.query;

    const query = {
      hospitalId,
      status: status || { $in: ['active', 'triggered', 'acknowledged', 'in_progress', 'escalated'] }
    };

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
    if (!["doctor", "admin", "hospital_admin", "nurse"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ nhân viên y tế mới có thể kích hoạt cấp cứu.", 403);
    }

    const hospitalId = req.user.hospitalId;
    const { visitId, patientId, imagingResultId, level = 'RED', reason } = req.body;

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
