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
    // Bản chính trên máy chủ đã mã hóa AES-256-GCM (FILE_ENCRYPTION_KEY) hay chưa.
    // true: tệp trên đĩa là bản mã; encryptionIv/encryptionAuthTag là tham số của bản mã đó, bản sao Drive y hệt từng byte.
    // false (dữ liệu cũ): tệp trên đĩa là bản rõ; encryptionIv/encryptionAuthTag (nếu có) chỉ thuộc về bản sao trên Drive.
    localEncrypted: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Giữ để tương thích: trước đây luôn ghi true kể cả khi bản chính là bản rõ. Bản ghi mới = localEncrypted.
    isEncrypted: {
      type: Boolean,
      default: false,
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
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      default: null,
      index: true,
    },
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
