import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../../../plugins/tenancy.plugin.js";

const labOrderSchema = new Schema({
  hospitalId: {
    type: Schema.Types.ObjectId,
    ref: "Hospital",
    required: true,
    index: true
  },
  patient_id: { 
    type: Schema.Types.ObjectId, 
    ref: "User",
    required: true
  },
  patient_gender: { 
    type: String, 
    enum: ["Nam", "Nữ"],
    required: true
  },
  barcode: { 
    type: String, 
    required: true,
    unique: true,
    trim: true
  }, // Mã vạch kết nối với máy LIS giả lập
  category: { 
    type: String, 
    enum: ["HOA_SINH", "HUYET_HOC"],
    required: true
  },
  // [P2-7] Vòng đời: PENDING → RESULTED (LIS trả) → VERIFIED (bác sĩ duyệt).
  // COMPLETED giữ lại để tương thích dữ liệu cũ; kết quả chỉ được coi là hoàn tất sau VERIFIED.
  status: { 
    type: String, 
    enum: ["PENDING", "COLLECTED", "RESULTED", "VERIFIED", "COMPLETED", "REJECTED"],
    default: "PENDING",
    index: true
  },
  specimenStatus: {
    type: String,
    enum: ["PENDING", "COLLECTED", "RECEIVED", "RESULTED", "VERIFIED"],
    default: "PENDING",
    index: true
  },
  ordered_at: { 
    type: Date, 
    default: Date.now 
  },
  collected_at: { type: Date, default: null },
  received_at: { type: Date, default: null },
  resulted_at: { 
    type: Date 
  },
  verified_at: { type: Date, default: null },
  verified_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
  // Cảnh báo giá trị nguy kịch (critical value) — phải báo ngay cho bác sĩ điều trị
  hasCriticalValue: { type: Boolean, default: false, index: true },
  criticalValues: [{ type: String }],
  criticalNotifiedAt: { type: Date, default: null },
  results: [{
    biomarker_code: { type: String, required: true },
    biomarker_name: { type: String, required: true },
    value_result: { type: Number, required: true },
    unit: { type: String, required: true, default: "N/A" },
    is_abnormal: { type: Boolean, default: false }, // Đánh dấu nếu vượt ngưỡng tham chiếu
    abnormal_direction: { type: String, enum: ['HIGH', 'LOW', ''], default: '' }, // Hướng lệch: cao hay thấp
    reference_range_display: { type: String, default: '' }, // Chuỗi khoảng tham chiếu đã format sẵn: e.g. "3.9 - 6.4" hoặc "<= 37"
    is_critical: { type: Boolean, default: false },
    critical_note: { type: String, default: '' }
  }]
}, {
  timestamps: true
});

labOrderSchema.plugin(tenancyPlugin);

export const LabOrder = model("LabOrder", labOrderSchema, "lab_orders");
export default LabOrder;
