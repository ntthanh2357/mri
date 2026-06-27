import { Schema, model } from "mongoose";

const visitSchema = new Schema(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    nurseId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    technicianId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    date: { type: Date, default: null },
    facility: { type: String, default: "" },
    visitType: { type: String, default: "" },
    documents: [
      {
        docKey: { type: String },
        groupKey: { type: String },
        label: { type: String },
        storageType: { type: String },
        fileUrl: { type: String },
        fileName: { type: String },
        fileType: { type: String },
        manualData: { type: Schema.Types.Mixed },
        uploadedAt: { type: Date, default: Date.now }
      }
    ],
    status: {
      type: String,
      enum: ['đang chờ', 'đang khám', 'chờ chụp', 'đang chụp', 'chờ kết quả AI', 'chờ bác sĩ đọc', 'hoàn tất', 'đã đóng'],
      default: 'đang chờ'
    },
    reason: { type: String, default: "" },
    vitals: {
      pulse: { type: Number, default: null },
      bloodPressure: { type: String, default: "" },
      temperature: { type: Number, default: null },
      spo2: { type: Number, default: null },
      respiratoryRate: { type: Number, default: null },
      measuredAt: { type: Date, default: null }
    },
    mriOrder: {
      region: { type: String, default: "" },
      instructions: { type: String, default: "" },
      requestAiAnalysis: { type: Boolean, default: false },
      imagingResultId: { type: Schema.Types.ObjectId, ref: 'ImagingResult', default: null },
      orderedAt: { type: Date, default: null }
    },
    aiResultRef: { type: String, default: null },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', default: null }
  },
  { timestamps: true }
);

export const Visit = model("Visit", visitSchema);
export default Visit;
