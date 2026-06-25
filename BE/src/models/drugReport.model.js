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
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    items: [drugReportItemSchema],
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

export const DrugReport = model('DrugReport', drugReportSchema);
export default DrugReport;
