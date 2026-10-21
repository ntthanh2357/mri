import { Schema, model } from "mongoose";

/**
 * UC-PAT-09 (mở rộng) — Giấy tờ bệnh nhân tự chụp (đơn thuốc, kết quả khám nơi khác...) kèm chữ AI đọc được.
 * Ảnh nằm trong kho riêng (storageService, category "patient_upload"), KHÔNG nằm trong /uploads công khai;
 * chỉ xem được qua link ngắn hạn có chữ ký. Giấy tờ chưa được bệnh nhân kiểm tra (confirmedAt = null) không đem chia sẻ.
 * Không gắn tenancyPlugin (giống RecordShare): giấy tờ thuộc về bệnh nhân, trang xem công khai không có phiên đăng nhập;
 * service luôn lọc tường minh theo patientId.
 */
// Thông tin AI tách từ giấy tờ, bệnh nhân kiểm tra và sửa được (làm sạch ở scannedDocument.service: cleanFields)
const medicationSchema = new Schema({ name: String, quantity: String, usage: String }, { _id: false });
const fieldsSchema = new Schema(
  {
    docType: { type: String, enum: ["prescription", "lab_result", "imaging_result", "discharge", "referral", "other"], default: "other" },
    date: { type: String, default: "" }, // ngày ghi trên giấy, giữ nguyên cách viết
    facility: { type: String, default: "" },
    doctor: { type: String, default: "" },
    diagnosis: { type: String, default: "" },
    medications: { type: [medicationSchema], default: [] },
  },
  { _id: false }
);

// Kết quả so 2 lần đọc độc lập của AI (làm sạch ở scannedDocument.service: cleanReview). Chỉ trả cho chủ giấy tờ lúc kiểm tra.
const checkSchema = new Schema({ start: Number, end: Number, primary: String, other: String }, { _id: false });
const reviewSchema = new Schema(
  {
    verified: { type: Boolean, default: false }, // đã đọc được lần 2 và so với bản chính
    tooMany: { type: Boolean, default: false }, // 2 bản khác nhau quá nhiều: cần so lại toàn bộ
    truncated: { type: Boolean, default: false }, // giấy tờ dài hơn giới hạn của AI: phần chữ có thể thiếu đoạn cuối
    quality: { type: String, enum: ["good", "fair", "poor"], default: "good" }, // chất lượng ảnh; "poor" = bệnh nhân đã chọn "vẫn dùng ảnh này"
    qualityReasons: { type: [String], default: [] }, // "blurry" | "small" | "dark"
    checks: { type: [checkSchema], default: [] }, // các chỗ 2 lần đọc khác nhau (vị trí trong text lúc AI trả về)
  },
  { _id: false }
);

const scannedDocumentSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    hospitalId: { type: Schema.Types.ObjectId, ref: "Hospital", default: null },
    title: { type: String, required: true },
    text: { type: String, default: "" },
    fields: { type: fieldsSchema, default: () => ({}) },
    review: { type: reviewSchema, default: () => ({}) },
    fileId: { type: String, required: true }, // StoredMedicalFile.fileId
    mimeType: { type: String, required: true },
    ocrStatus: { type: String, enum: ["done", "failed"], default: "done" },
    // lần đồng ý gửi ảnh cho AI đã cho phép quét giấy tờ này (dấu vết, không đổi khi bệnh nhân đồng ý lại sau đó)
    consentVersion: { type: String, default: null },
    consentGrantedAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null }, // bệnh nhân đã xem lại và bấm lưu
  },
  { timestamps: true }
);

export const ScannedDocument = model("ScannedDocument", scannedDocumentSchema, "scanned_documents");

/**
 * Số lần quét của 1 bệnh nhân trong 1 ngày (mỗi lần quét tốn lượt AI). Tách khỏi ScannedDocument để
 * xoá giấy tờ không được hoàn lượt. Bản ghi tự xoá sau vài ngày (TTL).
 */
const scanUsageSchema = new Schema({
  patientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  day: { type: String, required: true }, // YYYY-MM-DD theo giờ Việt Nam
  count: { type: Number, default: 0 },
  rejected: { type: Number, default: 0 }, // số lần ảnh kém bị từ chối đã được hoàn lượt trong ngày (có trần)
  expireAt: { type: Date, required: true },
});
scanUsageSchema.index({ patientId: 1, day: 1 }, { unique: true });
scanUsageSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export const ScanUsage = model("ScanUsage", scanUsageSchema, "scan_usages");

/**
 * Bệnh nhân đồng ý gửi ảnh giấy tờ tới dịch vụ AI bên ngoài (Google Gemini) để đọc chữ — dữ liệu sức khoẻ là dữ liệu
 * cá nhân nhạy cảm (Nghị định 13/2023), phải có đồng ý rõ ràng trước lần quét đầu. 1 bản ghi/bệnh nhân = trạng thái hiện tại;
 * rút lại thì ghi `revokedAt`. Dấu vết từng lần nằm ở mỗi giấy tờ (`consentVersion`, `consentGrantedAt`).
 * `version` = bản thông báo bệnh nhân đã đọc; đổi nội dung thì hỏi lại.
 */
const scanConsentSchema = new Schema({
  patientId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  version: { type: String, required: true },
  grantedAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
});

export const ScanConsent = model("ScanConsent", scanConsentSchema, "scan_consents");
export default ScannedDocument;
