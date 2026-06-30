import { isValidObjectId } from "mongoose";
import { WorkSchedule } from "../models/workSchedule.model.js";
import { SwapRequest } from "../models/swapRequest.model.js";
import { User } from "../models/user.model.js";
import { Visit } from "../models/visit.model.js";
import { successResponse, errorResponse } from "../utils/response.util.js";
import { sendSwapRequestResultEmail } from "../services/email.service.js";

// Helper to get week start and end dates
function getWeekRange(weekStr) {
  // weekStr is expected to be "YYYY-Www" or a Date string
  // Default to current week if none provided
  let start = new Date();
  if (weekStr) {
    start = new Date(weekStr);
  }
  
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(start.setDate(diff));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

// ─────────────────────────────────────────────────────────────────────────────
// SC-01: Tạo ca làm việc cho nhân viên
// POST /api/v1/schedules
// @access hospital_admin
// ─────────────────────────────────────────────────────────────────────────────
export const createSchedule = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    if (!hospitalId) {
      return errorResponse(res, "Bạn chưa được gán vào bệnh viện nào.", 400);
    }

    const { staffId, date, shift, startTime, endTime, notes, status } = req.body;

    if (!staffId || !date || !shift) {
      return errorResponse(res, "Vui lòng nhập đầy đủ nhân sự, ngày và ca làm.", 400);
    }

    if (!isValidObjectId(staffId)) {
      return errorResponse(res, "ID nhân sự không hợp lệ.", 400);
    }

    // Verify staff exists and belongs to the same hospital
    const staff = await User.findById(staffId);
    if (!staff || staff.hospitalId.toString() !== hospitalId.toString()) {
      return errorResponse(res, "Nhân sự không tồn tại hoặc không thuộc cơ sở của bạn.", 404);
    }

    const parsedDate = new Date(date);
    parsedDate.setHours(0, 0, 0, 0);

    // Prevent duplicate shifts for the same staff member on the same date
    const existing = await WorkSchedule.findOne({ staffId, date: parsedDate, shift });
    if (existing) {
      return errorResponse(res, `Nhân viên đã được xếp ca ${shift} vào ngày này rồi.`, 409);
    }

    const schedule = new WorkSchedule({
      hospitalId,
      staffId,
      date: parsedDate,
      shift,
      startTime: startTime || "",
      endTime: endTime || "",
      role: staff.role,
      notes: notes || "",
      status: status || "confirmed",
    });

    await schedule.save();
    return successResponse(res, { schedule }, "Xếp lịch ca làm việc thành công!", 201);
  } catch (error) {
    console.error("Lỗi createSchedule:", error);
    return errorResponse(res, "Lỗi hệ thống khi tạo lịch làm.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SC-01b: Nhân viên tự đăng ký ca làm việc (pending)
// POST /api/v1/schedules/register
// @access doctor, nurse, technician
// ─────────────────────────────────────────────────────────────────────────────
export const registerSchedule = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    const staffId = req.user.id;

    if (!hospitalId) {
      return errorResponse(res, "Bạn chưa được gán vào bệnh viện nào.", 400);
    }

    const { date, shift, notes } = req.body;

    if (!date || !shift) {
      return errorResponse(res, "Vui lòng chọn ngày và ca muốn đăng ký.", 400);
    }

    const parsedDate = new Date(date);
    parsedDate.setHours(0, 0, 0, 0);

    const existing = await WorkSchedule.findOne({ staffId, date: parsedDate, shift });
    if (existing) {
      return errorResponse(res, `Bạn đã đăng ký hoặc được xếp ca ${shift} vào ngày này rồi.`, 409);
    }

    const schedule = new WorkSchedule({
      hospitalId,
      staffId,
      date: parsedDate,
      shift,
      role: req.user.role,
      notes: notes || "Xin đăng ký ca trực",
      status: "pending", // ALWAYS pending when staff registers
    });

    await schedule.save();
    return successResponse(res, { schedule }, "Đăng ký ca trực thành công! Vui lòng chờ phê duyệt.", 201);
  } catch (error) {
    console.error("Lỗi registerSchedule:", error);
    return errorResponse(res, "Lỗi hệ thống khi đăng ký lịch làm.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SC-02: Xem lịch tuần của toàn bộ nhân sự
// GET /api/v1/schedules
// @access hospital_admin, doctor, nurse, technician, receptionist, admin
// ─────────────────────────────────────────────────────────────────────────────
export const getWeeklySchedules = async (req, res) => {
  try {
    let hospitalId = req.user.hospitalId;
    if (!hospitalId && req.user.role === "admin" && req.query.hospitalId) {
      hospitalId = req.query.hospitalId;
    }
    
    if (!hospitalId) {
      return errorResponse(res, "Yêu cầu cung cấp hospitalId.", 400);
    }

    const { week, role } = req.query;
    const { start, end } = getWeekRange(week);

    const filter = {
      hospitalId,
      date: { $gte: start, $lte: end },
    };

    if (role) {
      filter.role = role;
    }

    const schedules = await WorkSchedule.find(filter)
      .populate("staffId", "email profile role")
      .sort({ date: 1, shift: 1 })
      .lean();

    return successResponse(res, { schedules, range: { start, end } }, "Lấy lịch làm việc tuần thành công.");
  } catch (error) {
    console.error("Lỗi getWeeklySchedules:", error);
    return errorResponse(res, "Lỗi hệ thống.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SC-03: Xem lịch làm cá nhân
// GET /api/v1/schedules/me
// @access All Staff
// ─────────────────────────────────────────────────────────────────────────────
export const getMySchedules = async (req, res) => {
  try {
    const staffId = req.user.id;
    const { week } = req.query;
    const { start, end } = getWeekRange(week);

    const schedules = await WorkSchedule.find({
      staffId,
      date: { $gte: start, $lte: end },
    })
      .sort({ date: 1, shift: 1 })
      .lean();

    return successResponse(res, { schedules, range: { start, end } }, "Lấy lịch làm cá nhân thành công.");
  } catch (error) {
    console.error("Lỗi getMySchedules:", error);
    return errorResponse(res, "Lỗi hệ thống.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SC-04: Cập nhật ca làm việc
// PUT /api/v1/schedules/:id
// @access hospital_admin
// ─────────────────────────────────────────────────────────────────────────────
export const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return errorResponse(res, "ID lịch không hợp lệ.", 400);
    }

    const schedule = await WorkSchedule.findById(id);
    if (!schedule) {
      return errorResponse(res, "Không tìm thấy lịch ca làm.", 404);
    }

    // Ownership check
    if (schedule.hospitalId.toString() !== req.user.hospitalId?.toString()) {
      return errorResponse(res, "Không có quyền chỉnh sửa lịch này.", 403);
    }

    const { shift, startTime, endTime, notes, status } = req.body;

    if (shift) schedule.shift = shift;
    if (startTime !== undefined) schedule.startTime = startTime;
    if (endTime !== undefined) schedule.endTime = endTime;
    if (notes !== undefined) schedule.notes = notes;
    if (status) schedule.status = status;

    await schedule.save();
    return successResponse(res, { schedule }, "Cập nhật ca làm việc thành công!");
  } catch (error) {
    console.error("Lỗi updateSchedule:", error);
    return errorResponse(res, "Lỗi hệ thống.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SC-05: Xóa ca làm việc
// DELETE /api/v1/schedules/:id
// @access hospital_admin
// ─────────────────────────────────────────────────────────────────────────────
export const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return errorResponse(res, "ID lịch không hợp lệ.", 400);
    }

    const schedule = await WorkSchedule.findById(id);
    if (!schedule) {
      return errorResponse(res, "Không tìm thấy lịch ca làm.", 404);
    }

    // Ownership check
    if (schedule.hospitalId.toString() !== req.user.hospitalId?.toString()) {
      return errorResponse(res, "Không có quyền xóa lịch này.", 403);
    }

    // ── Safe Schedule Cancellation Policy ─────────────────────────────────────
    // Chặn xóa ca trực nếu nhân sự đang có bệnh nhân trong hàng đợi dở dang
    const startOfDay = new Date(schedule.date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(schedule.date);
    endOfDay.setHours(23, 59, 59, 999);

    const activeVisit = await Visit.findOne({
      hospitalId: schedule.hospitalId,
      status: { $nin: ["hoàn tất", "đã đóng"] },
      createdAt: { $gte: startOfDay, $lte: endOfDay },
      $or: [
        { doctorId: schedule.staffId },
        { nurseId: schedule.staffId },
        { technicianId: schedule.staffId }
      ]
    });

    if (activeVisit) {
      return errorResponse(
        res, 
        "Không thể xóa ca trực này vì nhân viên đang có bệnh nhân trong hàng đợi hoặc ca khám chưa hoàn tất.", 
        400
      );
    }
    // ─────────────────────────────────────────────────────────────────────────

    await WorkSchedule.findByIdAndDelete(id);
    return successResponse(res, { deletedId: id }, "Xóa ca làm việc thành công!");
  } catch (error) {
    console.error("Lỗi deleteSchedule:", error);
    return errorResponse(res, "Lỗi hệ thống.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SC-06: Nhân viên gửi yêu cầu đổi ca
// POST /api/v1/schedules/swap-requests
// @access All Staff
// ─────────────────────────────────────────────────────────────────────────────
export const createSwapRequest = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    const requesterId = req.user.id;

    if (!hospitalId) {
      return errorResponse(res, "Yêu cầu tài khoản thuộc bệnh viện.", 400);
    }

    const { scheduleId, targetStaffId, targetDate, reason } = req.body;

    if (!scheduleId || !targetDate) {
      return errorResponse(res, "Vui lòng nhập lịch cần đổi và ngày muốn đổi.", 400);
    }

    if (!isValidObjectId(scheduleId)) {
      return errorResponse(res, "ID lịch không hợp lệ.", 400);
    }

    // Verify schedule ownership
    const schedule = await WorkSchedule.findById(scheduleId);
    if (!schedule || schedule.staffId.toString() !== requesterId.toString()) {
      return errorResponse(res, "Không tìm thấy ca làm việc thuộc về bạn.", 404);
    }

    if (targetStaffId) {
      if (!isValidObjectId(targetStaffId)) {
        return errorResponse(res, "ID nhân sự đổi cùng không hợp lệ.", 400);
      }
      const targetStaff = await User.findById(targetStaffId);
      if (!targetStaff || targetStaff.hospitalId.toString() !== hospitalId.toString()) {
        return errorResponse(res, "Nhân sự đổi cùng không cùng cơ sở.", 400);
      }
    }

    const swapRequest = new SwapRequest({
      hospitalId,
      requesterId,
      scheduleId,
      targetStaffId: targetStaffId || null,
      targetDate: new Date(targetDate),
      reason: reason || "",
      status: "pending",
    });

    await swapRequest.save();
    return successResponse(res, { swapRequest }, "Gửi yêu cầu đổi ca làm thành công! Chờ Admin phê duyệt.", 201);
  } catch (error) {
    console.error("Lỗi createSwapRequest:", error);
    return errorResponse(res, "Lỗi hệ thống khi gửi yêu cầu đổi ca.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SC-07: Xem danh sách yêu cầu đổi ca
// GET /api/v1/schedules/swap-requests
// @access hospital_admin, doctor, nurse, technician, receptionist
// ─────────────────────────────────────────────────────────────────────────────
export const getSwapRequests = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    if (!hospitalId) {
      return errorResponse(res, "Yêu cầu tài khoản thuộc bệnh viện.", 400);
    }

    const { status } = req.query;
    const filter = { hospitalId };

    if (status) {
      filter.status = status;
    }

    // If not admin, staff can only see their own requests (or requests targeted to them)
    if (req.user.role !== "hospital_admin" && req.user.role !== "admin") {
      filter.$or = [
        { requesterId: req.user.id },
        { targetStaffId: req.user.id }
      ];
    }

    const requests = await SwapRequest.find(filter)
      .populate("requesterId", "email profile role")
      .populate("targetStaffId", "email profile role")
      .populate({
        path: "scheduleId",
        select: "date shift startTime endTime"
      })
      .sort({ createdAt: -1 })
      .lean();

    return successResponse(res, { requests }, "Lấy danh sách yêu cầu đổi ca thành công.");
  } catch (error) {
    console.error("Lỗi getSwapRequests:", error);
    return errorResponse(res, "Lỗi hệ thống.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SC-08: Admin duyệt hoặc từ chối đổi ca
// PUT /api/v1/schedules/swap-requests/:id
// @access hospital_admin
// ─────────────────────────────────────────────────────────────────────────────
export const reviewSwapRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewNotes } = req.body; // status: 'approved' | 'rejected'

    if (!["approved", "rejected"].includes(status)) {
      return errorResponse(res, "Trạng thái phê duyệt phải là 'approved' hoặc 'rejected'.", 400);
    }

    const swapRequest = await SwapRequest.findById(id);
    if (!swapRequest) {
      return errorResponse(res, "Không tìm thấy yêu cầu đổi ca.", 404);
    }

    if (swapRequest.hospitalId.toString() !== req.user.hospitalId.toString()) {
      return errorResponse(res, "Không có quyền phê duyệt yêu cầu này.", 403);
    }

    if (swapRequest.status !== "pending") {
      return errorResponse(res, "Yêu cầu này đã được xử lý từ trước.", 400);
    }

    swapRequest.status = status;
    swapRequest.reviewedBy = req.user.id;
    swapRequest.reviewNotes = reviewNotes || "";

    let shiftDetailsText = "Đổi ca";
    const schedule = await WorkSchedule.findById(swapRequest.scheduleId);
    if (schedule) {
      const formattedDate = new Date(schedule.date).toLocaleDateString("vi-VN");
      shiftDetailsText = `Ca trực ${schedule.shift === "morning" ? "Sáng" : schedule.shift === "afternoon" ? "Chiều" : schedule.shift === "night" ? "Tối" : "Cả ngày"} ngày ${formattedDate}`;
    }

    if (status === "approved") {
      // Perform the actual schedule swap / transfer ownership of schedule
      if (schedule) {
        if (swapRequest.targetStaffId) {
          // If swapping with targetStaffId, check if target staff has a shift at targetDate.
          // Swap their staff IDs
          const targetSchedule = await WorkSchedule.findOne({
            staffId: swapRequest.targetStaffId,
            date: swapRequest.targetDate,
            shift: schedule.shift
          });

          if (targetSchedule) {
            // Swap them
            targetSchedule.staffId = swapRequest.requesterId;
            await targetSchedule.save();
          }
          
          schedule.staffId = swapRequest.targetStaffId;
          // Giữ nguyên ngày của ca gốc (không đổi sang targetDate), chỉ hoán đổi nhân sự
          await schedule.save();
        } else {
          // Giveaway shift / update to targetDate (Đổi ngày ca trực cá nhân)
          schedule.date = swapRequest.targetDate;
          await schedule.save();
        }
      }
    }

    await swapRequest.save();

    // ── Gửi email thông báo tự động tới nhân viên ────────────────────────────
    try {
      const requester = await User.findById(swapRequest.requesterId).lean();
      if (requester && requester.email) {
        const staffName = requester.profile?.name || requester.profile?.fullName || "Bác sĩ";
        // Gửi email không chặn luồng chính (fire-and-forget)
        sendSwapRequestResultEmail({
          toEmail: requester.email,
          staffName,
          status,
          shiftDetails: shiftDetailsText,
          reviewNotes: reviewNotes || "Không có ghi chú thêm."
        }).catch(e => console.error("Lỗi gửi mail đổi ca:", e.message));
      }
    } catch (mailErr) {
      console.warn("⚠️ Không thể kích hoạt email gửi kết quả đổi ca trực:", mailErr.message);
    }
    // ─────────────────────────────────────────────────────────────────────────

    return successResponse(res, { swapRequest }, `Đã ${status === "approved" ? "phê duyệt" : "từ chối"} yêu cầu đổi ca trực thành công!`);
  } catch (error) {
    console.error("Lỗi reviewSwapRequest:", error);
    return errorResponse(res, "Lỗi hệ thống.", 500);
  }
};
