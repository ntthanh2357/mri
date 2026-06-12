import mongoose, { Schema, Document } from 'mongoose';
import { User, UserRole } from '@neuroscan/types';

interface IUser extends Omit<User, '_id'>, Document {}

const UserSchema: Schema = new Schema({
  email: { type: String, unique: true, sparse: true },
  phone: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['patient', 'doctor', 'admin', 'partner'], required: true },
  password: { type: String },
  isVerified: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false },
}, {
  timestamps: true
});

export default mongoose.model<IUser>('User', UserSchema);
