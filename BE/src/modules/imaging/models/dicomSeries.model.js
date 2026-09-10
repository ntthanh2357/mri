import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../../../plugins/tenancy.plugin.js";

/**
 * DicomSeries — Bản ghi từng chuỗi MRI (Module B.2)
 * Mỗi Study có nhiều Series (T2_FLAIR, DWI, ADC, TOF_MRA, v.v.)
 */
const dicomSeriesSchema = new Schema(
  {
    studyId: { type: Schema.Types.ObjectId, ref: 'DicomStudy', required: true, index: true },
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    // B.2 — Phân loại chuỗi theo DICOM metadata
    seriesType: {
      type: String,
      enum: [
        'T2_FLAIR',       // Chuỗi chính phát hiện u
        'DWI',            // Diffusion Weighted Imaging
        'ADC',            // Apparent Diffusion Coefficient
        'TOF_MRA',        // Time-of-Flight MRA (mạch máu)
        'T1_FLAIR',       // T1 FLAIR
        'T2_CORONAL',     // T2 Coronal
        'AX_T1_FLAIR',    // Axial T1 FLAIR
        'OTHER'           // Không xác định
      ],
      required: true,
      index: true
    },
    // DICOM identifiers
    seriesUID: { type: String, default: "", index: true }, // SeriesInstanceUID
    seriesDescription: { type: String, default: "" },       // DICOM tag SeriesDescription
    seriesNumber: { type: Number, default: null },
    modality: { type: String, default: "MR" },              // MR | CT | ...
    // Số lượng file
    sliceCount: { type: Number, default: 0 },
    // Google Drive
    driveSeriesFolderId: { type: String, default: "" },
    driveSeriesFolderUrl: { type: String, default: "" },
    dicomFileUrls: [{ type: String }],                      // URL từng file .dcm trên Drive
    // Metadata kỹ thuật từ DICOM header
    metadata: {
      scanningSequence: { type: String, default: "" },      // Tag ScanningSequence
      pixelSpacing: [{ type: Number }],                     // [row spacing, col spacing]
      sliceThickness: { type: Number, default: null },      // mm
      repetitionTime: { type: Number, default: null },      // TR (ms)
      echoTime: { type: Number, default: null },            // TE (ms)
      flipAngle: { type: Number, default: null },
    },
    // Trạng thái upload
    uploadStatus: {
      type: String,
      enum: ['pending', 'uploading', 'completed', 'error'],
      default: 'pending'
    },
  },
  { timestamps: true }
);

dicomSeriesSchema.plugin(tenancyPlugin);

export const DicomSeries = model("DicomSeries", dicomSeriesSchema);
export default DicomSeries;
