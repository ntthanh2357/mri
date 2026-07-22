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
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2020, max: 2100 },
    totalAmount: { type: Number, required: true },
    dailyRecords: [dailyRecordSchema],
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

// Index tối ưu hoá query theo bệnh viện + tháng + năm
revenueReportSchema.index({ hospitalId: 1, month: 1, year: 1 });

export const RevenueReport = model('RevenueReport', revenueReportSchema);
export default RevenueReport;
