import { MriRoom } from "./models/mriRoom.model.js";
import { MriSlot } from "./models/mriSlot.model.js";
import { Visit } from "../../models/visit.model.js";
import { User } from "../auth/models/user.model.js";
import { createNotificationInternal } from "../../controllers/notification.controller.js";
import { successResponse, errorResponse } from "../../utils/response.util.js";
import { getDayRangeVN } from "../../utils/date.util.js";

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

    const { weekStart, roomId } = req.query;
    const startDate = weekStart ? new Date(weekStart) : (() => {
      const d = new Date(); d.setHours(0, 0, 0, 0);
      const day = d.getDay();
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); // Thứ 2
      return d;
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

    const { startOfDay: searchDate, endOfDay } = getDayRangeVN(preferredDate || new Date());

    // Tìm slot trống ngay bây giờ hoặc sắp tới
    const now = new Date();
    const emptySlot = await MriSlot.findOne({
      hospitalId,
      startTime: { $gte: now, $lte: endOfDay },
      status: 'available'
    }).sort({ startTime: 1 });

    if (emptySlot) {
      // Có slot trống — đặt ngay
      emptySlot.visitId = visit._id;
      emptySlot.patientId = visit.patientId;
      emptySlot.status = 'booked';
      emptySlot.priority = 1;
      await emptySlot.save();

      visit.status = 'chờ chụp';
      visit.priority = 'khẩn cấp';
      await visit.save();

      return successResponse(res, {
        slot: emptySlot,
        action: 'booked_empty_slot',
        message: "Đã đặt slot trống cho ca cấp cứu."
      }, "Xử lý cấp cứu thành công.");
    }

    // Không có slot trống — tìm slot bệnh nhân thường gần nhất để dời
    const normalSlot = await MriSlot.findOne({
      hospitalId,
      startTime: { $gte: now },
      status: 'booked',
      priority: { $gt: 1 } // Không phải cấp cứu
    }).sort({ startTime: 1 }).populate("patientId", "profile.name email");

    if (!normalSlot) {
      return errorResponse(res, "Không tìm được slot nào để dời. Liên hệ quản lý phòng máy.", 400);
    }

    // Soạn bản nháp thông báo dời lịch (chưa gửi — lễ tân phải xác nhận)
    const draftNotification = {
      patientName: normalSlot.patientId?.profile?.name || normalSlot.patientId?.profile?.fullName || "Bệnh nhân",
      patientEmail: normalSlot.patientId?.email,
      originalSlotId: normalSlot._id,
      originalStartTime: normalSlot.startTime,
      emergencyVisitId: visit._id,
      message: `Kính gửi quý bệnh nhân, do có ca cấp cứu cần ưu tiên, lịch chụp MRI của bạn lúc ${normalSlot.startTime.toLocaleString('vi-VN')} cần được dời sang thời điểm khác. Xin lỗi vì sự bất tiện này.`,
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

    // Gửi thông báo cho bệnh nhân bị dời (qua notification system)
    if (originalVisitId) {
      try {
        const originalVisit = await Visit.findById(originalVisitId);
        if (originalVisit?.patientId) {
          await createNotificationInternal({
            hospitalId: req.user.hospitalId,
            recipientId: originalVisit.patientId,
            senderId: req.user.id,
            type: "slot_rescheduled",
            title: "📅 Lịch chụp MRI đã được dời",
            message: "Do có ca cấp cứu cần ưu tiên, lịch chụp MRI của bạn đã được dời. Vui lòng liên hệ lễ tân để đặt lại lịch.",
            relatedId: originalVisitId,
          });
        }
      } catch (notifErr) {
        console.warn("⚠️ Không thể gửi thông báo dời lịch cho bệnh nhân:", notifErr.message);
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

    return successResponse(res, { slot }, "Đã xác nhận dời lịch và đặt slot cho ca cấp cứu.");
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
