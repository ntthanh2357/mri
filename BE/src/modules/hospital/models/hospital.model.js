import { Schema, model } from 'mongoose';

const hospitalSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    nameShort: { type: String, trim: true, default: '' },
    code: { type: String, required: true, unique: true, trim: true, index: true },
    taxCode: { type: String, trim: true, default: '' },
    licenseFile: { type: String, default: '' },

    loginEmail: { type: String, trim: true, lowercase: true, default: '' },
    tempUsername: { type: String, default: '' },

    address: {
      street: { type: String, default: '' },
      ward: { type: String, default: '' },
      district: { type: String, default: '' },
      province: { type: String, default: '' },
    },
    phone: { type: String, default: '' },
    contactEmail: { type: String, trim: true, lowercase: true, default: '' },
    website: { type: String, default: '' },
    fax: { type: String, default: '' },

    legalRep: {
      name: { type: String, default: '' },
      position: { type: String, default: '' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
    },

    itContact: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
    },

    status: {
      type: String,
      enum: ['provisioned', 'submitted', 'active', 'rejected'],
      default: 'provisioned',
    },

    pricing: {
      examFee: { type: Number, default: 150000 },
      mriFee: { type: Number, default: 1500000 },
      aiFee: { type: Number, default: 200000 },
      maxPatients: { type: Number, default: 50 },
    },

    subscriptionPlan: {
      type: String,
      enum: ['trial', 'basic', 'pro'],
      default: 'trial',
    },
    subscriptionExpiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'expired', 'suspended'],
      default: 'active',
    },
    isActive: { type: Boolean, default: true },

    // Google Drive Configurations
    driveFolderId: { type: String, default: '' },
    driveFolderUrl: { type: String, default: '' },
    subFolders: {
      originalScansId: { type: String, default: '' },
      aiPredictionsId: { type: String, default: '' },
      doctorRevisionsId: { type: String, default: '' },
      patientReportsId: { type: String, default: '' },
      metadataBackupsId: { type: String, default: '' },
      sharedId: { type: String, default: '' },      // Thư mục Shared (chuyển viện F.2)
      auditLogsId: { type: String, default: '' },   // Thư mục Audit_Logs (K.3)
      backupsId: { type: String, default: '' },     // Thư mục Backups (L.2)
    },
    // Module K.4 — Tham số AI & hệ thống
    aiThresholds: {
      midlineShiftMm: { type: Number, default: 5 },          // E.1: ngưỡng lệch đường giữa
      tumorVolumeCm3: { type: Number, default: 50 },         // E.1: ngưỡng thể tích u
      taskDeadlines: {
        readFilmHours: { type: Number, default: 4 },         // I.3: Đọc phim
        signReportHours: { type: Number, default: 2 },       // I.3: Ký duyệt
        aiProcessMinutes: { type: Number, default: 5 },      // C SLA AI
      },
      qaRate: { type: Number, default: 5 },                  // P.2: tỷ lệ QA ngẫu nhiên (%)
    },
  },
  { timestamps: true }
);

export const Hospital = model('Hospital', hospitalSchema);
export default Hospital;
