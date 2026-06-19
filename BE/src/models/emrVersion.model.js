import { Schema, model } from "mongoose";

const emrVersionSchema = new Schema(
  {
    medicalRecordId: {
      type: Schema.Types.ObjectId,
      ref: "MedicalRecord",
      required: true,
    },
    version: {
      type: Number,
      required: true,
    },
    modifiedBy: {
      type: String,
      required: true,
    },
    modifiedAt: {
      type: Date,
      default: Date.now,
    },
    changes: {
      type: Schema.Types.Mixed, // Object chứa các thay đổi { field: { old, new } }
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const EMRVersion = model("EMRVersion", emrVersionSchema);
export default EMRVersion;
