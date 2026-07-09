import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../plugins/tenancy.plugin.js";

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
  },
  {
    timestamps: true,
  }
);

consentFormSchema.plugin(tenancyPlugin);

export const ConsentForm = model("ConsentForm", consentFormSchema);
export default ConsentForm;
