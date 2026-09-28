import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../plugins/tenancy.plugin.js";

/**
 * Task — Nhiệm vụ theo quy trình khám chữa bệnh (Module I.1, I.2, I.3)
 * Chuỗi 8 bước tự động được tạo khi visit khởi tạo:
 * 1. Tiếp nhận bệnh nhân (receptionist)
 * 2. Khám lâm sàng ban đầu (doctor)
 * 3. Chỉ định MRI (doctor)
 * 4. Chụp MRI (technician)
 * 5. Xử lý AI (auto)
 * 6. Đọc & phân tích kết quả (doctor - neuroradiologist)
 * 7. Ký duyệt báo cáo (doctor)
 * 8. Thanh toán (receptionist)
 */
const taskSchema = new Schema(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    visitId: { type: Schema.Types.ObjectId, ref: 'Visit', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    // Thứ tự bước quy trình
    stepNumber: { type: Number, required: true, min: 1, max: 8 },
    title: { type: String, required: true, trim: true },
    // Vai trò được gán
    roleRequired: {
      type: String,
      enum: ['receptionist', 'doctor', 'technician', 'auto', 'nurse', 'admin'],
      required: true,
      index: true
    },
    // Người phụ trách cụ thể (nếu đã phân công)
    assignedToUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    // Trạng thái task (I.1 Kanban columns: pending -> in_progress -> completed)
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled', 'skipped'],
      default: 'pending',
      index: true
    },
    // I.3 — Cảnh báo quá hạn
    deadlineAt: { type: Date, default: null, index: true },
    isOverdue: { type: Boolean, default: false },
    overdueAlertSentAt: { type: Date, default: null },
    // Timeline
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    completedByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

taskSchema.index({ hospitalId: 1, roleRequired: 1, status: 1 });
taskSchema.index({ visitId: 1, stepNumber: 1 });
taskSchema.plugin(tenancyPlugin);

export const Task = model("Task", taskSchema);
export default Task;
