import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../../../plugins/tenancy.plugin.js";

const consultationSchema = new Schema(
  {
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: 'Hospital',
      required: true,
      index: true
    },
    medicalRecordId: {
      type: Schema.Types.ObjectId,
      ref: "MedicalRecord",
      required: true,
    },
    meetingDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    participants: {
      type: [String], // Danh sách bác sĩ tham gia
      required: true,
      default: [],
    },
    clinicalSummary: {
      type: String,
      required: true,
      default: "",
    },
    diagnosis: {
      type: String,
      required: true,
      default: "",
    },
    treatmentConclusion: {
      type: String,
      required: true,
      default: "",
    },
    // [NEURO-ONCOLOGY TUMOR BOARD]: Hội chẩn đa chuyên khoa ung thư thần kinh
    consultationType: {
      type: String,
      enum: ["ordinary", "tumor_board"],
      default: "ordinary",
      index: true,
    },
    tumorBoardDetails: {
      surgicalPlan: { type: String, default: "" }, // Ngoại thần kinh (vi phẫu, navigation)
      radiotherapyPlan: { type: String, default: "" }, // Xạ phẫu Gamma Knife / CyberKnife / IMRT
      chemotherapyPlan: { type: String, default: "" }, // Hóa chất (Temozolomide phác đồ Stupp)
      molecularReview: { type: String, default: "" }, // Đánh giá IDH, MGMT, 1p/19q
      imagingReview: { type: String, default: "" }, // So sánh MRI đa thời điểm (RANO criteria)
      consensusDecision: { type: String, default: "" }, // Kết luận đồng thuận của Hội đồng
      chairApprovedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      chairApprovedByName: { type: String, default: "" },
      chairApprovedAt: { type: Date, default: null },
      isLocked: { type: Boolean, default: false },
      scheduledSurgeryDate: { type: Date, default: null },
      radiotherapyEndDate: { type: Date, default: null },
      postOpMriDueAt: { type: Date, default: null },
      postOpMriVisitId: { type: Schema.Types.ObjectId, ref: "Visit", default: null },
      nextSurveillanceDate: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

consultationSchema.plugin(tenancyPlugin);

export const Consultation = model("Consultation", consultationSchema);
export default Consultation;
