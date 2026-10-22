import { Schema, model } from "mongoose";

const notificationSchema = new Schema(
  {
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    type: {
      type: String,
      // Fix 0010: bổ sung 7 loại notification đang được nghiệp vụ sử dụng nhưng
      // thiếu trong enum — mọi lần gọi createNotificationInternal với type ngoài
      // enum đều fail validation và bị nuốt lỗi trong try/catch (BS không bao giờ
      // nhận được thông báo): assignment_new/assignment_override (phân công &
      // điều chuyển ca), result_ready (phim sẵn sàng), emergency_alert/
      // emergency_stand_down (cảnh báo khẩn cấp), peer_review_assigned,
      // appointment_reminder (scheduler nhắc lịch).
      enum: [
        "new_visit", "mri_order", "ai_ready", "low_stock", "stock_shortage",
        "announcement", "swap_request", "system_alert",
        "transfer_draft", "transfer_sent", "transfer_incoming", "transfer_accepted",
        "assignment_new", "assignment_override", "result_ready",
        "emergency_alert", "emergency_stand_down", "peer_review_assigned",
        "appointment_reminder", "other",
      ],
      default: "other",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    relatedId: {
      type: Schema.Types.ObjectId,
      default: null, // e.g. visitId, drugId
    },
  },
  {
    timestamps: true,
  }
);

// Optimize query for unread notifications sorted by date
notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

export const Notification = model("Notification", notificationSchema);
export default Notification;
