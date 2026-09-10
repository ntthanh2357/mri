import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../../../plugins/tenancy.plugin.js";

/**
 * DicomStudy — Bản ghi Study DICOM (Module B.4)
 * Mỗi lần chụp MRI = 1 Study, chứa nhiều Series.
 */
const dicomStudySchema = new Schema(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    visitId: { type: Schema.Types.ObjectId, ref: 'Visit', required: true, index: true },
    imagingResultId: { type: Schema.Types.ObjectId, ref: 'ImagingResult', default: null },
    // DICOM identifiers
    studyDate: { type: Date, default: null },
    studyUID: { type: String, default: "", index: true }, // StudyInstanceUID từ DICOM
    accessionNumber: { type: String, default: "" },
    // Thông tin Study
    seriesCount: { type: Number, default: 0 },
    totalSlices: { type: Number, default: 0 },
    imagingType: { type: String, enum: ['MRI', 'CT'], default: 'MRI' },
    // Google Drive folder
    driveStudyFolderId: { type: String, default: "" }, // ID thư mục Study trên Drive
    driveStudyFolderUrl: { type: String, default: "" },
    // Trạng thái xử lý (B.5 validation, B.3 upload, C pipeline)
    status: {
      type: String,
      enum: ['uploading', 'validating', 'upload_complete', 'processing', 'completed', 'error'],
      default: 'uploading',
      index: true
    },
    // B.5 — Kết quả validate DICOM
    validationErrors: [{ type: String }],
    validatedAt: { type: Date, default: null },
    // Metadata bổ sung
    description: { type: String, default: "" },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // KTV upload
    uploadedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

dicomStudySchema.plugin(tenancyPlugin);

export const DicomStudy = model("DicomStudy", dicomStudySchema);
export default DicomStudy;
