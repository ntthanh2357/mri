import { Schema, model } from 'mongoose';
import { tenancyPlugin } from "../../../plugins/tenancy.plugin.js";

const invoiceItemSchema = new Schema({
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['exam', 'mri', 'ai', 'drug', 'other'], default: 'other' }
}, { _id: false });

const invoiceSchema = new Schema(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    visitId: { type: Schema.Types.ObjectId, ref: 'Visit', index: true },
    items: [invoiceItemSchema],
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ['chờ thanh toán', 'đã thanh toán', 'hoàn trả'], default: 'chờ thanh toán' },
    paymentMethod: { type: String, enum: ['tiền mặt', 'chuyển khoản', 'vietqr', ''], default: '' },
    orderCode: { type: Number, unique: true, sparse: true },
    paidAt: { type: Date, default: null },
    // M.5 — Hoàn tiền
    refundReason: { type: String, default: null },
    refundedAt: { type: Date, default: null },
    refundedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    // R.2 — BHYT đồng chi trả
    bhytInfo: {
      bhytId: { type: Schema.Types.ObjectId, ref: 'BhytInfo', default: null },
      cardNumber: { type: String, default: null },        // Che số thẻ (4 ký tự cuối)
      coverageRate: { type: Number, default: 0 },        // % BHYT chi trả
      bhytAmount: { type: Number, default: 0 },          // Số tiền BHYT chi trả
      patientCopayAmount: { type: Number, default: 0 },  // Bệnh nhân đồng chi trả
    },
    patientPayAmount: { type: Number, default: null },   // Thực tế bệnh nhân trả (sau BHYT)
  },
  { timestamps: true }
);

invoiceSchema.plugin(tenancyPlugin);

// Compound indexes tối ưu hiệu năng lọc hóa đơn theo bệnh viện và trạng thái thanh toán
invoiceSchema.index({ hospitalId: 1, status: 1, createdAt: -1 });
invoiceSchema.index({ hospitalId: 1, patientId: 1, createdAt: -1 });

export const Invoice = model('Invoice', invoiceSchema);
export default Invoice;

