import { Schema, model } from 'mongoose';

const hospitalSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, index: true },
    address: { type: String, default: "", trim: true },
    pricing: {
      examFee: { type: Number, default: 150000 },
      mriFee: { type: Number, default: 1500000 },
      aiFee: { type: Number, default: 200000 }
    },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Hospital = model('Hospital', hospitalSchema);
export default Hospital;
