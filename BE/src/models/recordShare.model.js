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
    // Nhân viên quét mã ngay trong app (đang đăng nhập): lưu tên + vai trò tại thời điểm mở để bệnh nhân biết ai đã xem.
    // Người quét bằng camera thường (không đăng nhập) thì 3 trường này để trống.
    viewerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    viewerName: { type: String, default: "" },
    viewerRole: { type: String, default: "" },
  },
  { _id: true }
);

// Mục bệnh nhân chọn riêng trong từng nhóm (mã bản ghi dạng chuỗi; nhóm "safety" dùng "allergies" / "emergencyContact").
// Nhóm không có danh sách = chia sẻ cả nhóm. Đã kiểm quyền sở hữu ở sharedRecord.service: resolveShareItems.
const idList = { type: [String], default: undefined };
const itemIdsSchema = new Schema(
  { visits: idList, imaging: idList, prescriptions: idList, labs: idList, vitals: idList, safety: idList, inpatient: idList, papers: idList },
  // nhóm lạ thì báo lỗi, không lặng lẽ bỏ (bỏ danh sách mục = thành chia sẻ cả nhóm)
  { _id: false, strict: "throw" }
);

const recordShareSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    hospitalId: { type: Schema.Types.ObjectId, ref: "Hospital", default: null },
    qrTokenHash: { type: String, required: true, unique: true },
    qrExpiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    // Nhóm bệnh nhân chọn chia sẻ (SHARE_SECTIONS trong sharedRecord.service). Bản ghi cũ không có trường này = chia sẻ tất cả.
    sections: { type: [String], default: undefined },
    // Giấy tờ tự quét bệnh nhân chọn cho lượt này (chốt lúc tạo). Không có trường này = mọi giấy tờ đã kiểm tra (lượt tạo trước 2026-10-13).
    documentIds: { type: [Schema.Types.ObjectId], default: undefined },
    itemIds: { type: itemIdsSchema, default: undefined }, // chốt lúc tạo mã; không có = mọi nhóm đều chia sẻ cả nhóm
    sessions: { type: [viewerSessionSchema], default: [] },
  },
  { timestamps: true }
);

recordShareSchema.index({ "sessions.viewerTokenHash": 1 });

export const RecordShare = model("RecordShare", recordShareSchema, "record_shares");
export default RecordShare;
