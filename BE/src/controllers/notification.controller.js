import { isValidObjectId } from "mongoose";
import { Notification } from "../models/notification.model.js";
import { successResponse, errorResponse } from "../utils/response.util.js";

// Helper function to create notification internally from other controllers
export const createNotificationInternal = async ({
  hospitalId,
  recipientId,
  senderId = null,
  type = "other",
  title,
  message,
  relatedId = null,
}) => {
  try {
    if (!hospitalId || !recipientId || !title || !message) {
      console.warn("createNotificationInternal: Thiếu thông tin bắt buộc.");
      return null;
    }

    const notification = new Notification({
      hospitalId,
      recipientId,
      senderId,
      type,
      title,
      message,
      relatedId,
    });

    await notification.save();
    return notification;
  } catch (error) {
    console.error("Lỗi khi tạo thông báo nội bộ:", error);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// NT-01: Lấy danh sách thông báo của người dùng
// GET /api/v1/notifications
// @access Private (All users)
// ─────────────────────────────────────────────────────────────────────────────
export const getNotifications = async (req, res) => {
  try {
    const recipientId = req.user.id;
    const { unreadOnly } = req.query;

    const filter = { recipientId };
    if (unreadOnly === "true") {
      filter.isRead = false;
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(50) // limit to recent 50
      .lean();

    const unreadCount = await Notification.countDocuments({ recipientId, isRead: false });

    return successResponse(res, { notifications, unreadCount }, "Lấy danh sách thông báo thành công.");
  } catch (error) {
    console.error("Lỗi getNotifications:", error);
    return errorResponse(res, "Lỗi máy chủ.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// NT-02: Đánh dấu một thông báo là đã đọc
// PUT /api/v1/notifications/:id/read
// @access Private (All users)
// ─────────────────────────────────────────────────────────────────────────────
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return errorResponse(res, "ID thông báo không hợp lệ.", 400);
    }

    const notification = await Notification.findById(id);
    if (!notification) {
      return errorResponse(res, "Không tìm thấy thông báo.", 404);
    }

    // Ownership check
    if (notification.recipientId.toString() !== req.user.id.toString()) {
      return errorResponse(res, "Không có quyền chỉnh sửa thông báo này.", 403);
    }

    notification.isRead = true;
    await notification.save();

    return successResponse(res, { notification }, "Đã đánh dấu thông báo là đã đọc.");
  } catch (error) {
    console.error("Lỗi markAsRead:", error);
    return errorResponse(res, "Lỗi máy chủ.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// NT-03: Đánh dấu tất cả thông báo là đã đọc
// PUT /api/v1/notifications/read-all
// @access Private (All users)
// ─────────────────────────────────────────────────────────────────────────────
export const markAllAsRead = async (req, res) => {
  try {
    const recipientId = req.user.id;

    await Notification.updateMany({ recipientId, isRead: false }, { isRead: true });

    return successResponse(res, null, "Đã đánh dấu toàn bộ thông báo là đã đọc.");
  } catch (error) {
    console.error("Lỗi markAllAsRead:", error);
    return errorResponse(res, "Lỗi máy chủ.", 500);
  }
};
