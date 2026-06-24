import { Schema, model } from 'mongoose';

const invoiceItemSchema = new Schema({
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['exam', 'mri', 'ai', 'other'], default: 'other' }
}, { _id: false });

const invoiceSchema = new Schema(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    visitId: { type: Schema.Types.ObjectId, ref: 'Visit', required: true, index: true },
    items: [invoiceItemSchema],
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ['chờ thanh toán', 'đã thanh toán'], default: 'chờ thanh toán' },
    paymentMethod: { type: String, enum: ['tiền mặt', 'chuyển khoản', ''], default: '' },
    paidAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export const Invoice = model('Invoice', invoiceSchema);
export default Invoice;
