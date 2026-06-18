import { Schema, model } from "mongoose";

const labOrderSchema = new Schema({
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
  status: { 
    type: String, 
    enum: ["PENDING", "COMPLETED"], 
    default: "PENDING" 
  },
  ordered_at: { 
    type: Date, 
    default: Date.now 
  },
  resulted_at: { 
    type: Date 
  },
  results: [{
    biomarker_code: { type: String, required: true },
    biomarker_name: { type: String, required: true },
    value_result: { type: Number, required: true },
    unit: { type: String, required: true },
    is_abnormal: { type: Boolean, default: false }, // Đánh dấu nếu vượt ngưỡng tham chiếu
    abnormal_direction: { type: String, enum: ['HIGH', 'LOW', ''], default: '' }, // Hướng lệch: cao hay thấp
    reference_range_display: { type: String, default: '' } // Chuỗi khoảng tham chiếu đã format sẵn: e.g. "3.9 - 6.4" hoặc "<= 37"
  }]
}, {
  timestamps: true
});

export const LabOrder = model("LabOrder", labOrderSchema, "lab_orders");
