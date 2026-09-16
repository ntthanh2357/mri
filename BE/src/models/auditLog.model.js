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
    // Chuỗi băm mật mã chống giả mạo (Cryptographic Tamper-Evidence - HIPAA §164.312(b) & TT 46/2018/TT-BYT)
    sequenceNumber: {
      type: Number,
      unique: true,
      sparse: true,
      index: true,
    },
    previousHash: {
      type: String,
      default: "0000000000000000000000000000000000000000000000000000000000000000",
    },
    currentHash: {
      type: String,
      default: "",
      index: true,
    },
    payloadHash: {
      type: String,
      default: "",
    },
    tamperVerified: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const AuditLog = model("AuditLog", auditLogSchema);
