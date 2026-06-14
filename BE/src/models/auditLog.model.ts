import { Schema, model, Document } from "mongoose";

export interface IAuditLog extends Document {
  action: string;
  entity: string;
  entityId: string;
  performedBy: string;
  details: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
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
    details: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const AuditLog = model<IAuditLog>("AuditLog", auditLogSchema);
