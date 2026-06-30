import { Schema, model } from "mongoose";

const auditLogSchema = new Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
    },
    entity: {
      type: String,
      required: true,
      trim: true,
    },
    entityId: {
      type: String,
      default: "",
    },
    performedBy: {
      type: String,
      required: true,
      trim: true,
    },
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      default: null,
    },
    details: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const AuditLog = model("AuditLog", auditLogSchema);
