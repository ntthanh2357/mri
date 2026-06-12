import mongoose, { Schema, Document } from 'mongoose';
import { MedicalRecord } from '@neuroscan/types';

interface IMedicalRecord extends Omit<MedicalRecord, '_id'>, Document {}

const MedicalRecordSchema: Schema = new Schema({
  patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  images: [{ type: String, required: true }],
  ocrText: { type: String },
  translatedText: { type: String },
  aiBoundingBox: { type: Schema.Types.Mixed },
  doctorReport: { type: String },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'rejected'], default: 'pending' },
}, {
  timestamps: true
});

export default mongoose.model<IMedicalRecord>('MedicalRecord', MedicalRecordSchema);
