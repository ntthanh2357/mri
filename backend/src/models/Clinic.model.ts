import mongoose, { Schema, Document } from 'mongoose';
import { Clinic } from '@neuroscan/types';

interface IClinic extends Omit<Clinic, '_id'>, Document {}

const ClinicSchema: Schema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  address: { type: String, required: true },
  phone: { type: String, required: true },
  businessLicense: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  walletBalance: { type: Number, default: 0 },
}, {
  timestamps: true
});

export default mongoose.model<IClinic>('Clinic', ClinicSchema);
