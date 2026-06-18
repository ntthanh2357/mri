import { Schema, model } from "mongoose";

const consultationSchema = new Schema(
  {
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

export const Consultation = model("Consultation", consultationSchema);
export default Consultation;
