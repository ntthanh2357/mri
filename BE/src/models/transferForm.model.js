import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../plugins/tenancy.plugin.js";

const transferFormSchema = new Schema({
  hospitalId: {
    type: Schema.Types.ObjectId,
    ref: "Hospital",
    required: true,
    index: true
  },
  patient_id: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  doctor_name: {
    type: String,
    required: true,
    default: "Bác sĩ điều trị"
  },
  transferNo: {
    type: String,
    default: ""
  },
  hospitalNo: {
    type: String,
    default: ""
  },
  transferTo: {
    type: String,
    default: ""
  },
  dateIn: {
    type: Date,
    default: Date.now
  },
  dateOut: {
    type: Date,
    default: Date.now
  },
  clinicalSummary: {
    type: String,
    default: ""
  },
  labSummary: {
    type: String,
    default: ""
  },
  diagnosis: {
    type: String,
    default: ""
  },
  treatment: {
    type: String,
    default: ""
  },
  drugsUsed: {
    type: String,
    default: ""
  },
  patientStatus: {
    type: String,
    default: ""
  },
  reason: {
    type: String,
    enum: ["1", "2"],
    default: "1"
  },
  reasonDetail: {
    type: String,
    default: "" // e.g. "Phù hợp quy định", "Không phù hợp khả năng", "Theo yêu cầu"
  },
  treatmentDirection: {
    type: String,
    default: ""
  },
  transferTime: {
    type: Date,
    default: Date.now
  },
  isOneYearValid: {
    type: String,
    enum: ["Có", "Không"],
    default: "Không"
  },
  transportation: {
    type: String,
    default: ""
  },
  escort: {
    type: String,
    default: ""
  },
  recorded_at: {
    type: Date,
    default: Date.now
  },
  // Module F — Gói chuyển viện thông minh: bác sĩ lập (draft) → lễ tân gửi email cho bệnh nhân (sent)
  targetHospitalId: { type: Schema.Types.ObjectId, ref: "Hospital", default: null, index: true }, // legacy (tenancy.util)
  visitId: { type: Schema.Types.ObjectId, ref: "Visit", default: null },
  imagingResultId: { type: Schema.Types.ObjectId, ref: "ImagingResult", default: null },
  // Snapshot nội dung gói tại thời điểm lập: DICOM zip, báo cáo AI, 3D model, ảnh slice, kết luận
  packageSnapshot: { type: Schema.Types.Mixed, default: null },
  status: {
    type: String,
    // pending/accepted/rejected/completed: giữ lại để tương thích dữ liệu cũ
    enum: ["draft", "sent", "failed", "pending", "accepted", "rejected", "completed", "cancelled"],
    default: "pending",
    index: true
  },
  // Thông tin gửi email cho bệnh nhân (lễ tân thực hiện)
  recipientEmail: { type: String, default: "" },
  sentAt: { type: Date, default: null },
  sentBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  sendAttempts: { type: Number, default: 0 },
  sendError: { type: String, default: "" },
}, {
  timestamps: true
});

transferFormSchema.plugin(tenancyPlugin);

export const TransferForm = model("TransferForm", transferFormSchema, "transfer_forms");
export default TransferForm;
