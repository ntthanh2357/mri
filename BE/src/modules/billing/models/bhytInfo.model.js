import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../../../plugins/tenancy.plugin.js";

/**
 * R.1 — Thông tin thẻ BHYT của bệnh nhân
 * Lưu riêng khỏi MedicalRecord, mã hóa AES-256 trong thực tế (ghi chú: đây là bản MVP)
 */
const bhytInfoSchema = new Schema(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    visitId: { type: Schema.Types.ObjectId, ref: "Visit", default: null }, // Liên kết lần khám cụ thể

    // Thông tin thẻ BHYT (R.1)
    cardNumber: { type: String, required: true, trim: true }, // Số thẻ BHYT (mã hóa trong thực tế)
    coverageRate: { type: Number, default: 80 }, // Tỷ lệ BHYT chi trả (%) — 80/95/100
    expiresAt: { type: Date, default: null }, // Ngày hết hạn thẻ
    registrationPlace: { type: String, default: "" }, // Nơi đăng ký KCB ban đầu
    patientName: { type: String, default: "" }, // Tên trên thẻ BHYT

    // Trạng thái kiểm tra hợp lệ
    isValid: { type: Boolean, default: true }, // Thẻ còn hạn
    verifiedAt: { type: Date, default: null }, // Lần xác thực gần nhất

    // R.2 — Tính mức hưởng (tự động tính khi tạo hóa đơn)
    // Thông tin này được copy vào Invoice khi lập hóa đơn
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", default: null },

    // Ghi chú
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

bhytInfoSchema.plugin(tenancyPlugin);

export const BhytInfo = model("BhytInfo", bhytInfoSchema);
export default BhytInfo;
