import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../plugins/tenancy.plugin.js";

const consultationSchema = new Schema(
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
    meetingDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    participants: {
      type: [String], // Danh sách bác sĩ tham gia
      required: true,
      default: [],
    },
    clinicalSummary: {
      type: String,
      required: true,
      default: "",
    },
    diagnosis: {
      type: String,
      required: true,
      default: "",
    },
    treatmentConclusion: {
      type: String,
      required: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

consultationSchema.plugin(tenancyPlugin);

export const Consultation = model("Consultation", consultationSchema);
export default Consultation;
