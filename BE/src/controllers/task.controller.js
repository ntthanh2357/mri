import { Task } from "../models/task.model.js";
import { Visit } from "../models/visit.model.js";
import { User } from "../models/user.model.js";
import { Hospital } from "../models/hospital.model.js";
import { createNotificationInternal } from "./notification.controller.js";
import { successResponse, errorResponse } from "../utils/response.util.js";
import { getDayRangeVN } from "../utils/date.util.js";

// ─── Định nghĩa 8 bước quy trình chuẩn theo spec I.2 ────────────────────────
const WORKFLOW_STEPS = [
  { stepNumber: 1, title: "Tiếp nhận bệnh nhân", roleRequired: "receptionist", defaultHours: 1 },
  { stepNumber: 2, title: "Khám lâm sàng ban đầu", roleRequired: "doctor", defaultHours: 2 },
  { stepNumber: 3, title: "Chỉ định MRI", roleRequired: "doctor", defaultHours: 1 },
  { stepNumber: 4, title: "Chụp MRI", roleRequired: "technician", defaultHours: 2 },
  { stepNumber: 5, title: "Xử lý AI", roleRequired: "auto", defaultHours: 0.1 },
  { stepNumber: 6, title: "Đọc & phân tích kết quả", roleRequired: "doctor", defaultHours: 4 },
  { stepNumber: 7, title: "Ký duyệt báo cáo", roleRequired: "doctor", defaultHours: 2 },
  { stepNumber: 8, title: "Thanh toán & đóng ca", roleRequired: "receptionist", defaultHours: 1 },
];

// ─── I.2 — Tự động tạo 8 task khi visit được tạo ─────────────────────────────
export const createTasksForVisit = async (visitId, hospitalId) => {
  try {
    const visit = await Visit.findById(visitId);
    if (!visit) return null;

    const hospital = await Hospital.findById(hospitalId).lean();
    const taskDeadlines = hospital?.aiThresholds?.taskDeadlines || {};

    const now = new Date();
    let currentDeadline = new Date(now);

    const createdTasks = [];
    for (const step of WORKFLOW_STEPS) {
      let hours = step.defaultHours;
      if (step.stepNumber === 6 && taskDeadlines.readFilmHours) hours = taskDeadlines.readFilmHours;
      if (step.stepNumber === 7 && taskDeadlines.signReportHours) hours = taskDeadlines.signReportHours;

      currentDeadline = new Date(currentDeadline.getTime() + hours * 60 * 60 * 1000);

      const task = new Task({
        hospitalId,
        visitId,
        patientId: visit.patientId,
        stepNumber: step.stepNumber,
        title: step.title,
        roleRequired: step.roleRequired,
        // Bước 1 tự động in_progress, các bước sau pending
        status: step.stepNumber === 1 ? 'in_progress' : 'pending',
        deadlineAt: currentDeadline,
        startedAt: step.stepNumber === 1 ? now : null,
      });
      await task.save();
      createdTasks.push(task);
    }

    return createdTasks;
  } catch (err) {
    console.error("Lỗi createTasksForVisit:", err.message);
    return null;
  }
};

// ─── I.1 — Kanban Board theo vai trò ──────────────────────────────────────────
// @route GET /api/v1/tasks/kanban
// @access Private
export const getKanbanBoard = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    if (!hospitalId) return errorResponse(res, "Bạn chưa được gán vào bệnh viện nào.", 403);

    const { role, userId, date } = req.query;

    const filter = { hospitalId };

    // Bác sĩ/KTV/Lễ tân chỉ xem task thuộc vai trò mình (hoặc gán trực tiếp)
    const userRole = role || req.user.role;
    if (!["admin", "hospital_admin"].includes(userRole)) {
      filter.$or = [
        { roleRequired: userRole },
        { assignedToUserId: req.user.id }
      ];
    } else if (userId) {
      filter.assignedToUserId = userId;
    }

    if (date) {
      const { startOfDay: searchDate, endOfDay } = getDayRangeVN(date);
      filter.createdAt = { $gte: searchDate, $lte: endOfDay };
    }

    const tasks = await Task.find(filter)
      .populate("visitId", "patientId status priority reason")
      .populate("patientId", "profile.name profile.fullName email")
      .populate("assignedToUserId", "profile.name profile.fullName")
      .sort({ deadlineAt: 1, stepNumber: 1 });

    // Group theo 3 cột Kanban: pending / in_progress / completed
    const kanban = {
      pending: tasks.filter(t => t.status === 'pending'),
      in_progress: tasks.filter(t => t.status === 'in_progress'),
      completed: tasks.filter(t => t.status === 'completed'),
    };

    return successResponse(res, kanban, "Lấy mảng Kanban board thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── I.2 — Cập nhật trạng thái task & kích hoạt task kế tiếp ───────────────
// @route PUT /api/v1/tasks/:id/status
// @access Private
export const updateTaskStatus = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    });
    if (!task) return errorResponse(res, "Không tìm thấy task.", 404);

    const { status, notes } = req.body;
    if (!['pending', 'in_progress', 'completed', 'cancelled', 'skipped'].includes(status)) {
      return errorResponse(res, "Trạng thái task không hợp lệ.", 400);
    }

    task.status = status;
    if (notes) task.notes = notes;

    if (status === 'in_progress' && !task.startedAt) {
      task.startedAt = new Date();
      task.assignedToUserId = req.user.id;
    }

    if (status === 'completed') {
      task.completedAt = new Date();
      task.completedByUserId = req.user.id;

      // Kích hoạt task kế tiếp (stepNumber + 1)
      const nextTask = await Task.findOne({
        visitId: task.visitId,
        stepNumber: task.stepNumber + 1,
        status: 'pending'
      });
      if (nextTask) {
        nextTask.status = 'in_progress';
        nextTask.startedAt = new Date();
        await nextTask.save();

        // Gửi notification cho vai trò tiếp theo
        try {
          await notifyNextRole(nextTask, req.user.hospitalId);
        } catch (notifErr) {
          console.warn("⚠️ Không thể gửi thông báo task kế tiếp:", notifErr.message);
        }
      }
    }

    await task.save();
    return successResponse(res, { task }, "Cập nhật trạng thái task thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── I.3 — Cron Job kiểm tra task quá hạn (Deadline Alert) ────────────────────
// @route POST /api/v1/tasks/check-deadlines
// @access Private (Admin)
export const checkTaskDeadlines = async (req, res) => {
  try {
    const now = new Date();
    // Tìm các task chưa completed nhưng đã qua deadline
    const overdueTasks = await Task.find({
      hospitalId: req.user.hospitalId,
      status: { $in: ['pending', 'in_progress'] },
      deadlineAt: { $lt: now },
      isOverdue: false,
    }).populate("visitId", "patientId status priority");

    const updated = [];
    for (const task of overdueTasks) {
      task.isOverdue = true;
      task.overdueAlertSentAt = now;
      await task.save();
      updated.push(task);

      // Gửi cảnh báo nhắc nhở (I.3)
      if (task.assignedToUserId) {
        await createNotificationInternal({
          hospitalId: task.hospitalId,
          recipientId: task.assignedToUserId,
          senderId: req.user.id,
          type: "deadline_warning",
          title: "⏰ CẢNH BÁO QUÁ HẠN TASK",
          message: `Task "${task.title}" (Bước ${task.stepNumber}) đã quá hạn xử lý. Vui lòng hoàn thành ngay.`,
          relatedId: task._id,
        });
      }
    }

    return successResponse(res, { overdueCount: updated.length, updated }, `Đã kiểm tra và gắn cờ ${updated.length} task quá hạn.`);
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── I.4 — Dashboard tổng quan ca trực (Shift Overview) ──────────────────────
// @route GET /api/v1/tasks/shift-overview
// @access Private (Doctor, Admin, Receptionist)
export const getShiftOverviewDashboard = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    if (!hospitalId) return errorResponse(res, "Bạn chưa được gán vào bệnh viện nào.", 403);

    const { startOfDay: todayStart, endOfDay: todayEnd } = getDayRangeVN();

    // Thống kê Visit trong ngày
    const totalVisitsToday = await Visit.countDocuments({
      hospitalId,
      createdAt: { $gte: todayStart, $lte: todayEnd }
    });

    const activeVisits = await Visit.countDocuments({
      hospitalId,
      status: { $nin: ['hoàn tất', 'đã đóng'] }
    });

    const emergencyVisits = await Visit.countDocuments({
      hospitalId,
      priority: 'khẩn cấp',
      status: { $nin: ['hoàn tất', 'đã đóng'] }
    });

    // Thống kê Task quá hạn
    const overdueTasksCount = await Task.countDocuments({
      hospitalId,
      status: { $in: ['pending', 'in_progress'] },
      deadlineAt: { $lt: new Date() }
    });

    // Thống kê phân bổ theo vai trò
    const pendingByRole = await Task.aggregate([
      { $match: { hospitalId: req.user.hospitalId, status: { $in: ['pending', 'in_progress'] } } },
      { $group: { _id: "$roleRequired", count: { $sum: 1 } } }
    ]);

    return successResponse(res, {
      totalVisitsToday,
      activeVisits,
      emergencyVisits,
      overdueTasksCount,
      pendingByRole: pendingByRole.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
      updatedAt: new Date(),
    }, "Lấy dashboard tổng quan ca trực thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── Internal — Gửi thông báo cho role tiếp theo ─────────────────────────────
async function notifyNextRole(task, hospitalId) {
  const { User } = await import("../models/user.model.js");
  const users = await User.find({
    hospitalId,
    role: task.roleRequired === 'auto' ? 'doctor' : task.roleRequired,
    isLocked: false
  }, "_id");

  const notifs = users.map(u =>
    createNotificationInternal({
      hospitalId,
      recipientId: u._id,
      senderId: u._id,
      type: "task_new",
      title: `📌 Task mới: ${task.title}`,
      message: `Đã đến bước ${task.stepNumber}: ${task.title}. Vui lòng xử lý.`,
      relatedId: task._id,
    }).catch(err => console.warn("Lỗi gửi notif task:", err.message))
  );

  await Promise.allSettled(notifs);
}
