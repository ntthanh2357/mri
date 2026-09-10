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
      enum: ['standard', 'vip', 'icu'],
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
    reservedUntil: { type: Date, default: null },          // Tự động giải phóng sau 4h nếu không đến
    reservedForVisitId: { type: Schema.Types.ObjectId, ref: 'Visit', default: null },
    reservedForPatientId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reservedByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reservedAt: { type: Date, default: null },
    // Q.2 — Bệnh nhân đang sử dụng
    currentPatientId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    admittedAt: { type: Date, default: null },
    // Q.3 — Ghi lịch sử sử dụng
    lastOccupiedAt: { type: Date, default: null },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

// Index compound cho tìm kiếm giường trống theo khoa
hospitalBedSchema.index({ hospitalId: 1, departmentId: 1, status: 1 });
hospitalBedSchema.index({ hospitalId: 1, bedNumber: 1 });
hospitalBedSchema.plugin(tenancyPlugin);

export const HospitalBed = model("HospitalBed", hospitalBedSchema);
export default HospitalBed;
