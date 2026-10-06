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
      enum: ["new_visit", "mri_order", "ai_ready", "low_stock", "stock_shortage", "announcement", "swap_request", "system_alert", "transfer_draft", "transfer_sent", "transfer_incoming", "transfer_accepted", "other"],
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
