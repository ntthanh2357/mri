import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../plugins/tenancy.plugin.js";

/**
 * Yêu cầu xin bản sao bệnh án: bệnh nhân gửi tới bệnh viện đang gắn với tài khoản, lễ tân / quản lý bệnh viện duyệt hoặc từ chối.
 * Duyệt thì chốt nội dung bệnh án lúc đó vào `snapshot` (chỉ dữ liệu của bệnh viện duyệt), bệnh nhân tải PDF có ký số.
 */
const recordCopyRequestSchema = new Schema(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    patientName: { type: String, default: "" }, // tên lúc gửi: lễ tân duyệt và PDF in đúng tên này (đổi tên sau đó không có tác dụng)
    sections: { type: [String], required: true },
    reason: { type: String, default: "" },
    status: { type: String, enum: ["pending", "approved", "rejected", "cancelled"], default: "pending", index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedByName: { type: String, default: "" },
    reviewedByRole: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
    rejectReason: { type: String, default: "" },
    cancelledAt: { type: Date, default: null },
    snapshot: { type: Schema.Types.Mixed, default: null }, // bệnh án đã lọc (như bản chia sẻ QR), chốt lúc duyệt
    pdf: { type: Buffer, default: null, select: false }, // PDF đã ký, tạo 1 lần lúc duyệt (ký số tốn CPU, không làm lại mỗi lần tải)
  },
  { timestamps: true },
);

recordCopyRequestSchema.plugin(tenancyPlugin);

export const RecordCopyRequest = model("RecordCopyRequest", recordCopyRequestSchema, "record_copy_requests");
export default RecordCopyRequest;
