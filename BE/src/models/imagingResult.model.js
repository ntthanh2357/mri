import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../plugins/tenancy.plugin.js";

const imagingResultSchema = new Schema(
  {
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: 'Hospital',
      required: true,
      index: true,
    },
    medicalId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    patientName: {
      type: String,
      required: true,
      trim: true,
    },
    birthYear: {
      type: Number,
      default: null,
    },
    gender: {
      type: String,
      enum: ["Nam", "Nữ", "Khác"],
      required: true,
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    orderDate: {
      type: Date,
      required: true,
    },
    orderingDoctor: {
      type: String,
      trim: true,
      default: "",
    },
    orderingDepartment: {
      type: String,
      trim: true,
      default: "",
    },
    medicalRecordNumber: {
      type: String,
      trim: true,
      default: "",
    },
    diagnosis: {
      type: String,
      trim: true,
      default: "",
    },
    procedure: {
      type: String,
      required: true,
      trim: true,
    },
    technique: {
      type: String,
      trim: true,
      default: "",
    },
    findings: {
      type: String,
      required: true,
      trim: true,
    },
    conclusion: {
      type: String,
      required: true,
      trim: true,
    },
    radiologist: {
      type: String,
      required: true,
      trim: true,
    },
    reportDate: {
      type: Date,
      required: true,
    },
    images: {
      type: [String],
      default: [],
    },
    dicomMetadata: {
      studyInstanceUID: { type: String, default: "" },
      seriesInstanceUID: { type: String, default: "" },
      sopInstanceUIDs: { type: [String], default: [] },
      dicomFileUrls: { type: [String], default: [] },
    },
    imagingType: {
      type: String,
      enum: ["MRI", "CT"],
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

imagingResultSchema.plugin(tenancyPlugin);

export const ImagingResult = model("ImagingResult", imagingResultSchema);
