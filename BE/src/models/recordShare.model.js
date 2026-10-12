import { Schema, model } from "mongoose";

/**
 * UC-PAT-09 — Chia sẻ bệnh án qua QR.
 * Mã QR chỉ mở được trong 5 phút; mỗi người quét trong thời gian đó nhận 1 phiên xem riêng (không hết hạn)
 * cho tới khi bệnh nhân thu hồi. Mọi mã chỉ lưu dạng băm SHA-256.
 * Không gắn tenancyPlugin: trang xem công khai không có phiên đăng nhập; service luôn lọc tường minh
 * theo patientId (phía bệnh nhân) hoặc mã băm (phía người xem).
 */
const viewerSessionSchema = new Schema(
  {
    viewerTokenHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    lastViewedAt: { type: Date, default: null },
    viewCount: { type: Number, default: 0 },
    userAgent: { type: String, default: "" }, // nhận diện sơ bộ thiết bị người xem (cắt ngắn)
  },
  { _id: true }
);

const recordShareSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    hospitalId: { type: Schema.Types.ObjectId, ref: "Hospital", default: null },
    qrTokenHash: { type: String, required: true, unique: true },
    qrExpiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    sessions: { type: [viewerSessionSchema], default: [] },
  },
  { timestamps: true }
);

recordShareSchema.index({ "sessions.viewerTokenHash": 1 });

export const RecordShare = model("RecordShare", recordShareSchema, "record_shares");
export default RecordShare;
