import { Schema, model } from 'mongoose';

const premiumOrderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    orderCode: { type: Number, unique: true, required: true },
    paidAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export const PremiumOrder = model('PremiumOrder', premiumOrderSchema);
export default PremiumOrder;
