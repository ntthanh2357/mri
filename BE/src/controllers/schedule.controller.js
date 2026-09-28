import { isValidObjectId } from "mongoose";
import { WorkSchedule } from "../models/workSchedule.model.js";
import { SwapRequest } from "../models/swapRequest.model.js";
import { User } from "../models/user.model.js";
import { Visit } from "../models/visit.model.js";
import { successResponse, errorResponse } from "../utils/response.util.js";
import { sendSwapRequestResultEmail } from "../services/email.service.js";
import { getDayRangeVN, getWeekRangeVN } from "../utils/date.util.js";

// Giờ trực chuẩn mặc định theo từng loại ca lâm sàng tại bệnh viện
const DEFAULT_SHIFT_TIMES = {
  "sáng": { startTime: "07:00", endTime: "15:00" },
  "chiều": { startTime: "14:00", endTime: "22:00" },
  "tối": { startTime: "22:00", endTime: "06:00" },
  "cả ngày": { startTime: "07:00", endTime: "07:00" },
};

// ─────────────────────────────────────────────────────────────────────────────
// SC-01: Tạo ca làm việc cho nhân viên (Trực tiếp bởi Admin)
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

    const { startOfDay: parsedDate } = getDayRangeVN(date);

    // Prevent duplicate shifts for the same staff member on the same date
    const existing = await WorkSchedule.findOne({ staffId, date: parsedDate, shift });
    if (existing) {
      return errorResponse(res, `Nhân viên đã được xếp ca ${shift} vào ngày này rồi.`, 409);
    }

    const defaultTimes = DEFAULT_SHIFT_TIMES[shift] || { startTime: "07:00", endTime: "15:00" };

    const schedule = new WorkSchedule({
      hospitalId,
      staffId,
      date: parsedDate,
      shift,
      startTime: startTime || defaultTimes.startTime,
      endTime: endTime || defaultTimes.endTime,
      role: staff.role,
      notes: notes || "",
      status: status || "confirmed",
      reviewedBy: req.user.id,
    });

    await schedule.save();
    const populated = await WorkSchedule.findById(schedule._id)
      .populate("staffId", "email profile role")
      .populate("reviewedBy", "email profile role")
      .lean();

    return successResponse(res, { schedule: populated }, "Xếp lịch ca làm việc thành công!", 201);
  } catch (error) {
    console.error("Lỗi createSchedule:", error);
    return errorResponse(res, "Lỗi hệ thống khi tạo lịch làm.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SC-01b: Nhân viên tự đăng ký ca làm việc (pending)
// POST /api/v1/schedules/register
// @access doctor, nurse, technician, receptionist, hospital_admin
// ─────────────────────────────────────────────────────────────────────────────
export const registerSchedule = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    const staffId = req.user.id;

    if (!hospitalId) {
      return errorResponse(res, "Bạn chưa được gán vào bệnh viện nào.", 400);
    }

    const { date, shift, notes, startTime, endTime } = req.body;

    if (!date || !shift) {
      return errorResponse(res, "Vui lòng chọn ngày và ca muốn đăng ký.", 400);
    }

    const { startOfDay: parsedDate } = getDayRangeVN(date);

    const defaultTimes = DEFAULT_SHIFT_TIMES[shift] || { startTime: "07:00", endTime: "15:00" };
    const finalStartTime = startTime || defaultTimes.startTime;
    const finalEndTime = endTime || defaultTimes.endTime;

    const existing = await WorkSchedule.findOne({ staffId, date: parsedDate, shift });
    if (existing) {
      if (existing.status === "rejected") {
        // Tái nộp nếu ca trước đó bị từ chối
        existing.status = "pending";
        existing.notes = notes || "Xin đăng ký lại ca trực";
        existing.startTime = finalStartTime;
        existing.endTime = finalEndTime;
        existing.reviewNotes = "";
        existing.reviewedBy = null;
        await existing.save();

        const populated = await WorkSchedule.findById(existing._id)
          .populate("staffId", "email profile role")
          .lean();
        return successResponse(res, { schedule: populated }, "Đã đăng ký lại ca trực thành công! Vui lòng chờ Trưởng khoa phê duyệt.", 200);
      }
      return errorResponse(
        res,
        `Bạn đã có ca ${shift} (${existing.status === "confirmed" ? "đã được duyệt" : "đang chờ duyệt"}) vào ngày này rồi.`,
        409
      );
    }

    const schedule = new WorkSchedule({
      hospitalId,
      staffId,
      date: parsedDate,
      shift,
      startTime: finalStartTime,
      endTime: finalEndTime,
      role: req.user.role,
      notes: notes || "Xin đăng ký ca trực",
      status: "pending", // ALWAYS pending when staff registers
    });

    await schedule.save();

    const populated = await WorkSchedule.findById(schedule._id)
      .populate("staffId", "email profile role")
      .lean();

    return successResponse(res, { schedule: populated }, "Đăng ký ca trực thành công! Vui lòng chờ phê duyệt.", 201);
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
    if (!hospitalId && ["admin", "system_admin"].includes(req.user.role) && req.query.hospitalId) {
      hospitalId = req.query.hospitalId;
    }
    
    if (!hospitalId) {
      return errorResponse(res, "Yêu cầu cung cấp hospitalId.", 400);
    }

    const { week, role, status } = req.query;
    const { start, end } = getWeekRangeVN(week);

    const filter = {
      hospitalId,
      date: { $gte: start, $lte: end },
    };

    if (role) {
      filter.role = role;
    }

    if (status) {
      filter.status = status;
    }

    const schedules = await WorkSchedule.find(filter)
      .populate("staffId", "email profile role")
      .populate("reviewedBy", "email profile role")
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
    const { week, status } = req.query;
    const { start, end } = getWeekRangeVN(week);

    const filter = {
      staffId,
      date: { $gte: start, $lte: end },
    };

    if (status) {
      filter.status = status;
    }

    const schedules = await WorkSchedule.find(filter)
      .populate("staffId", "email profile role")
      .populate("reviewedBy", "email profile role")
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
    if (!["admin", "system_admin"].includes(req.user.role) && schedule.hospitalId.toString() !== req.user.hospitalId?.toString()) {
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
    if (!["admin", "system_admin"].includes(req.user.role) && schedule.hospitalId.toString() !== req.user.hospitalId?.toString()) {
      return errorResponse(res, "Không có quyền xóa lịch này.", 403);
    }

    // ── Safe Schedule Cancellation Policy ─────────────────────────────────────
    // Chặn xóa ca trực nếu nhân sự đang có bệnh nhân trong hàng đợi dở dang
    const { startOfDay, endOfDay } = getDayRangeVN(schedule.date);

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
// SC-05b: Lấy danh sách phiếu đăng ký ca trực (Admin xem toàn bộ, nhân viên xem của mình)
// GET /api/v1/schedules/registrations
// @access All Staff
// ─────────────────────────────────────────────────────────────────────────────
export const getShiftRegistrations = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    if (!hospitalId) {
      return errorResponse(res, "Yêu cầu tài khoản thuộc bệnh viện.", 400);
    }

    const { status, week, staffId } = req.query;
    const filter = { hospitalId };

    if (status) {
      filter.status = status;
    }

    if (week) {
      const { start, end } = getWeekRangeVN(week);
      filter.date = { $gte: start, $lte: end };
    }

    // Nếu không phải là admin, chỉ được xem danh sách của chính mình
    if (!["hospital_admin", "admin", "system_admin"].includes(req.user.role)) {
      filter.staffId = req.user.id;
    } else if (staffId && isValidObjectId(staffId)) {
      filter.staffId = staffId;
    }

    const registrations = await WorkSchedule.find(filter)
      .populate("staffId", "email profile role")
      .populate("reviewedBy", "email profile role")
      .sort({ createdAt: -1, date: -1 })
      .lean();

    return successResponse(res, { registrations }, "Lấy danh sách đăng ký ca làm thành công.");
  } catch (error) {
    console.error("Lỗi getShiftRegistrations:", error);
    return errorResponse(res, "Lỗi hệ thống.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SC-05c: Admin phê duyệt hoặc từ chối phiếu đăng ký ca trực
// PUT /api/v1/schedules/registrations/:id/review
// @access hospital_admin, admin
// ─────────────────────────────────────────────────────────────────────────────
export const reviewShiftRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewNotes, startTime, endTime } = req.body;

    if (!isValidObjectId(id)) {
      return errorResponse(res, "ID lịch không hợp lệ.", 400);
    }

    if (!["confirmed", "rejected"].includes(status)) {
      return errorResponse(res, "Trạng thái phê duyệt phải là 'confirmed' (duyệt) hoặc 'rejected' (từ chối).", 400);
    }

    const schedule = await WorkSchedule.findById(id);
    if (!schedule) {
      return errorResponse(res, "Không tìm thấy lịch đăng ký ca làm.", 404);
    }

    if (!["admin", "system_admin"].includes(req.user.role) && schedule.hospitalId.toString() !== req.user.hospitalId?.toString()) {
      return errorResponse(res, "Không có quyền duyệt lịch này.", 403);
    }

    schedule.status = status;
    schedule.reviewedBy = req.user.id;
    schedule.reviewNotes = reviewNotes || "";
    if (startTime) schedule.startTime = startTime;
    if (endTime) schedule.endTime = endTime;

    await schedule.save();

    const populated = await WorkSchedule.findById(id)
      .populate("staffId", "email profile role")
      .populate("reviewedBy", "email profile role")
      .lean();

    return successResponse(
      res,
      { schedule: populated },
      `Đã ${status === "confirmed" ? "phê duyệt" : "từ chối"} ca trực thành công!`
    );
  } catch (error) {
    console.error("Lỗi reviewShiftRegistration:", error);
    return errorResponse(res, "Lỗi hệ thống khi duyệt ca trực.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SC-05d: Nhân viên tự hủy phiếu đăng ký ca trực khi còn đang chờ duyệt
// DELETE /api/v1/schedules/registrations/:id
// @access All Staff
// ─────────────────────────────────────────────────────────────────────────────
export const cancelMyRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return errorResponse(res, "ID lịch không hợp lệ.", 400);
    }

    const schedule = await WorkSchedule.findById(id);
    if (!schedule) {
      return errorResponse(res, "Không tìm thấy ca làm việc.", 404);
    }

    const isOwner = schedule.staffId.toString() === req.user.id.toString();
    const isAdmin = ["hospital_admin", "admin", "system_admin"].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      return errorResponse(res, "Không có quyền hủy đăng ký ca làm này.", 403);
    }

    if (schedule.status !== "pending" && !isAdmin) {
      return errorResponse(res, "Chỉ có thể hủy ca đang chờ phê duyệt. Với ca đã duyệt, vui lòng gửi yêu cầu đổi ca trực.", 400);
    }

    await WorkSchedule.findByIdAndDelete(id);
    return successResponse(res, { deletedId: id }, "Hủy đăng ký ca trực thành công!");
  } catch (error) {
    console.error("Lỗi cancelMyRegistration:", error);
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
