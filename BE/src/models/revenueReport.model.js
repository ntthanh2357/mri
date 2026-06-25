import { Schema, model } from 'mongoose';

const dailyRecordSchema = new Schema({
  day: { type: Number, required: true },
  patientCount: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 }
}, { _id: false });

const revenueReportSchema = new Schema(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    dailyRecords: [dailyRecordSchema],
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

export const RevenueReport = model('RevenueReport', revenueReportSchema);
export default RevenueReport;
