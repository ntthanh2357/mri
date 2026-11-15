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
    storageFileId: { type: String, default: null },                     // ID tệp ảnh/DICOM trong StoredMedicalFile (Local/Drive)
    storageReportFileId: { type: String, default: null },               // ID tệp báo cáo chẩn đoán trong StoredMedicalFile
    signedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    signedByDoctorId: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // [BUG-05 FIX] alias dùng trong scheduler
    signedAt: { type: Date, default: null },
    // Chuẩn hóa Chữ ký số y tế PKI / Cloud HSM theo Luật Giao dịch điện tử 20/2023/QH15, NĐ 130/2018/NĐ-CP & TT 13/2025/TT-BYT
    digitalSignatureMetadata: {
      signatureType: {
        type: String,
        // 'internal_hash': chỉ là mã băm toàn vẹn nội bộ, KHÔNG phải chữ ký số PKI (xem P0-2 trong báo cáo audit)
        enum: ['electronic', 'pki_token', 'cloud_hsm', 'smartcard', 'electronic_stamp', 'internal_hash'],
        default: 'electronic',
      },
      certificateSerial: { type: String, default: "" },
      signingAlgorithm: { type: String, default: "SHA256withRSA" },
      timestampToken: { type: String, default: "" },
      caProvider: { type: String, default: "VNPT-CA" },
      signedHash: { type: String, default: "" },
      signedBy: { type: String, default: "" },
      signedAt: { type: Date, default: null },
      isTampered: { type: Boolean, default: false },
    },
    // [BUG-05 FIX] - Các field thiếu khiến scheduler.js không lưu được dữ liệu
    visitId: { type: Schema.Types.ObjectId, ref: 'Visit', default: null },          // Liên kết trực tiếp đến Visit
    peerReviewId: { type: Schema.Types.ObjectId, ref: 'PeerReview', default: null }, // Đã có peer review chưa (tránh tạo lại)
    // ── Báo cáo CĐHA u não có cấu trúc (Structured Brain Tumor Report + RANO) ──
    structuredReport: {
      hemisphere: { type: String, enum: ['left', 'right', 'bilateral', 'midline', 'none'], default: 'none' },
      lobe: {
        type: String,
        enum: ['frontal', 'temporal', 'parietal', 'occipital', 'cerebellar', 'brainstem', 'sellar_pituitary', 'cp_angle', 'multifocal', 'none'],
        default: 'none'
      },
      axialLocation: { type: String, enum: ['intra_axial', 'extra_axial', 'intraventricular', 'none'], default: 'none' },
      measurements: {
        d1Mm: { type: Number, default: 0 },
        d2Mm: { type: Number, default: 0 },
        d3Mm: { type: Number, default: 0 },
        crossProductMm2: { type: Number, default: 0 },
        sliceIndex: { type: Number, default: 0 },
        seriesType: { type: String, default: 'T1C+' }
      },
      enhancement: { type: String, enum: ['none', 'homogeneous', 'ring_enhancing', 'heterogeneous'], default: 'none' },
      peritumoralEdema: { type: String, enum: ['none', 'mild', 'moderate', 'severe'], default: 'none' },
      necrosis: { type: Boolean, default: false },
      hemorrhage: { type: Boolean, default: false },
      midlineShiftMm: { type: Number, default: 0 },
      herniation: { type: String, enum: ['none', 'subfalcine', 'uncal', 'transtentorial', 'tonsillar'], default: 'none' },
      hydrocephalus: { type: Boolean, default: false },
      rano: {
        priorResultId: { type: Schema.Types.ObjectId, ref: 'ImagingResult', default: null },
        priorCrossProductMm2: { type: Number, default: null },
        changePercent: { type: Number, default: null },
        category: { type: String, enum: ['CR', 'PR', 'SD', 'PD', 'N/A'], default: 'N/A' },
        isPseudoprogressionSuspected: { type: Boolean, default: false },
        radiotherapyEndDate: { type: Date, default: null }
      }
    },
    // Đánh giá đồng thuận giữa Bác sĩ đọc phim và AI (AI-Radiologist Concordance)
    aiAgreement: {
      status: { type: String, enum: ['agreed', 'modified', 'rejected', 'unrated'], default: 'unrated' },
      note: { type: String, default: '' }
    },
    // Cảnh báo Đỏ CĐHA (Critical Imaging Finding Alert - ACR Guideline)
    criticalFinding: {
      isCritical: { type: Boolean, default: false },
      reason: { type: String, default: '' },
      notifiedAt: { type: Date, default: null },
      acknowledgedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      acknowledgedByName: { type: String, default: '' },
      acknowledgedAt: { type: Date, default: null },
      escalatedAt: { type: Date, default: null }
    },
    // [Q-CLINICAL-01] Bác sĩ lâm sàng xác nhận đã đọc báo cáo CĐHA (Attending Acknowledgment)
    attendingAcknowledgment: {
      acknowledgedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      acknowledgedByName: { type: String, default: '' },
      acknowledgedAt: { type: Date, default: null },
      clinicalNote: { type: String, default: '' }
    },
    // Lý do khi Trưởng khoa (department_head) ký thay Bác sĩ CĐHA (radiologist)
    actingRadiologistReason: { type: String, default: '' },
    // Bản đính chính / bổ sung sau ký số (Addendum - bất biến bản gốc theo TT46/2018/TT-BYT)
    addenda: [
      {
        content: { type: String, required: true },
        reason: { type: String, default: '' },
        addendumType: {
          type: String,
          enum: ['radiology_amendment', 'clinical_correlation'],
          default: 'radiology_amendment'
        },
        authorRole: { type: String, default: '' },
        addedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        addedByName: { type: String, default: '' },
        addedAt: { type: Date, default: Date.now },
        signatureHash: { type: String, default: '' }
      }
    ]
  },
  {
    timestamps: true,
  }
);

imagingResultSchema.plugin(tenancyPlugin);

export const ImagingResult = model("ImagingResult", imagingResultSchema);
export default ImagingResult;
