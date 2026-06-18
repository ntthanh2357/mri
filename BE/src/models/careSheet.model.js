import { Schema, model } from "mongoose";

const careSheetSchema = new Schema(
  {
    medicalRecordId: {
      type: Schema.Types.ObjectId,
      ref: "MedicalRecord",
      required: true,
    },
    careLevel: {
      type: Number,
      enum: [1, 2, 3],
      default: 3,
    },
    pulse: {
      type: Number, // Mạch (lần/phút)
      required: true,
    },
    bloodPressure: {
      type: String, // Huyết áp (mmHg), e.g. "120/80"
      required: true,
      trim: true,
    },
    temperature: {
      type: Number, // Nhiệt độ (°C)
      required: true,
    },
    respiratoryRate: {
      type: Number, // Nhịp thở (lần/phút)
      required: true,
    },
    spo2: {
      type: Number, // SpO2 (%)
      required: true,
    },
    progressNotes: {
      type: String,
      required: true,
      default: "",
    },
    careActions: {
      type: String,
      required: true,
      default: "",
    },
    nurse: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const CareSheet = model("CareSheet", careSheetSchema);
export default CareSheet;
