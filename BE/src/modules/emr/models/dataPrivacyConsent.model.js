import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../../../plugins/tenancy.plugin.js";

/**
 * Model: DataPrivacyConsent
 * Tuân thủ Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 & Nghị định 13/2023/NĐ-CP
 * Quản lý sự đồng thuận xử lý Dữ liệu Sức khỏe Nhạy cảm và Quyền thu hồi sự đồng ý (Điều 9)
 */
const dataPrivacyConsentSchema = new Schema(
  {
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    medicalId: {
      type: String,
      trim: true,
      default: "",
    },
    // Các mục đích xử lý được tách bạch rõ ràng (Điều 11 Luật 91/2025/QH15)
    purposes: {
      medicalCareAndEmr: { type: Boolean, default: true, required: true }, // Khám chữa bệnh & lưu EMR
      aiAssistedAnalysis: { type: Boolean, default: true }, // Cho phép AI hỗ trợ phân tích tổn thương não
      scientificResearchAnonymized: { type: Boolean, default: false }, // Nghiên cứu khoa học ẩn danh
      cloudStorageBackup: { type: Boolean, default: true }, // Sao lưu hồ sơ đám mây an toàn
    },
    // Quyền rút lại sự đồng ý theo Điều 9 Luật 91/2025/QH15
    consentStatus: {
      type: String,
      enum: ["granted", "partially_revoked", "fully_revoked"],
      default: "granted",
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revocationReason: {
      type: String,
      default: "",
    },
    // Thông tin định danh & chữ ký của chủ thể dữ liệu
    signerName: {
      type: String,
      required: true,
      trim: true,
    },
    // [P1-9] Số CCCD người ký được mã hoá AES-256-GCM, chỉ giữ 4 số cuối để hiển thị
    signerNationalId: {
      type: String,
      trim: true,
      default: "", // Bản mã (v1:iv:tag:ciphertext), không phải plaintext
    },
    signerNationalIdLast4: {
      type: String,
      default: "",
    },
    signerRelationship: {
      type: String,
      enum: ["Bản thân", "Người giám hộ", "Đại diện hợp pháp"],
      default: "Bản thân",
    },
    signedAt: {
      type: Date,
      default: Date.now,
    },
    ipAddress: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

dataPrivacyConsentSchema.plugin(tenancyPlugin);

export const DataPrivacyConsent = model("DataPrivacyConsent", dataPrivacyConsentSchema);
export default DataPrivacyConsent;
