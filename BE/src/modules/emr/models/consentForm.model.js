import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../../../plugins/tenancy.plugin.js";

const consentFormSchema = new Schema(
  {
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: 'Hospital',
      required: true,
      index: true
    },
    medicalRecordId: {
      type: Schema.Types.ObjectId,
      ref: "MedicalRecord",
      required: true,
    },
    procedureName: {
      type: String,
      required: true,
    },
    risks: {
      type: String,
      required: true,
    },
    doctorExplanation: {
      type: String,
      required: true,
    },
    doctorSigned: {
      type: Boolean,
      default: false,
    },
    patientSigned: {
      type: Boolean,
      default: false,
    },
    doctorSignature: {
      type: String, // Tên bác sĩ ký xác thực
      default: "",
    },
    patientSignature: {
      type: String, // Tên bệnh nhân/đại diện ký xác thực
      default: "",
    },
    // Module S — Đồng thuận tiêm thuốc cản quang Gadolinium
    visitId: { type: Schema.Types.ObjectId, ref: "Visit", default: null, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    allergyChecklist: {
      contrastAllergy: { type: String, enum: ['yes', 'no', 'unknown'], default: 'no' }, // Tiền sử dị ứng cản quang
      gfrLevel: { type: Number, default: null },                                        // eGFR (mL/min/1.73m²)
      isPregnant: { type: Boolean, default: false },                                    // Mang thai
      isBreastfeeding: { type: Boolean, default: false },                               // Cho con bú
      kidneyDisease: { type: Boolean, default: false },                                 // Tiền sử bệnh thận mạn
      severeAsthma: { type: Boolean, default: false },                                  // Hen phế quản nặng
    },
    riskLevel: {
      type: String,
      enum: ['low', 'moderate', 'high'],
      default: 'low'
    },
    isBlockedByChecklist: { type: Boolean, default: false },
    isDoctorOverridden: { type: Boolean, default: false },
    doctorOverrideReason: { type: String, default: "" },
    doctorOverrideByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    signedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

consentFormSchema.plugin(tenancyPlugin);

export const ConsentForm = model("ConsentForm", consentFormSchema);
export default ConsentForm;
