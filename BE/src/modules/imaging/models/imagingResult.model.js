import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../../../plugins/tenancy.plugin.js";

const imagingResultSchema = new Schema(
  {
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: 'Hospital',
      required: true,
      index: true,
    },
    medicalId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    patientName: {
      type: String,
      required: true,
      trim: true,
    },
    birthYear: {
      type: Number,
      default: null,
    },
    gender: {
      type: String,
      enum: ["Nam", "Nữ", "Khác"],
      required: true,
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    orderDate: {
      type: Date,
      required: true,
    },
    orderingDoctor: {
      type: String,
      trim: true,
      default: "",
    },
    orderingDepartment: {
      type: String,
      trim: true,
      default: "",
    },
    medicalRecordNumber: {
      type: String,
      trim: true,
      default: "",
    },
    diagnosis: {
      type: String,
      trim: true,
      default: "",
    },
    procedure: {
      type: String,
      required: true,
      trim: true,
    },
    technique: {
      type: String,
      trim: true,
      default: "",
    },
    findings: {
      type: String,
      required: true,
      trim: true,
    },
    conclusion: {
      type: String,
      required: true,
      trim: true,
    },
    radiologist: {
      type: String,
      required: true,
      trim: true,
    },
    reportDate: {
      type: Date,
      required: true,
    },
    images: {
      type: [String],
      default: [],
    },
    dicomMetadata: {
      studyInstanceUID: { type: String, default: "" },
      seriesInstanceUID: { type: String, default: "" },
      sopInstanceUIDs: { type: [String], default: [] },
      dicomFileUrls: { type: [String], default: [] },
    },
    // Mini-PACS DICOM archive storage (.zip / .rar)
    dicomZipUrl: {
      type: String,
      default: null,
    },
    dicomZipSize: {
      type: Number,
      default: null,
    },
    dicomZipFilename: {
      type: String,
      default: null,
    },
    imagingType: {
      type: String,
      enum: ["MRI", "CT"],
      required: true,
      index: true,
    },
    // Module O / C — trường AI kết quả
    studyId: { type: Schema.Types.ObjectId, ref: 'DicomStudy', default: null }, // Liên kết DICOM Study
    aiReport: { type: Schema.Types.Mixed, default: null },              // C.4: full_report.json
    segmentationUrl: { type: String, default: null },                  // C.1: mask phân đoạn
    top5SlicesUrls: { type: [String], default: [] },                    // C.6: 5 slice nguy hiểm
    representativeSliceUrl: { type: String, default: null },            // C.7: 1 ảnh đại diện
    model3dUrl: { type: String, default: null },                        // C.5: 3D GLTF model
    aiJobId: { type: Schema.Types.ObjectId, ref: 'AiJob', default: null }, // Liên kết AiJob
    isSigned: { type: Boolean, default: false },                        // Bác sĩ đã ký duyệt
    signedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    signedByDoctorId: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // [BUG-05 FIX] alias dùng trong scheduler
    signedAt: { type: Date, default: null },
    // [BUG-05 FIX] - Các field thiếu khiến scheduler.js không lưu được dữ liệu
    visitId: { type: Schema.Types.ObjectId, ref: 'Visit', default: null },          // Liên kết trực tiếp đến Visit
    peerReviewId: { type: Schema.Types.ObjectId, ref: 'PeerReview', default: null }, // Đã có peer review chưa (tránh tạo lại)
  },
  {
    timestamps: true,
  }
);

imagingResultSchema.plugin(tenancyPlugin);

export const ImagingResult = model("ImagingResult", imagingResultSchema);
export default ImagingResult;
