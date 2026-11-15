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
    ipAddress: {
      type: String,
      default: "",
      trim: true,
    },
    location: {
      type: String,
      default: "",
      trim: true,
    },
    // Chuỗi băm mật mã chống giả mạo (Cryptographic Tamper-Evidence - HIPAA §164.312(b), TT 13/2025/TT-BYT & Luật 86/2015/QH13)
    sequenceNumber: {
      type: Number,
      unique: true,
      sparse: true,
      index: true,
    },
    // 2 = băm cả hospitalId, ipAddress, location và bản băm người thực hiện (cho phép ẩn danh mà không làm đứt chuỗi)
    hashVersion: {
      type: Number,
    },
    performerDigest: {
      type: String,
    },
    redactedAt: {
      type: Date,
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
    hashedTimestamp: {
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
