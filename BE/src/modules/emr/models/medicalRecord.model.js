import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../../../plugins/tenancy.plugin.js";

const medicalRecordSchema = new Schema(
  {
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: 'Hospital',
      required: true,
      index: true,
    },
    patientId: {
      type: String,
      required: true,
      trim: true,
    },
    patientName: {
      type: String,
      required: true,
      trim: true,
    },
    gender: {
      type: String,
      enum: ["Nam", "Nữ", "Khác"],
      default: "Nam",
    },
    age: {
      type: Number,
      required: true,
    },

    admissionType: {
      type: String,
      enum: ["Ngoại trú", "Nội trú", "Cấp cứu"],
      default: "Ngoại trú",
    },
    department: {
      type: String,
      required: true,
      default: "Khoa Nội Thần Kinh",
    },
    paymentMethod: {
      type: String,
      enum: ["BHYT", "Viện phí", "Dịch vụ"],
      default: "Viện phí",
    },
    diagnosis: {
      type: String,
      required: true,
      default: "",
    },
    treatmentPlan: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["Đang điều trị", "Xuất viện", "Cấp cứu"],
      default: "Đang điều trị",
    },
    dischargeDate: {
      type: Date,
      default: null,
    },
    doctorInCharge: {
      type: String,
      required: true,
    },
    signStatus: {
      type: String,
      enum: ["Chưa duyệt", "Đã duyệt", "Đã ký số"],
      default: "Chưa duyệt",
    },
    allergies: [
      {
        type: String,
      },
    ],
    wardId: {
      type: String,
      default: "",
      trim: true,
    },
    currentVersion: {
      type: Number,
      default: 1,
    },

    // [TT46/2018/TT-BYT & NEURO-ONCOLOGY]: Động cơ thời hạn lưu trữ hồ sơ bệnh án
    retentionCategory: {
      type: String,
      enum: [
        "ngoai_tru",
        "noi_tru",
        "tai_nan_lao_dong",
        "tam_than",
        "tu_vong",
        "neuro_oncology_malignant",
        "neuro_oncology_benign",
        "neuro_oncology_metastatic",
        "clinical_trial_participant",
        "deceased_neuro_oncology",
      ],
      default: "neuro_oncology_malignant",
      required: true,
    },
    retentionYears: {
      type: Number,
      default: 30,
    },
    retentionExpiresAt: {
      type: Date,
      default: null,
    },
    legalHold: {
      isHeld: { type: Boolean, default: false },
      reason: { type: String, default: "" },
      heldBy: { type: String, default: "" },
      heldAt: { type: Date, default: null },
    },
    requiresReview: {
      type: Boolean,
      default: false, // true cho các hồ sơ chuyển đổi từ hệ thống cũ cần rà soát
    },

    // [NEURO-ONCOLOGY / WHO CNS5 (2021)]: Phân độ mô bệnh học và chẩn đoán u sọ não
    whoGrade: {
      type: String,
      enum: ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Chưa xác định", ""],
      default: "",
    },
    tumorType: {
      type: String,
      enum: ["Glioma", "Meningioma", "Pituitary", "Metastatic", "Khác", ""],
      default: "",
    },
    molecularMarkers: {
      idhStatus: { type: String, default: "" }, // IDH1/IDH2 mutant vs wildtype
      mgmtMethylation: { type: String, default: "" }, // Methylated vs Unmethylated
      codeletion1p19q: { type: String, default: "" }, // Co-deleted vs Non-codeleted
      tertPromoter: { type: String, default: "" },
      atrxStatus: { type: String, default: "" },
      egfrAmplification: { type: String, default: "" },
      h3k27mStatus: { type: String, default: "" },
      brafMutation: { type: String, default: "" },
    },

    // [DICOM HYBRID MINI-PACS INTEGRITY]: Băm kiểm tra tính toàn vẹn gói DICOM (.zip)
    dicomIntegrityHash: {
      type: String,
      default: "", // SHA-256 của file nén DICOM gốc
    },

    // [ICH-GCP / THỬ NGHIỆM LÂM SÀNG]: Đánh dấu tham gia nghiên cứu thử nghiệm lâm sàng
    isClinicalTrial: {
      type: Boolean,
      default: false,
    },
    clinicalTrialProtocolId: {
      type: String,
      default: "",
    },

    // [HIPAA §164.312(a)(2)(iv)]: Ghi chú nhạy cảm hỗ trợ mã hóa cấp trường (AES-256-GCM)
    psychiatricNotes: {
      type: String,
      default: "",
    },
    hivStatusNotes: {
      type: String,
      default: "",
    },
    geneticNotes: {
      type: String,
      default: "", // Tư vấn di truyền / NGS ghi chú bảo mật
    },

    // [LUẬT GDĐT 20/2023/QH15 & TT46/2018/TT-BYT]: Chữ ký số y tế pháp lý
    digitalSignatureMetadata: {
      signatureType: {
        type: String,
        enum: ["pki_token", "cloud_hsm", "smartcard", "electronic"],
        default: "electronic",
      },
      certificateSerial: { type: String, default: "" },
      signingAlgorithm: { type: String, default: "SHA256withRSA" },
      timestampToken: { type: String, default: "" },
      caProvider: { type: String, default: "" },
      signedHash: { type: String, default: "" },
      signedBy: { type: String, default: "" },
      signedAt: { type: Date, default: null },
    },

    // [TT46/2018/TT-BYT & LUẬT 15/2023/QH15]: Phụ lục bệnh án Append-Only sau khi đã ký số
    addendums: [
      {
        content: { type: String, required: true },
        reason: { type: String, required: true },
        author: { type: String, required: true },
        authorId: { type: Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
        signedHash: { type: String, default: "" },
        signedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

medicalRecordSchema.plugin(tenancyPlugin);

export const MedicalRecord = model("MedicalRecord", medicalRecordSchema);
export default MedicalRecord;
