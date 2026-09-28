import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../plugins/tenancy.plugin.js";

/**
 * Assignment — Phân công bác sĩ đọc phim / điều trị (Module D.1, D.2)
 * Khi AI xử lý xong, hệ thống tự động tạo Assignment cho bác sĩ phù hợp.
 */
const assignmentSchema = new Schema(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    visitId: { type: Schema.Types.ObjectId, ref: 'Visit', required: true, index: true },
    imagingResultId: { type: Schema.Types.ObjectId, ref: 'ImagingResult', default: null },
    // Bác sĩ được phân công
    doctorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Loại phân công (D.1 đọc phim / D.2 điều trị)
    type: {
      type: String,
      enum: ['read', 'treat'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'acknowledged', 'in_progress', 'completed', 'overridden'],
      default: 'pending',
      index: true
    },
    // Timeline
    assignedAt: { type: Date, default: Date.now },
    acknowledgedAt: { type: Date, default: null },  // Bác sĩ xác nhận nhận task
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    // D.4 — Caseload tại thời điểm phân công
    caseloadAtAssignment: { type: Number, default: 0 },
    // D.3 — Override thủ công
    isOverridden: { type: Boolean, default: false },
    overriddenBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    overrideReason: { type: String, default: "" },
    previousDoctorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    overriddenAt: { type: Date, default: null },
    // I.3 — Deadline cảnh báo
    deadlineAt: { type: Date, default: null },
    isOverdue: { type: Boolean, default: false },
    overdueNotifiedAt: { type: Date, default: null },
    // Ưu tiên
    priority: { type: Number, default: 5, min: 1, max: 5 },
  },
  { timestamps: true }
);

assignmentSchema.index({ hospitalId: 1, doctorId: 1, status: 1 });
assignmentSchema.index({ visitId: 1, type: 1 });
assignmentSchema.plugin(tenancyPlugin);

export const Assignment = model("Assignment", assignmentSchema);
export default Assignment;
