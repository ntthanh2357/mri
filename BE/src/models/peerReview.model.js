import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../plugins/tenancy.plugin.js";

/**
 * PeerReview — Bình duyệt lần 2 (Module P.1, P.2, P.3)
 * Đảm bảo chất lượng đọc phim thông qua review độc lập.
 */
const peerReviewSchema = new Schema(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    imagingResultId: { type: Schema.Types.ObjectId, ref: 'ImagingResult', required: true, index: true },
    visitId: { type: Schema.Types.ObjectId, ref: 'Visit', default: null },
    // P.1 — Loại yêu cầu bình duyệt
    requestType: {
      type: String,
      enum: ['conflict', 'random_qa', 'manual'],
      required: true,
    },
    // Lý do conflict (khi AI và bác sĩ không đồng ý)
    conflictReason: { type: String, default: "" },
    // P.3 — Danh sách bác sĩ review
    readings: [
      {
        reviewerId: { type: Schema.Types.ObjectId, ref: 'User' },
        conclusion: { type: String, default: "" },
        findings: { type: String, default: "" },
        malignancyLevel: {
          type: String,
          enum: ['low', 'moderate', 'high', 'not_applicable'],
          default: 'not_applicable'
        },
        agreeWithAi: { type: Boolean, default: null }, // Đồng ý với AI?
        submittedAt: { type: Date, default: null },
        isConflicting: { type: Boolean, default: false }, // Mâu thuẫn với reading khác
      }
    ],
    // Kết luận cuối (P.3 — trưởng khoa quyết định)
    finalConclusion: { type: String, default: "" },
    finalBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    finalAt: { type: Date, default: null },
    // Trạng thái
    status: {
      type: String,
      enum: ['pending', 'in_review', 'awaiting_final', 'completed', 'cancelled'],
      default: 'pending',
      index: true
    },
    // P.2 — Tuần chọn ngẫu nhiên
    samplingWeek: { type: String, default: null }, // VD "2026-W32"
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // Admin/system
  },
  { timestamps: true }
);

peerReviewSchema.index({ hospitalId: 1, status: 1 });
peerReviewSchema.plugin(tenancyPlugin);

export const PeerReview = model("PeerReview", peerReviewSchema);
export default PeerReview;
