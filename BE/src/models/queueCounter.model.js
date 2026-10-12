import { Schema, model } from "mongoose";

/**
 * UC-PAT-03 — Bộ đếm số thứ tự theo bệnh viện + ngày: cấp số nguyên tử ($inc) và giữ "số đang gọi".
 * Không gắn tenancyPlugin: chỉ service số thứ tự dùng, luôn lọc theo hospitalId tường minh.
 */
const queueCounterSchema = new Schema(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: "Hospital", required: true },
    dateKey: { type: String, required: true },
    lastNumber: { type: Number, default: 0 }, // số cuối đã cấp
    cursor: { type: Number, default: 0 },     // số lớn nhất đã gọi theo thứ tự (số đang gọi)
  },
  { timestamps: true }
);

queueCounterSchema.index({ hospitalId: 1, dateKey: 1 }, { unique: true });

export const QueueCounter = model("QueueCounter", queueCounterSchema, "queue_counters");
export default QueueCounter;
