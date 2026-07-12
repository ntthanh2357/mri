import { Schema, model } from 'mongoose';

const drugReportItemSchema = new Schema({
  drugName: { type: String, required: true },
  unit: { type: String, required: true },
  quantity: { type: Number, default: 0 },
  usedCount: { type: Number, default: 0 }
}, { _id: false });

const drugReportSchema = new Schema(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2020, max: 2100 },
    items: [drugReportItemSchema],
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

// Index tối ưu hoá query theo bệnh viện + tháng + năm
drugReportSchema.index({ hospitalId: 1, month: 1, year: 1 });

export const DrugReport = model('DrugReport', drugReportSchema);
export default DrugReport;
