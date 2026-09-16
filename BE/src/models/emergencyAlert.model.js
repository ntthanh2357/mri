import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../plugins/tenancy.plugin.js";

/**
 * EmergencyAlert — Cảnh báo cấp cứu (Module E.1, E.2, E.3)
 * Được tạo khi AI phát hiện ngưỡng nguy hiểm hoặc bác sĩ kích hoạt thủ công.
 */
const emergencyAlertSchema = new Schema(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    visitId: { type: Schema.Types.ObjectId, ref: 'Visit', required: true, index: true },
    imagingResultId: { type: Schema.Types.ObjectId, ref: 'ImagingResult', default: null },
    // Mức độ cảnh báo
    level: {
      type: String,
      enum: ['RED', 'ORANGE'],      // RED: nguy hiểm tức thì, ORANGE: cần theo dõi
      required: true,
      default: 'RED',
      index: true
    },
    // Nguồn kích hoạt
    triggeredBy: {
      type: String,
      enum: ['ai', 'manual'],       // E.1: AI tự động, E.2: bác sĩ thủ công
      required: true
    },
    triggeredByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // nếu manual
    triggeredAt: { type: Date, default: Date.now, index: true },
    // Chỉ số y tế gây kích hoạt (E.1)
    midlineShiftMm: { type: Number, default: null },    // Lệch đường giữa (mm)
    tumorVolumeCm3: { type: Number, default: null },    // Thể tích u (cm³)
    triggerReason: { type: String, default: "" },       // Mô tả lý do
    // E.3 — Ai đã acknowledge cảnh báo
    acknowledgedBy: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        acknowledgedAt: { type: Date, default: Date.now }
      }
    ],
    // Trạng thái cảnh báo
    status: {
      type: String,
      enum: ['active', 'acknowledged', 'resolved', 'escalated'],
      default: 'active',
      index: true
    },
    // E.4 — Dashboard countdown
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    resolutionNote: { type: String, default: "" },
    // Cảnh báo cam nếu quá 30 phút chưa ai acknowledge
    escalatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

emergencyAlertSchema.index({ hospitalId: 1, status: 1, triggeredAt: -1 });
emergencyAlertSchema.plugin(tenancyPlugin);

export const EmergencyAlert = model("EmergencyAlert", emergencyAlertSchema);
export default EmergencyAlert;
