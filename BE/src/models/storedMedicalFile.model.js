import { Schema, model } from "mongoose";

const storedMedicalFileSchema = new Schema(
  {
    fileId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ["pacs", "sequence_slice", "report", "patient_upload", "ai_temp", "backup"],
      required: true,
      index: true,
    },
    studyId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    sequenceName: {
      type: String,
      trim: true,
      default: null,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    logicalPath: {
      type: String,
      required: true,
      trim: true,
    },

    // Bản chính trên Local Storage
    localPath: {
      type: String,
      required: true,
    },
    sha256: {
      type: String,
      required: true,
      index: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
      default: "application/octet-stream",
    },

    // Bản sao lưu trên Google Drive
    driveFileId: {
      type: String,
      default: null,
    },
    driveFolderId: {
      type: String,
      default: null,
    },
    syncStatus: {
      type: String,
      enum: ["PENDING", "SYNCED", "FAILED"],
      default: "PENDING",
      index: true,
    },
    syncRetries: {
      type: Number,
      default: 0,
    },
    syncError: {
      type: String,
      default: null,
    },
    lastSyncAttemptAt: {
      type: Date,
      default: null,
    },

    // Bảo mật mã hóa AES-256-GCM trên Drive
    isEncrypted: {
      type: Boolean,
      default: true,
    },
    encryptionIv: {
      type: String,
      default: null,
    },
    encryptionAuthTag: {
      type: String,
      default: null,
    },

    // Liên kết nghiệp vụ
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const StoredMedicalFile = model("StoredMedicalFile", storedMedicalFileSchema);
export default StoredMedicalFile;
