import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../plugins/tenancy.plugin.js";

const patientProfileSchema = new Schema(
  {
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: 'Hospital',
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    dateOfBirth: { type: Date, default: null },
    gender: {
      type: String,
      enum: ["nam", "nu", "khac", ""],
      default: "",
    },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },

    // Google Drive Personal uploads folder configurations
    driveFolderId: { type: String, default: "" },
    driveFolderUrl: { type: String, default: "" }
  },
  { timestamps: true }
);

patientProfileSchema.plugin(tenancyPlugin);

export const PatientProfile = model("PatientProfile", patientProfileSchema);
