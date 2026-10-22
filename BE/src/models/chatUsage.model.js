import { Schema, model } from "mongoose";

/**
 * Số câu hỏi 1 bệnh nhân gửi cho chatbot trong 1 ngày (mỗi câu tốn 1 lượt Gemini dùng chung với đọc phim).
 * Lưu trong DB vì bộ giới hạn tần suất của BE tắt khi chạy ngoài production. Bản ghi tự xoá sau vài ngày (TTL).
 */
const chatUsageSchema = new Schema({
  patientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  day: { type: String, required: true }, // YYYY-MM-DD theo giờ Việt Nam
  count: { type: Number, default: 0 },
  refunded: { type: Number, default: 0 }, // số lần hoàn lượt "không chắc" trong ngày (có trần, xem patientChat.service)
  expireAt: { type: Date, required: true },
});
chatUsageSchema.index({ patientId: 1, day: 1 }, { unique: true });
chatUsageSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export const ChatUsage = model("ChatUsage", chatUsageSchema, "chat_usages");

/**
 * Bệnh nhân đồng ý gửi câu hỏi sức khoẻ tới Google Gemini (dữ liệu nhạy cảm, Nghị định 13/2023; AI service còn ghi nhật ký hỏi đáp).
 * 1 bản ghi/bệnh nhân; rút lại thì ghi `revokedAt`. `version` = bản thông báo bệnh nhân đã đọc; đổi nội dung thì hỏi lại.
 */
const chatConsentSchema = new Schema({
  patientId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  version: { type: String, required: true },
  grantedAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
});

export const ChatConsent = model("ChatConsent", chatConsentSchema, "chat_consents");
export default ChatUsage;
