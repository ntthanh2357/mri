import { Schema, model } from "mongoose";

const documentSchema = new Schema(
  {
    docKey: { type: String, required: true },
    groupKey: {
      type: String,
      enum: ["nhom1", "nhom2", "nhom3", "nhom5"],
      required: true,
    },
    label: { type: String, required: true },
    storageType: {
      type: String,
      enum: ["upload", "manual"],
      required: true,
    },
    fileUrl: { type: String, default: null },
    fileName: { type: String, default: null },
    fileType: { type: String, default: null },
    manualData: { type: Schema.Types.Mixed, default: null },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const visitSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: { type: Date, required: true },
    facility: { type: String, required: true, trim: true },
    visitType: {
      type: String,
      enum: ["ngoai_tru", "noi_tru"],
      required: true,
    },
    diagnosis: { type: String, trim: true, default: "" },
    medicalId: { type: String, trim: true, default: "" },
    doctor: { type: String, trim: true, default: "" },
    documents: [documentSchema],
  },
  { timestamps: true }
);

export const Visit = model("Visit", visitSchema);
