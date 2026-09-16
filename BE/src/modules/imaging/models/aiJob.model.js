import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../../../plugins/tenancy.plugin.js";

/**
 * AiJob — Theo dõi tiến trình AI pipeline (Module C.8, C.9)
 * Mỗi lần kích hoạt AI = 1 job, theo dõi từng bước C.1 → C.7.
 */
const aiJobSchema = new Schema(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    visitId: { type: Schema.Types.ObjectId, ref: 'Visit', required: true, index: true },
    imagingResultId: { type: Schema.Types.ObjectId, ref: 'ImagingResult', default: null },
    studyId: { type: Schema.Types.ObjectId, ref: 'DicomStudy', default: null },
    triggeredBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // KTV kích hoạt
    // Trạng thái job (C.8, C.9)
    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed', 'cancelled'],
      default: 'queued',
      index: true
    },
    priority: { type: Number, default: 5, min: 1, max: 5 }, // 1 = cấp cứu
    // Tiến trình (C.8)
    progress: { type: Number, default: 0, min: 0, max: 100 },
    currentStep: { type: String, default: "" }, // "C.1 T2 FLAIR segmentation", ...
    estimatedSecondsLeft: { type: Number, default: null },
    // Timeline
    queuedAt: { type: Date, default: Date.now },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    // Retry (C.9)
    retryCount: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 3 },
    lastErrorAt: { type: Date, default: null },
    errorLog: [
      {
        step: { type: String },
        message: { type: String },
        timestamp: { type: Date, default: Date.now },
      }
    ],
    // Kết quả từng bước (partial results)
    stepResults: {
      t2Flair: { type: Schema.Types.Mixed, default: null },  // C.1
      dwi: { type: Schema.Types.Mixed, default: null },       // C.2
      tofMra: { type: Schema.Types.Mixed, default: null },    // C.3
      combined: { type: Schema.Types.Mixed, default: null },  // C.4
    },
    // BullMQ job ID để track nếu cần
    bullJobId: { type: String, default: null },
  },
  { timestamps: true }
);

aiJobSchema.index({ hospitalId: 1, status: 1, priority: 1 });
aiJobSchema.plugin(tenancyPlugin);

export const AiJob = model("AiJob", aiJobSchema);
export default AiJob;
