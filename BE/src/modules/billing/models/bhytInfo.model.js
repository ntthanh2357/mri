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

    // Quản lý trần BHYT & Trái tuyến & Phê duyệt thuốc đặc trị (TT30/2018/TT-BYT & NĐ 146/2018)
    annualCap: { type: Number, default: 72000000 },       // Trần BHYT 40 tháng lương cơ sở (~72M VNĐ)
    usedThisYear: { type: Number, default: 0 },           // Lũy kế BHYT đã thanh toán trong năm
    isOutOfNetwork: { type: Boolean, default: false },     // KCB trái tuyến
    treatmentType: { type: String, enum: ["outpatient", "inpatient"], default: "outpatient" }, // Ngoại trú / Nội trú
    hasTransferForm: { type: Boolean, default: false },    // Có giấy chuyển tuyến đúng quy định
    priorAuthorizations: [
      {
        drugCode: { type: String, required: true },       // Mã hoạt chất/thuốc (ví dụ: Bevacizumab, Temozolomide)
        approvalNumber: { type: String, required: true }, // Số văn bản phê duyệt / biên bản hội chẩn
        approvedAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, default: null },
        indications: [{ type: String }]                   // Chỉ định ung thư não được duyệt
      }
    ],

    // Ghi chú
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

bhytInfoSchema.plugin(tenancyPlugin);

export const BhytInfo = model("BhytInfo", bhytInfoSchema);
export default BhytInfo;
