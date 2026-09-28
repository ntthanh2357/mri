import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../../../plugins/tenancy.plugin.js";

/**
 * HospitalBed — Quản lý giường bệnh (Module Q.1, Q.2, Q.3)
 */
const hospitalBedSchema = new Schema(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    departmentId: { type: String, required: true, index: true }, // VD: "KNT" (Khoa Ngoại thần kinh)
    departmentName: { type: String, default: "" },               // Tên khoa hiển thị
    bedNumber: { type: String, required: true },                  // Số giường: "A01", "B12"
    roomNumber: { type: String, default: "" },                    // Phòng: "101", "VIP-3"
    floor: { type: String, default: "" },                         // Tầng: "1", "B1"
    type: {
      type: String,
      enum: [
        'standard',          // Giường nội trú thường
        'vip',               // Giường VIP
        'icu',               // ICU chuẩn chung (backward-compatible)
        'icu_standard',      // ICU tổng quát
        'icu_neuro_icp',     // ICU chuyên biệt U Não có Monitor áp lực nội sọ ICP (Intracranial Pressure)
        'icu_neuro_eeg',     // ICU U Não có Continuous EEG Monitoring theo dõi co giật
        'isolation',         // Giường cách ly (suy giảm miễn dịch nặng do Temozolomide/nhiễm trùng)
        'post_op_recovery'   // Giường hồi tỉnh sau phẫu thuật mở sọ Craniotomy
      ],
      default: 'standard'
    },
    // Trạng thái real-time (Q.4)
    status: {
      type: String,
      enum: ['available', 'occupied', 'reserved', 'maintenance', 'cleaning'],
      default: 'available',
      index: true
    },
    // Q.2 — Giữ chỗ tạm thời
    reservedUntil: { type: Date, default: null },          // Tự động giải phóng sau holdHours (4h cấp cứu hoặc 48h mổ phiên)
    reserveReason: {
      type: String,
      enum: ['emergency', 'scheduled_craniotomy', 'inter_hospital_transfer', 'post_op_icu', 'standard_admission', 'other'],
      default: 'emergency'
    },
    reservedForVisitId: { type: Schema.Types.ObjectId, ref: 'Visit', default: null },
    reservedForPatientId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reservedByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reservedAt: { type: Date, default: null },
    // Q.2 — Bệnh nhân đang sử dụng
    currentPatientId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    currentVisitId: { type: Schema.Types.ObjectId, ref: 'Visit', default: null },
    admittedAt: { type: Date, default: null },
    occupiedAt: { type: Date, default: null },
    // Q.3 — Ghi lịch sử sử dụng
    lastOccupiedAt: { type: Date, default: null },
    notes: { type: String, default: "" },
    // Tiêu chuẩn Y tế Neuro-Oncology & Hồi sức tích cực Ngoại thần kinh
    hasIcpMonitor: { type: Boolean, default: false },     // Có thiết bị đo áp lực nội sọ liên tục
    hasEegMonitor: { type: Boolean, default: false },     // Có máy điện não liên tục phát hiện co giật cận lâm sàng
    isIsolationRoom: { type: Boolean, default: false },   // Buồng áp lực âm/dương bảo vệ bệnh nhân suy giảm miễn dịch
  },
  { timestamps: true }
);

// Index compound cho tìm kiếm giường trống theo khoa
hospitalBedSchema.index({ hospitalId: 1, departmentId: 1, status: 1 });
hospitalBedSchema.index({ hospitalId: 1, bedNumber: 1 });
hospitalBedSchema.plugin(tenancyPlugin);

export const HospitalBed = model("HospitalBed", hospitalBedSchema);
export default HospitalBed;
