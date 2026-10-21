import { MriRoom } from "./models/mriRoom.model.js";
import { MriSlot } from "./models/mriSlot.model.js";
import { Visit } from "../../models/visit.model.js";
import { User } from "../auth/models/user.model.js";
import { createNotificationInternal } from "../../controllers/notification.controller.js";
import { successResponse, errorResponse } from "../../utils/response.util.js";
import { getDayRangeVN } from "../../utils/date.util.js";
import { sendMriRescheduleEmail } from "../../services/email.service.js";

const fmtVN = (d) => new Date(d).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * UC-REC-04 — Tìm khung giờ chụp trống gần nhất (không cần slot tạo sẵn).
 * Duyệt từng ngày (tối đa maxDays) và từng phòng MRI đang hoạt động theo giờ mở cửa,
 * bỏ qua giờ đã qua và các khung trùng với slot đã đặt / đang chụp.
 */
const findFreeWindow = async (hospitalId, fromDate, maxDays = 1, { dayStartMin = 0, dayEndMin = 1440 } = {}) => {
  const rooms = await MriRoom.find({ hospitalId, status: 'active' }).lean();
  if (!rooms.length) return null;
  const earliest = Math.max(Date.now(), new Date(fromDate).getTime());
  for (let d = 0; d < maxDays; d++) {
    const { startOfDay } = getDayRangeVN(new Date(new Date(fromDate).getTime() + d * 86400000));
    let best = null;
    for (const room of rooms) {
      const dayEnd = startOfDay.getTime() + 86400000;
      const taken = await MriSlot.find({
        roomId: room._id,
        startTime: { $gte: startOfDay, $lt: new Date(dayEnd) },
        status: { $in: ['booked', 'in_progress'] },
      }).select('startTime endTime').lean();
      // Phòng đã đủ số ca tối đa trong ngày thì bỏ qua
      if (taken.length >= (room.maxSlotsPerDay || 16)) continue;
      const toMin = (hhmm, fallback) => {
        const [hh, mm] = String(hhmm || fallback).split(":").map(Number);
        return hh * 60 + (mm || 0);
      };
      // Duyệt từ giờ mở cửa đến giờ đóng cửa (phòng cấp cứu có thể mở 00:00 – 24:00)
      const openMin = toMin(room.operatingHours?.start, "07:00");
      const closeMin = toMin(room.operatingHours?.end, "17:00");
      const dur = room.slotDurationMinutes || 30;
      for (let t = openMin; t + dur <= closeMin; t += dur) {
        const s = startOfDay.getTime() + t * 60000;
        const e = s + dur * 60000;
        if (s < earliest) continue;
        // Giới hạn khung giờ trong ngày (VD lịch dời cho bệnh nhân thường chỉ trong 07:00–20:00)
        if (t < dayStartMin || t + dur > dayEndMin) continue;
        if (taken.some((t) => s < new Date(t.endTime).getTime() && e > new Date(t.startTime).getTime())) continue;
        if (!best || s < best.start.getTime()) best = { room, start: new Date(s), end: new Date(e) };
        break;
      }
    }
    if (best) return best;
  }
  return null;
};

// ─── A.1 — Lấy danh sách phòng MRI ───────────────────────────────────────────
export const getRooms = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    if (!hospitalId) return errorResponse(res, "Bạn chưa được gán vào bệnh viện nào.", 403);

    const rooms = await MriRoom.find({ hospitalId }).sort({ name: 1 }).lean();
    return successResponse(res, rooms, "Lấy danh sách phòng MRI thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── A.1 — Tạo phòng MRI mới ─────────────────────────────────────────────────
export const createRoom = async (req, res) => {
  try {
    if (!["admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ admin mới có thể thêm phòng MRI.", 403);
    }
    const hospitalId = req.user.hospitalId;
    if (!hospitalId) return errorResponse(res, "Bạn chưa được gán vào bệnh viện nào.", 403);

    const { name, modelMachine, location, maxSlotsPerDay, slotDurationMinutes, operatingHours, notes } = req.body;
    if (!name) return errorResponse(res, "Tên phòng MRI là bắt buộc.", 400);

    const room = new MriRoom({
      hospitalId,
      name,
      modelMachine: modelMachine || "",
      location: location || "",
      maxSlotsPerDay: maxSlotsPerDay || 16,
      slotDurationMinutes: slotDurationMinutes || 30,
      operatingHours: operatingHours || { start: "07:00", end: "17:00" },
      notes: notes || "",
    });
    await room.save();
    return successResponse(res, room, "Tạo phòng MRI thành công.", 201);
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── A.1 — Cập nhật phòng MRI ────────────────────────────────────────────────
export const updateRoom = async (req, res) => {
  try {
    if (!["admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ admin mới có thể cập nhật phòng MRI.", 403);
    }
    const room = await MriRoom.findOne({ _id: req.params.id, hospitalId: req.user.hospitalId });
    if (!room) return errorResponse(res, "Không tìm thấy phòng MRI.", 404);

    const allowedFields = ["name", "modelMachine", "location", "status", "maxSlotsPerDay", "slotDurationMinutes", "operatingHours", "notes"];
    allowedFields.forEach(f => { if (req.body[f] !== undefined) room[f] = req.body[f]; });

    await room.save();
    return successResponse(res, room, "Cập nhật phòng MRI thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── A.1 — Xóa (deactivate) phòng MRI ───────────────────────────────────────
export const deleteRoom = async (req, res) => {
  try {
    if (!["admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ admin mới có thể xóa phòng MRI.", 403);
    }
    const room = await MriRoom.findOne({ _id: req.params.id, hospitalId: req.user.hospitalId });
    if (!room) return errorResponse(res, "Không tìm thấy phòng MRI.", 404);

    // Kiểm tra có slot sắp tới không
    const upcomingSlots = await MriSlot.countDocuments({
      roomId: room._id,
      startTime: { $gte: new Date() },
      status: { $in: ['booked', 'in_progress'] }
    });
    if (upcomingSlots > 0) {
      return errorResponse(res, `Phòng này còn ${upcomingSlots} lịch hẹn sắp tới. Hủy hoặc dời lịch trước khi xóa.`, 400);
    }

    room.status = 'inactive';
    await room.save();
    return successResponse(res, null, "Đã tắt hoạt động phòng MRI.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── A.2 — Đặt lịch chụp tự động ────────────────────────────────────────────
export const autoScheduleSlot = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    const { visitId, preferredDate, priority = 5 } = req.body;

    if (!visitId) return errorResponse(res, "Thiếu ID lượt khám.", 400);

    const visit = await Visit.findOne({ _id: visitId, hospitalId });
    if (!visit) return errorResponse(res, "Không tìm thấy lượt khám.", 404);

    // Tìm tất cả phòng active
    const rooms = await MriRoom.find({ hospitalId, status: 'active' }).lean();
    if (!rooms.length) return errorResponse(res, "Bệnh viện chưa có phòng MRI nào đang hoạt động.", 400);

    const { startOfDay: searchDate, endOfDay } = getDayRangeVN(preferredDate || new Date());

    // Tìm phòng có ít slot nhất trong ngày
    let bestRoom = null;
    let minSlots = Infinity;

    for (const room of rooms) {
      const count = await MriSlot.countDocuments({
        roomId: room._id,
        startTime: { $gte: searchDate, $lte: endOfDay },
        status: { $in: ['booked', 'in_progress'] }
      });
      if (count < room.maxSlotsPerDay && count < minSlots) {
        minSlots = count;
        bestRoom = room;
      }
    }

    if (!bestRoom) {
      return errorResponse(res, "Không có phòng MRI trống trong ngày đã chọn. Thử ngày khác.", 400);
    }

    // Lấy danh sách các slot đã đặt trong ngày của phòng được chọn để tránh trùng lịch (overlap)
    const existingSlots = await MriSlot.find({
      roomId: bestRoom._id,
      startTime: { $gte: searchDate, $lte: endOfDay },
      status: { $in: ['booked', 'in_progress'] }
    }).select('startTime endTime').sort({ startTime: 1 }).lean();

    // Tính giờ bắt đầu theo múi giờ chuẩn VN (GMT+7) dựa trên offset từ searchDate (00:00:00 GMT+7)
    // Tránh dùng Date.prototype.setHours vì setHours bị lệch theo múi giờ cục bộ của server runtime (UTC)
    const [startH, startM] = (bestRoom.operatingHours?.start || "07:00").split(":").map(Number);
    let slotStart = null;
    let slotEnd = null;

    for (let i = 0; i < bestRoom.maxSlotsPerDay; i++) {
      const candidateStartMs = searchDate.getTime() + (startH * 60 + startM + i * bestRoom.slotDurationMinutes) * 60000;
      const candidateEndMs = candidateStartMs + bestRoom.slotDurationMinutes * 60000;
      if (candidateStartMs < Date.now()) continue; // UC-REC-04: không đặt lịch vào giờ đã qua

      // Kiểm tra xem khung giờ này có bị trùng với slot nào đã đặt không (chống đè slot khi có ca hủy ở giữa)
      const isConflict = existingSlots.some(s => {
        const sStart = new Date(s.startTime).getTime();
        const sEnd = new Date(s.endTime).getTime();
        return candidateStartMs < sEnd && candidateEndMs > sStart;
      });

      if (!isConflict) {
        slotStart = new Date(candidateStartMs);
        slotEnd = new Date(candidateEndMs);
        break;
      }
    }

    if (!slotStart) {
      return errorResponse(res, "Không còn khung giờ trống trong ngày đã chọn cho phòng này.", 400);
    }

    const slot = new MriSlot({
      hospitalId,
      roomId: bestRoom._id,
      visitId: visit._id,
      patientId: visit.patientId,
      technicianId: visit.technicianId || null,
      startTime: slotStart,
      endTime: slotEnd,
      status: 'booked',
      priority: Number(priority),
    });
    await slot.save();

    // Cập nhật visit status
    visit.status = 'chờ chụp';
    await visit.save();

    // Thông báo cho KTV (A.6 tiền đề)
    if (visit.technicianId) {
      try {
        await createNotificationInternal({
          hospitalId,
          recipientId: visit.technicianId,
          senderId: req.user.id,
          type: "mri_scheduled",
          title: "📅 Lịch chụp MRI mới",
          message: `Đã đặt lịch chụp MRI vào ${slotStart.toLocaleString('vi-VN')} tại ${bestRoom.name}.`,
          relatedId: slot._id,
        });
      } catch (notifErr) {
        console.warn("⚠️ Không thể gửi thông báo lịch MRI:", notifErr.message);
      }
    }

    return successResponse(res, {
      slot,
      room: { id: bestRoom._id, name: bestRoom.name },
      startTime: slotStart,
      endTime: slotEnd,
    }, "Đặt lịch chụp MRI thành công.", 201);
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── A.3 — Xem lịch phòng MRI theo tuần ────────────────────────────────────
export const getWeeklySchedule = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    if (!hospitalId) return errorResponse(res, "Bạn chưa được gán vào bệnh viện nào.", 403);

    const startDate = weekStart ? new Date(weekStart) : (() => {
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - (day === 0 ? 6 : day - 1); // Thứ 2
      const monday = new Date(now.setDate(diff));
      const { startOfDay } = getDayRangeVN(monday);
      return startOfDay;
    })();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    const roomFilter = { hospitalId };
    if (roomId) roomFilter._id = roomId;
    const rooms = await MriRoom.find(roomFilter).lean();

    const slotFilter = {
      hospitalId,
      startTime: { $gte: startDate, $lt: endDate }
    };
    if (roomId) slotFilter.roomId = roomId;

    const slots = await MriSlot.find(slotFilter)
      .populate("patientId", "profile.name profile.fullName email")
      .populate("technicianId", "profile.name")
      .sort({ startTime: 1 })
      .lean();

    // Group slots theo roomId
    const schedule = rooms.map(room => ({
      room,
      slots: slots.filter(s => s.roomId.toString() === room._id.toString())
    }));

    return successResponse(res, { weekStart: startDate, schedule }, "Lấy lịch MRI tuần thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── A.4 — Xử lý cấp cứu (Emergency Override) ────────────────────────────────
export const handleEmergencyOverride = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    const { visitId, preferredDate } = req.body;

    if (!visitId) return errorResponse(res, "Thiếu ID lượt khám cấp cứu.", 400);

    const visit = await Visit.findOne({ _id: visitId, hospitalId });
    if (!visit) return errorResponse(res, "Không tìm thấy lượt khám.", 404);

    const now = new Date();

    // 1. Ca cấp cứu đã có lịch chụp thì không xếp thêm
    const alreadyBooked = await MriSlot.findOne({ hospitalId, visitId: visit._id, status: { $in: ['booked', 'in_progress'] } })
      .populate("roomId", "name").lean();
    if (alreadyBooked) {
      return successResponse(res, { slot: alreadyBooked, action: 'already_booked' }, "Ca cấp cứu này đã có lịch chụp MRI.");
    }

    // 2. Còn khung giờ trống trong ngày (tính theo giờ hoạt động thực tế của phòng máy) → đặt ngay, ưu tiên 1
    const window = await findFreeWindow(hospitalId, now, 1);
    if (window) {
      const slot = await MriSlot.create({
        hospitalId,
        roomId: window.room._id,
        visitId: visit._id,
        patientId: visit.patientId,
        startTime: window.start,
        endTime: window.end,
        status: 'booked',
        priority: 1,
      });
      visit.status = 'chờ chụp';
      visit.priority = 'khẩn cấp';
      await visit.save();
      return successResponse(res, {
        slot: { ...slot.toObject(), roomId: { _id: window.room._id, name: window.room.name } },
        action: 'booked_empty_slot',
        message: `Đã xếp ca cấp cứu vào ${window.room.name} lúc ${fmtVN(window.start)}.`
      }, "Xử lý cấp cứu thành công.");
    }

    // 3. Hết chỗ trong ngày — chọn slot bệnh nhân thường gần nhất để nhường cho cấp cứu
    const normalSlot = await MriSlot.findOne({
      hospitalId,
      startTime: { $gte: now },
      status: 'booked',
      priority: { $gt: 1 } // Không phải cấp cứu
    }).sort({ startTime: 1 }).populate("patientId", "profile.name profile.fullName email").populate("roomId", "name");

    if (!normalSlot) {
      return errorResponse(res, "Phòng máy đã kín lịch và không có ca thường nào để dời. Liên hệ quản lý phòng máy.", 400);
    }

    // Gợi ý khung giờ trống mới cho bệnh nhân bị dời (tìm từ ngày hôm sau, tối đa 7 ngày)
    const { endOfDay: todayEnd } = getDayRangeVN(now);
    const suggestion = await findFreeWindow(hospitalId, new Date(todayEnd.getTime() + 1), 7, { dayStartMin: 7 * 60, dayEndMin: 20 * 60 });

    // Soạn bản nháp thông báo dời lịch (chưa gửi — lễ tân phải xác nhận)
    const draftNotification = {
      patientName: normalSlot.patientId?.profile?.name || normalSlot.patientId?.profile?.fullName || "Bệnh nhân",
      patientEmail: normalSlot.patientId?.email,
      originalSlotId: normalSlot._id,
      originalStartTime: normalSlot.startTime,
      roomName: normalSlot.roomId?.name || '',
      emergencyVisitId: visit._id,
      suggestedNewStartTime: suggestion?.start || null,
      suggestedRoomName: suggestion?.room?.name || null,
      message: `Kính gửi quý bệnh nhân, do có ca cấp cứu cần ưu tiên, lịch chụp MRI của bạn lúc ${fmtVN(normalSlot.startTime)} được dời sang ${suggestion ? fmtVN(suggestion.start) : 'thời điểm khác (lễ tân sẽ liên hệ)'}. Xin lỗi vì sự bất tiện này.`,
      requiresConfirmation: true, // Lễ tân phải bấm xác nhận
    };

    return successResponse(res, {
      action: 'requires_reschedule_confirmation',
      draftNotification,
      slotToReschedule: normalSlot,
    }, "Cần xác nhận dời lịch bệnh nhân thường. Lễ tân vui lòng xác nhận trước khi thông báo.", 202);
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── A.4 — Xác nhận dời lịch và đặt slot cho cấp cứu ───────────────────────
export const confirmReschedule = async (req, res) => {
  try {
    const { slotId, emergencyVisitId } = req.body;
    if (!slotId || !emergencyVisitId) {
      return errorResponse(res, "Thiếu slotId hoặc emergencyVisitId.", 400);
    }

    const slot = await MriSlot.findOne({ _id: slotId, hospitalId: req.user.hospitalId });
    if (!slot) return errorResponse(res, "Không tìm thấy slot.", 404);

    // Lưu lại thông tin slot cũ
    const originalVisitId = slot.visitId;
    const originalStartTime = slot.startTime;

    // Đặt slot cho ca cấp cứu
    const emergencyVisit = await Visit.findById(emergencyVisitId);
    slot.visitId = emergencyVisitId;
    slot.patientId = emergencyVisit?.patientId;
    slot.priority = 1;
    slot.status = 'booked';
    slot.rescheduledFrom = originalStartTime;
    slot.rescheduledReason = "Nhường slot cho ca cấp cứu";
    await slot.save();

    if (emergencyVisit) {
      emergencyVisit.status = 'chờ chụp';
      emergencyVisit.priority = 'khẩn cấp';
      await emergencyVisit.save();
    }

    // UC-REC-04: tự động xếp lịch mới cho bệnh nhân bị dời rồi thông báo (in-app + email)
    let newSlot = null;
    let emailSent = false;
    if (originalVisitId) {
      try {
        const originalVisit = await Visit.findById(originalVisitId).populate("patientId", "email profile.name profile.fullName");
        const { endOfDay: todayEnd } = getDayRangeVN(new Date());
        const win = await findFreeWindow(req.user.hospitalId, new Date(todayEnd.getTime() + 1), 7, { dayStartMin: 7 * 60, dayEndMin: 20 * 60 });
        if (win && originalVisit) {
          newSlot = await MriSlot.create({
            hospitalId: req.user.hospitalId,
            roomId: win.room._id,
            visitId: originalVisit._id,
            patientId: originalVisit.patientId?._id || originalVisit.patientId,
            startTime: win.start,
            endTime: win.end,
            status: 'booked',
            priority: 5,
            rescheduledFrom: originalStartTime,
            rescheduledReason: "Dời lịch do nhường slot cho ca cấp cứu",
          });
        }
        if (originalVisit?.patientId) {
          const patientName = originalVisit.patientId.profile?.name || originalVisit.patientId.profile?.fullName || "Quý bệnh nhân";
          await createNotificationInternal({
            hospitalId: req.user.hospitalId,
            recipientId: originalVisit.patientId._id || originalVisit.patientId,
            senderId: req.user.id,
            type: "slot_rescheduled",
            title: "📅 Lịch chụp MRI đã được dời",
            message: newSlot
              ? `Do có ca cấp cứu cần ưu tiên, lịch chụp MRI lúc ${fmtVN(originalStartTime)} đã được dời sang ${fmtVN(newSlot.startTime)} (${win.room.name}).`
              : "Do có ca cấp cứu cần ưu tiên, lịch chụp MRI của bạn đã được dời. Lễ tân sẽ liên hệ để sắp xếp lại.",
            relatedId: originalVisitId,
          });
          emailSent = await sendMriRescheduleEmail({
            toEmail: originalVisit.patientId.email,
            patientName,
            oldTime: originalStartTime,
            newTime: newSlot?.startTime || null,
          });
        }
      } catch (notifErr) {
        console.warn("⚠️ Không thể xếp lại lịch / thông báo cho bệnh nhân bị dời:", notifErr.message);
      }
    }

    // Gửi thông báo tự động cho Kỹ thuật viên qua notification system
    if (slot.technicianId) {
      try {
        await createNotificationInternal({
          hospitalId: req.user.hospitalId,
          recipientId: slot.technicianId,
          senderId: req.user.id,
          type: "emergency_slot_override",
          title: "🚨 CA CẤP CỨU CHÈN LỊCH CHỤP MRI",
          message: `Slot chụp lúc ${slot.startTime.toLocaleString('vi-VN')} đã được điều phối cho ca cấp cứu khẩn cấp.`,
          relatedId: slot._id,
        });
      } catch (ktvErr) {
        console.warn("⚠️ Không thể gửi thông báo cho KTV:", ktvErr.message);
      }
    }

    return successResponse(
      res,
      { slot, newSlot, emailSent },
      newSlot
        ? `Đã nhường slot cho ca cấp cứu và dời bệnh nhân thường sang ${fmtVN(newSlot.startTime)}.`
        : "Đã nhường slot cho ca cấp cứu. Chưa tìm được khung giờ mới trong 7 ngày — vui lòng liên hệ bệnh nhân."
    );
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── A.5 — Giải phóng phòng sau khi chụp xong ────────────────────────────────
export const releaseRoom = async (req, res) => {
  try {
    const { slotId } = req.params;
    const slot = await MriSlot.findOne({ _id: slotId, hospitalId: req.user.hospitalId });
    if (!slot) return errorResponse(res, "Không tìm thấy slot.", 404);

    slot.status = 'completed';
    await slot.save();

    // Cập nhật trạng thái visit
    if (slot.visitId) {
      const visit = await Visit.findById(slot.visitId);
      if (visit && visit.status === 'đang chụp') {
        visit.status = 'chờ kết quả AI';
        await visit.save();
      }
    }

    return successResponse(res, { slot }, "Đã giải phóng phòng MRI và chuyển trạng thái chờ AI.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── Lấy slots của một visit ─────────────────────────────────────────────────
export const getSlotsByVisit = async (req, res) => {
  try {
    const { visitId } = req.params;
    const slots = await MriSlot.find({ visitId, hospitalId: req.user.hospitalId })
      .populate("roomId", "name location")
      .sort({ startTime: 1 })
      .lean();
    return successResponse(res, slots, "Lấy lịch chụp của lượt khám thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};
