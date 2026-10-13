import { Schema, model } from "mongoose";

/**
 * UC-PAT-09 (mở rộng) — Giấy tờ bệnh nhân tự chụp (đơn thuốc, kết quả khám nơi khác...) kèm chữ AI đọc được.
 * Ảnh nằm trong kho riêng (storageService, category "patient_upload"), KHÔNG nằm trong /uploads công khai;
 * chỉ xem được qua link ngắn hạn có chữ ký. Giấy tờ chưa được bệnh nhân kiểm tra (confirmedAt = null) không đem chia sẻ.
 * Không gắn tenancyPlugin (giống RecordShare): giấy tờ thuộc về bệnh nhân, trang xem công khai không có phiên đăng nhập;
 * service luôn lọc tường minh theo patientId.
 */
const scannedDocumentSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    hospitalId: { type: Schema.Types.ObjectId, ref: "Hospital", default: null },
    title: { type: String, required: true },
    text: { type: String, default: "" },
    fileId: { type: String, required: true }, // StoredMedicalFile.fileId
    mimeType: { type: String, required: true },
    ocrStatus: { type: String, enum: ["done", "failed"], default: "done" },
    confirmedAt: { type: Date, default: null }, // bệnh nhân đã xem lại và bấm lưu
  },
  { timestamps: true }
);

export const ScannedDocument = model("ScannedDocument", scannedDocumentSchema, "scanned_documents");

/**
 * Số lần quét của 1 bệnh nhân trong 1 ngày (mỗi lần quét tốn 1 lượt AI). Tách khỏi ScannedDocument để
 * xoá giấy tờ không được hoàn lượt. Bản ghi tự xoá sau vài ngày (TTL).
 */
const scanUsageSchema = new Schema({
  patientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  day: { type: String, required: true }, // YYYY-MM-DD theo giờ Việt Nam
  count: { type: Number, default: 0 },
  expireAt: { type: Date, required: true },
});
scanUsageSchema.index({ patientId: 1, day: 1 }, { unique: true });
scanUsageSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export const ScanUsage = model("ScanUsage", scanUsageSchema, "scan_usages");
export default ScannedDocument;
