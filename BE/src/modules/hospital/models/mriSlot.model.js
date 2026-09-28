import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../../../plugins/tenancy.plugin.js";

/**
 * MriSlot — Lịch hẹn chụp MRI (Module A.2, A.3)
 * Mỗi slot là một ca chụp cụ thể trong phòng MRI.
 */
const mriSlotSchema = new Schema(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    roomId: { type: Schema.Types.ObjectId, ref: 'MriRoom', required: true, index: true },
    visitId: { type: Schema.Types.ObjectId, ref: 'Visit', default: null, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    technicianId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date, required: true },
    status: {
      type: String,
      enum: ['available', 'booked', 'in_progress', 'completed', 'cancelled', 'rescheduled'],
      default: 'available',
      index: true
    },
    // 1 = cấp cứu (khẩn cấp nhất), 5 = bình thường — dùng cho Module A.4 Emergency Override
    priority: { type: Number, default: 5, min: 1, max: 5, index: true },
    notes: { type: String, default: "" },
    // Ghi lại lịch sử dời nếu bị Emergency Override (A.4)
    rescheduledFrom: { type: Date, default: null },
    rescheduledReason: { type: String, default: "" },
    // Thông báo nhắc lịch đã gửi chưa (A.6)
    reminderSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Index compound để tìm slot trống hiệu quả
mriSlotSchema.index({ roomId: 1, startTime: 1 });
mriSlotSchema.index({ hospitalId: 1, startTime: 1, status: 1 });

mriSlotSchema.plugin(tenancyPlugin);

export const MriSlot = model("MriSlot", mriSlotSchema);
export default MriSlot;
