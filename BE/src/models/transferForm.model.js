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
  // Module F — chuyển viện thông minh giữa các bệnh viện trong hệ thống
  targetHospitalId: { type: Schema.Types.ObjectId, ref: "Hospital", default: null, index: true },
  visitId: { type: Schema.Types.ObjectId, ref: "Visit", default: null },
  imagingResultId: { type: Schema.Types.ObjectId, ref: "ImagingResult", default: null },
  transferPackageDriveUrl: { type: String, default: "" }, // F.2: gói zip nén MRI + metadata
  targetBedId: { type: Schema.Types.ObjectId, ref: "HospitalBed", default: null }, // F.3: giường được giữ chỗ viện đích
  status: {
    type: String,
    enum: ["draft", "pending", "accepted", "rejected", "completed", "cancelled"],
    default: "pending",
    index: true
  },
  acceptedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  acceptedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: "" },
  // Vòng đời mã token xem bệnh án liên viện (F.5 & HIPAA / TT46)
  crossHospitalToken: { type: String, default: null, index: true, sparse: true },
  crossHospitalTokenExpiresAt: { type: Date, default: null },
  crossHospitalTokenRevokedAt: { type: Date, default: null },
  crossHospitalTokenRevokedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
}, {
  timestamps: true
});

transferFormSchema.plugin(tenancyPlugin);

export const TransferForm = model("TransferForm", transferFormSchema, "transfer_forms");
export default TransferForm;
