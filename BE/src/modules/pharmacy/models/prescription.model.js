import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../../../plugins/tenancy.plugin.js";

const prescriptionSchema = new Schema({
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
  diagnosis: {
    type: String,
    required: true,
    default: ""
  },
  drugs: [{
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true, default: "viên" },
    usage: { type: String, default: "" },
    timesPerDay: { type: Number, default: 2 },
    durationDays: { type: Number, default: 7 }
  }],
  note: {
    type: String,
    default: ""
  },
  isBilled: {
    type: Boolean,
    default: false
  },
  invoiceId: {
    type: Schema.Types.ObjectId,
    ref: "Invoice"
  },
  clinicalSafety: {
    safetyScore: { type: Number, default: 100 },
    status: { type: String, enum: ["SAFE", "CAUTION", "HIGH_RISK", "CRITICAL", "PARTIALLY_EVALUATED", "UNEVALUATED"], default: "SAFE" },
    evaluationCoverage: { type: Schema.Types.Mixed, default: null },
    warnings: [{
      type: { type: String },
      severity: { type: String },
      drugs: [{ type: String }],
      message: { type: String },
      recommendation: { type: String },
      source: { type: String }
    }],
    aiConsultation: { type: Schema.Types.Mixed, default: null },
    isOverridden: { type: Boolean, default: false },
    overrideCategory: { type: String, default: "" },
    overrideReason: { type: String, default: "" },
    overriddenBy: { type: String, default: "" },
    overriddenAt: { type: Date, default: null },
    requiresDualSign: { type: Boolean, default: false },
    dualSignStatus: { type: String, enum: ["NONE", "PENDING_PHARMACY_VERIFICATION", "VERIFIED", "REJECTED"], default: "NONE" },
    coSignedBy: { type: String, default: "" },
    coSignedAt: { type: Date, default: null }
  },
  doctorId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null,
    index: true
  },
  dispenseStatus: {
    type: String,
    enum: [
      "PENDING_DISPENSE",
      "AWAITING_PHARMACY_VERIFICATION",
      "READY",
      "DISPENSED",
      "REJECTED_BY_PHARMACY",
      "CANCELLED",
      "PARTIALLY_DISPENSED"
    ],
    default: "PENDING_DISPENSE",
    index: true
  },
  dispensedAt: { type: Date, default: null },
  dispensedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  verifiedAt: { type: Date, default: null },
  verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  verificationNote: { type: String, default: "" },
  rejectionReason: { type: String, default: "" },
  postHocReviewRequired: { type: Boolean, default: false },
  postHocReviewedAt: { type: Date, default: null },
  postHocReviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  postHocReviewNote: { type: String, default: "" },
  postHocDeadline: { type: Date, default: null },
  dispenseHistory: [{
    fromStatus: { type: String },
    toStatus: { type: String },
    performedBy: { type: Schema.Types.ObjectId, ref: "User" },
    performerName: { type: String, default: "" },
    reason: { type: String, default: "" },
    timestamp: { type: Date, default: Date.now }
  }],
  recorded_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

prescriptionSchema.plugin(tenancyPlugin);

export const Prescription = model("Prescription", prescriptionSchema, "prescriptions");
export default Prescription;
