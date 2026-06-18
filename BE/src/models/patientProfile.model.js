import { Schema, model } from "mongoose";

const patientProfileSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    cccd: { type: String, trim: true, default: "" },
    dateOfBirth: { type: Date, default: null },
    gender: {
      type: String,
      enum: ["nam", "nu", "khac", ""],
      default: "",
    },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

export const PatientProfile = model("PatientProfile", patientProfileSchema);
