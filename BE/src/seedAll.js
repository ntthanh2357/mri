import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import crypto from "crypto";

// ── IMPORT ALL 40+ MODELS ─────────────────────────────────────────────────────
import Hospital from "./models/hospital.model.js";
import { User } from "./models/user.model.js";
import { PatientProfile } from "./models/patientProfile.model.js";
import { BhytInfo } from "./models/bhytInfo.model.js";
import { DataPrivacyConsent } from "./models/dataPrivacyConsent.model.js";
import { WorkSchedule } from "./models/workSchedule.model.js";
import { SwapRequest } from "./models/swapRequest.model.js";
import { HospitalBed } from "./models/hospitalBed.model.js";
import { MriRoom } from "./models/mriRoom.model.js";
import { MriSlot } from "./models/mriSlot.model.js";
import { Visit } from "./models/visit.model.js";
import { EmergencyAlert } from "./models/emergencyAlert.model.js";
import { VitalSign } from "./models/vitalSign.model.js";
import CareSheet from "./models/careSheet.model.js";
import MedicalRecord from "./models/medicalRecord.model.js";
import EMRVersion from "./models/emrVersion.model.js";
import Consultation from "./models/consultation.model.js";
import ConsentForm from "./models/consentForm.model.js";
import { TransferForm } from "./models/transferForm.model.js";
import { DischargePaper } from "./models/dischargePaper.model.js";
import { Biomarker } from "./models/biomarker.model.js";
import { LabOrder } from "./models/labOrder.model.js";
import { Drug } from "./models/drug.model.js";
import { Prescription } from "./models/prescription.model.js";
import { MedicineReminder } from "./models/medicineReminder.model.js";
import { DrugReport } from "./models/drugReport.model.js";
import { Invoice } from "./models/invoice.model.js";
import { RevenueReport } from "./models/revenueReport.model.js";
import { Task } from "./models/task.model.js";
import { Assignment } from "./models/assignment.model.js";
import { PeerReview } from "./models/peerReview.model.js";
import { Announcement } from "./models/announcement.model.js";
import { Notification } from "./models/notification.model.js";
import { SupportTicket } from "./models/supportTicket.model.js";
import { Dataset } from "./models/dataset.model.js";
import { AuditLog } from "./models/auditLog.model.js";
import { ImagingResult } from "./models/imagingResult.model.js";
import { DicomStudy } from "./models/dicomStudy.model.js";
import { DicomSeries } from "./models/dicomSeries.model.js";
import { AiJob } from "./models/aiJob.model.js";

import { connectDB } from "./config/db.js";
import { tenantStorage } from "./middlewares/tenant.middleware.js";

dotenv.config();

const seedComprehensiveDatabase = async () => {
  return tenantStorage.run({ bypassTenancy: true, isSuperAdmin: true }, async () => {
    try {
      console.log("================================================================================");
      console.log("🚀 STARTING COMPREHENSIVE FULL DATABASE SEEDING (EXCLUDING MRI IMAGE SLICES)");
      console.log("================================================================================");

      console.log("🔌 Connecting to database...");
      await connectDB();
      console.log("✅ Successfully connected to database.");

      // ── STEP 1: CLEAN ALL COLLECTIONS TO ENSURE CONSISTENCY ──────────────────
      console.log("\n🧹 Step 1: Cleaning existing collections...");
      await Promise.all([
        Hospital.deleteMany({}),
        User.deleteMany({}),
        PatientProfile.deleteMany({}),
        BhytInfo.deleteMany({}),
        DataPrivacyConsent.deleteMany({}),
        WorkSchedule.deleteMany({}),
        SwapRequest.deleteMany({}),
        HospitalBed.deleteMany({}),
        MriRoom.deleteMany({}),
        MriSlot.deleteMany({}),
        Visit.deleteMany({}),
        EmergencyAlert.deleteMany({}),
        VitalSign.deleteMany({}),
        CareSheet.deleteMany({}),
        MedicalRecord.deleteMany({}),
        EMRVersion.deleteMany({}),
        Consultation.deleteMany({}),
        ConsentForm.deleteMany({}),
        TransferForm.deleteMany({}),
        DischargePaper.deleteMany({}),
        Biomarker.deleteMany({}),
        LabOrder.deleteMany({}),
        Drug.deleteMany({}),
        Prescription.deleteMany({}),
        MedicineReminder.deleteMany({}),
        DrugReport.deleteMany({}),
        Invoice.deleteMany({}),
        RevenueReport.deleteMany({}),
        Task.deleteMany({}),
        Assignment.deleteMany({}),
        PeerReview.deleteMany({}),
        Announcement.deleteMany({}),
        Notification.deleteMany({}),
        SupportTicket.deleteMany({}),
        Dataset.deleteMany({}),
        AuditLog.deleteMany({}),
        ImagingResult.deleteMany({}),
        // MRI Image & AI collections explicitly cleared and kept empty per user request
        DicomStudy.deleteMany({}),
        DicomSeries.deleteMany({}),
        AiJob.deleteMany({}),
      ]);
      console.log("✅ Cleaned 40 collections cleanly.");

      // ── STEP 2: CREATE HOSPITALS ─────────────────────────────────────────────
      console.log("\n🏥 Step 2: Seeding Hospitals...");
      const hospitalBvbm = await Hospital.create({
        name: "Bệnh viện Bạch Mai",
        nameShort: "Bạch Mai",
        code: "BVBM",
        address: {
          street: "78 Giải Phóng",
          ward: "Phương Mai",
          district: "Đống Đa",
          province: "Hà Nội",
        },
        phone: "+842438693731",
        contactEmail: "contact@bachmai.gov.vn",
        website: "bachmai.gov.vn",
        status: "active",
        pricing: {
          examFee: 150000,
          mriFee: 1500000,
          aiFee: 200000,
          maxPatients: 2000,
        },
        isActive: true,
      });

      const hospitalBvcr = await Hospital.create({
        name: "Bệnh viện Chợ Rẫy",
        nameShort: "Chợ Rẫy",
        code: "BVCR",
        address: {
          street: "201B Nguyễn Chí Thanh",
          ward: "Phường 12",
          district: "Quận 5",
          province: "Hồ Chí Minh",
        },
        phone: "+842838554137",
        contactEmail: "contact@choray.vn",
        website: "choray.vn",
        status: "active",
        pricing: {
          examFee: 180000,
          mriFee: 1600000,
          aiFee: 220000,
          maxPatients: 2500,
        },
        isActive: true,
      });
      console.log(`✅ Seeded 2 Hospitals: ${hospitalBvbm.name} (BVBM) & ${hospitalBvcr.name} (BVCR).`);

      const hospital = hospitalBvbm; // Main hospital context

      // ── STEP 3: CREATE USERS (7 ROLES, 3 PER ROLE) ───────────────────────────
      console.log("\n👥 Step 3: Seeding Users (7 roles, exactly 3 accounts each, password: '123456')...");
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash("123456", salt);

      const mockUsers = [
        // 1. ADMIN (System Admin)
        {
          email: "admin@neuroscan.com",
          phone: "+84999999991",
          passwordHash,
          role: "admin",
          departmentId: "KUTN",
          isVerified: true,
          profile: { name: "KS. Huy Hoàng (Quản trị Hệ thống HIS/PACS)", address: "Hà Nội", specialty: "it_admin" },
        },
        {
          email: "admin2@neuroscan.com",
          phone: "+84999999994",
          passwordHash,
          role: "admin",
          departmentId: "KUTN",
          isVerified: true,
          profile: { name: "KS. Đại Nghĩa (Bảo mật Y tế & Hạ tầng Mạng)", address: "Hà Nội", specialty: "security_admin" },
        },
        {
          email: "admin3@neuroscan.com",
          phone: "+84999999995",
          passwordHash,
          role: "admin",
          departmentId: "KUTN",
          isVerified: true,
          profile: { name: "KS. Minh Trí (Quản trị AI & Dữ liệu EMR)", address: "Hà Nội", specialty: "ai_engineer" },
        },

        // 2. HOSPITAL_ADMIN (Lãnh đạo Bệnh viện & Khoa)
        {
          email: "admin.bvbm@neuroscan.com",
          phone: "+84999999111",
          passwordHash,
          role: "hospital_admin",
          hospitalId: hospitalBvbm._id,
          departmentId: "KUTN",
          isVerified: true,
          profile: { name: "PGS.TS Vũ Đình Hoàng (Giám đốc Điều hành Khối Thần kinh BVBM)", address: "Hà Nội", specialty: "hospital_director" },
        },
        {
          email: "hospital_admin2@neuroscan.com",
          phone: "+84999999112",
          passwordHash,
          role: "hospital_admin",
          hospitalId: hospitalBvbm._id,
          departmentId: "KUTN",
          isVerified: true,
          profile: { name: "ThS.BS Nguyễn Bích Thủy (Trưởng phòng Kế hoạch Tổng hợp & QLCL)", address: "Hà Nội", specialty: "medical_affairs" },
        },
        {
          email: "admin.bvcr@neuroscan.com",
          phone: "+84999999222",
          passwordHash,
          role: "hospital_admin",
          hospitalId: hospitalBvcr._id,
          departmentId: "KUTN",
          isVerified: true,
          profile: { name: "TS.BS Lê Quốc Tuấn (Phó Giám đốc Bệnh viện Chợ Rẫy)", address: "TP. Hồ Chí Minh", specialty: "hospital_director" },
        },

        // 3. DOCTOR (Bác sĩ Chuyên khoa Ung Thư Não & Thần Kinh)
        {
          email: "doctor@neuroscan.com",
          phone: "+84999999992",
          passwordHash,
          role: "doctor",
          hospitalId: hospital._id,
          departmentId: "KUTN-SURG",
          isVerified: true,
          profile: { name: "TS.BS.CKII Nguyễn Gia Huy (Trưởng khoa Ngoại Thần Kinh)", medicalId: "BS-001", address: "Hà Nội", specialty: "neurosurgeon" },
        },
        {
          email: "doctor2@neuroscan.com",
          phone: "+84999999996",
          passwordHash,
          role: "doctor",
          hospitalId: hospital._id,
          departmentId: "KUTN-CHEMO",
          isVerified: true,
          profile: { name: "ThS.BS Trần Khánh An (Phó khoa - Ung Thư Thần Kinh & Hóa Xạ Trị)", medicalId: "BS-002", address: "Hà Nội", specialty: "neuro_oncologist" },
        },
        {
          email: "doctor3@neuroscan.com",
          phone: "+84999999997",
          passwordHash,
          role: "doctor",
          hospitalId: hospital._id,
          departmentId: "KCDHA",
          isVerified: true,
          profile: { name: "BS.CKI Phạm Thanh Hải (Bác sĩ Chẩn đoán Hình ảnh Thần kinh & MRI)", medicalId: "BS-003", address: "Hà Nội", specialty: "neuroradiologist" },
        },

        // 4. NURSE (Điều dưỡng Hồi sức & Chăm sóc U Não)
        {
          email: "nurse@neuroscan.com",
          phone: "+84888888884",
          passwordHash,
          role: "nurse",
          hospitalId: hospital._id,
          departmentId: "KUTN-ICU",
          isVerified: true,
          profile: { name: "ĐD.CKI Lê Thị Hoa (Điều dưỡng Trưởng Khoa Ung Thư Não)", medicalId: "DD-001", address: "Hà Nội", specialty: "neuro_icu_nurse" },
        },
        {
          email: "nurse2@neuroscan.com",
          phone: "+84888888887",
          passwordHash,
          role: "nurse",
          hospitalId: hospital._id,
          departmentId: "KUTN-CHEMO",
          isVerified: true,
          profile: { name: "CNĐD Nguyễn Thị Bình (Điều dưỡng Chăm sóc Hóa trị U Não)", medicalId: "DD-002", address: "Hà Nội", specialty: "oncology_nurse" },
        },
        {
          email: "nurse3@neuroscan.com",
          phone: "+84888888888",
          passwordHash,
          role: "nurse",
          hospitalId: hospital._id,
          departmentId: "KUTN-SURG",
          isVerified: true,
          profile: { name: "CNĐD Phạm Văn Cường (Điều dưỡng Hồi tỉnh Sau Phẫu thuật Mở Sọ)", medicalId: "DD-003", address: "Hà Nội", specialty: "surgical_nurse" },
        },

        // 5. TECHNICIAN (Kỹ thuật viên Vận hành Máy MRI 3.0T)
        {
          email: "technician@neuroscan.com",
          phone: "+84888888885",
          passwordHash,
          role: "technician",
          hospitalId: hospital._id,
          departmentId: "KCDHA",
          isVerified: true,
          profile: { name: "KTV.CKI Nguyễn Văn Nam (Kỹ thuật viên Trưởng Máy MRI 3.0T)", medicalId: "KTV-001", address: "Hà Nội", specialty: "mri_technician" },
        },
        {
          email: "technician2@neuroscan.com",
          phone: "+84888888889",
          passwordHash,
          role: "technician",
          hospitalId: hospital._id,
          departmentId: "KCDHA",
          isVerified: true,
          profile: { name: "KTV Trần Hữu Đạt (KTV Vận hành MRI & Dựng hình 3D)", medicalId: "KTV-002", address: "Hà Nội", specialty: "mri_technician" },
        },
        {
          email: "technician3@neuroscan.com",
          phone: "+84888888890",
          passwordHash,
          role: "technician",
          hospitalId: hospital._id,
          departmentId: "KUTN-CHEMO",
          isVerified: true,
          profile: { name: "KTV Lê Hoàng Long (KTV Mô phỏng Xạ trị Thần kinh)", medicalId: "KTV-003", address: "Hà Nội", specialty: "radiation_technician" },
        },

        // 6. RECEPTIONIST (Nhân viên Tiếp đón & Thu ngân Viện phí)
        {
          email: "receptionist@neuroscan.com",
          phone: "+84888888886",
          passwordHash,
          role: "receptionist",
          hospitalId: hospital._id,
          departmentId: "KUTN-CLI",
          isVerified: true,
          profile: { name: "Trần Mai (Điều phối viên Tiếp đón & Đăng ký Khám)", medicalId: "NV-001", address: "Hà Nội", specialty: "receptionist" },
        },
        {
          email: "receptionist2@neuroscan.com",
          phone: "+84888888891",
          passwordHash,
          role: "receptionist",
          hospitalId: hospital._id,
          departmentId: "KUTN-CLI",
          isVerified: true,
          profile: { name: "Ngô Thị Tuyết (Chuyên viên Phân luồng Cấp cứu & BHYT)", medicalId: "NV-002", address: "Hà Nội", specialty: "receptionist" },
        },
        {
          email: "receptionist3@neuroscan.com",
          phone: "+84888888892",
          passwordHash,
          role: "receptionist",
          hospitalId: hospital._id,
          departmentId: "KUTN-CLI",
          isVerified: true,
          profile: { name: "Phan Anh Tuấn (Điều phối viên Chuyển tuyến & Viện phí)", medicalId: "NV-003", address: "Hà Nội", specialty: "receptionist" },
        },

        // 7. PATIENT (Bệnh nhân U Não)
        {
          email: "patient@neuroscan.com",
          phone: "+84901111111",
          passwordHash,
          role: "patient",
          hospitalId: hospital._id,
          isVerified: true,
          profile: {
            name: "Bệnh nhân Tuấn Thành (U Màng Não)",
            bhytNumber: "DN4797932200123",
            medicalId: "BN001",
            address: "291 Nguyễn Văn Linh, Đà Nẵng",
          },
        },
        {
          email: "patient2@neuroscan.com",
          phone: "+84902222222",
          passwordHash,
          role: "patient",
          hospitalId: hospital._id,
          isVerified: true,
          profile: {
            name: "Bệnh nhân Minh Hằng (Glioblastoma Phù Não)",
            bhytNumber: "HN4797932200456",
            medicalId: "BN002",
            address: "Hoàn Kiếm, Hà Nội",
          },
        },
        {
          email: "patient3@neuroscan.com",
          phone: "+84903333333",
          passwordHash,
          role: "patient",
          hospitalId: hospital._id,
          isVerified: true,
          profile: {
            name: "Bệnh nhân Quốc Bảo (U Tuyến Yên)",
            bhytNumber: "SG4797932200789",
            medicalId: "BN003",
            address: "Quận 1, TP. Hồ Chí Minh",
          },
        },
      ];

      const users = await User.insertMany(mockUsers);
      console.log(`✅ Seeded ${users.length} Users successfully across all 7 roles.`);

      // Quick access helpers
      const pat1 = users.find((u) => u.email === "patient@neuroscan.com");
      const pat2 = users.find((u) => u.email === "patient2@neuroscan.com");
      const pat3 = users.find((u) => u.email === "patient3@neuroscan.com");

      const doc1 = users.find((u) => u.email === "doctor@neuroscan.com");
      const doc2 = users.find((u) => u.email === "doctor2@neuroscan.com");
      const doc3 = users.find((u) => u.email === "doctor3@neuroscan.com");

      const nurse1 = users.find((u) => u.email === "nurse@neuroscan.com");
      const nurse2 = users.find((u) => u.email === "nurse2@neuroscan.com");
      const nurse3 = users.find((u) => u.email === "nurse3@neuroscan.com");

      const tech1 = users.find((u) => u.email === "technician@neuroscan.com");
      const tech2 = users.find((u) => u.email === "technician2@neuroscan.com");
      const tech3 = users.find((u) => u.email === "technician3@neuroscan.com");

      const recep1 = users.find((u) => u.email === "receptionist@neuroscan.com");

      // ── STEP 4: PATIENT PROFILES ─────────────────────────────────────────────
      console.log("\n📄 Step 4: Seeding Patient Profiles...");
      await PatientProfile.insertMany([
        {
          hospitalId: hospital._id,
          userId: pat1._id,
          gender: "nam",
          phone: "0901111111",
          address: "Hải Châu, Đà Nẵng",
          dateOfBirth: new Date("1980-05-15"),
        },
        {
          hospitalId: hospital._id,
          userId: pat2._id,
          gender: "nu",
          phone: "0902222222",
          address: "Hoàn Kiếm, Hà Nội",
          dateOfBirth: new Date("1974-08-22"),
        },
        {
          hospitalId: hospital._id,
          userId: pat3._id,
          gender: "nam",
          phone: "0903333333",
          address: "Quận 1, TP. Hồ Chí Minh",
          dateOfBirth: new Date("1988-11-09"),
        },
      ]);
      console.log("✅ Seeded Patient Profiles.");

      // ── STEP 5: BHYT INFO & DATA PRIVACY CONSENT ─────────────────────────────
      console.log("\n🛡️ Step 5: Seeding BHYT & Data Privacy Consent (Luật 91/2025/QH15)...");
      const now = new Date();

      await BhytInfo.insertMany([
        {
          hospitalId: hospital._id,
          patientId: pat1._id,
          cardNumber: "DN4797932200123",
          coverageRate: 80,
          expiresAt: new Date(now.getTime() + 365 * 24 * 3600000),
          registrationPlace: "Bệnh viện Đà Nẵng",
          patientName: pat1.profile.name,
          isValid: true,
          verifiedAt: now,
          annualCap: 72000000,
          usedThisYear: 18500000,
          isOutOfNetwork: false,
          treatmentType: "inpatient",
          hasTransferForm: true,
          priorAuthorizations: [
            {
              drugCode: "TEMOZOLOMIDE",
              approvalNumber: "HD-BVBM-2026/088",
              approvedAt: now,
              expiresAt: new Date(now.getTime() + 180 * 24 * 3600000),
              indications: ["U màng não tái phát", "Phác đồ hóa xạ đồng thời"],
            },
          ],
        },
        {
          hospitalId: hospital._id,
          patientId: pat2._id,
          cardNumber: "HN4797932200456",
          coverageRate: 95,
          expiresAt: new Date(now.getTime() + 300 * 24 * 3600000),
          registrationPlace: "Bệnh viện Bạch Mai",
          patientName: pat2.profile.name,
          isValid: true,
          verifiedAt: now,
          annualCap: 72000000,
          usedThisYear: 42000000,
          isOutOfNetwork: false,
          treatmentType: "inpatient",
          hasTransferForm: true,
          priorAuthorizations: [
            {
              drugCode: "BEVACIZUMAB",
              approvalNumber: "HD-BVBM-2026/102",
              approvedAt: now,
              expiresAt: new Date(now.getTime() + 180 * 24 * 3600000),
              indications: ["Glioblastoma đa hình kháng Temozolomide"],
            },
          ],
        },
        {
          hospitalId: hospital._id,
          patientId: pat3._id,
          cardNumber: "SG4797932200789",
          coverageRate: 80,
          expiresAt: new Date(now.getTime() + 200 * 24 * 3600000),
          registrationPlace: "Bệnh viện Chợ Rẫy",
          patientName: pat3.profile.name,
          isValid: true,
          verifiedAt: now,
          annualCap: 72000000,
          usedThisYear: 8200000,
          isOutOfNetwork: true,
          treatmentType: "outpatient",
          hasTransferForm: false,
        },
      ]);

      await DataPrivacyConsent.insertMany([
        {
          hospitalId: hospital._id,
          patientId: pat1._id,
          medicalId: "BN001",
          purposes: {
            medicalCareAndEmr: true,
            aiAssistedAnalysis: true,
            scientificResearchAnonymized: true,
            cloudStorageBackup: true,
          },
          consentStatus: "granted",
          signerName: pat1.profile.name,
          signerNationalId: "048080001234",
          signerRelationship: "Bản thân",
          signedAt: now,
        },
        {
          hospitalId: hospital._id,
          patientId: pat2._id,
          medicalId: "BN002",
          purposes: {
            medicalCareAndEmr: true,
            aiAssistedAnalysis: true,
            scientificResearchAnonymized: false,
            cloudStorageBackup: true,
          },
          consentStatus: "granted",
          signerName: pat2.profile.name,
          signerNationalId: "001174005678",
          signerRelationship: "Bản thân",
          signedAt: now,
        },
        {
          hospitalId: hospital._id,
          patientId: pat3._id,
          medicalId: "BN003",
          purposes: {
            medicalCareAndEmr: true,
            aiAssistedAnalysis: true,
            scientificResearchAnonymized: true,
            cloudStorageBackup: true,
          },
          consentStatus: "granted",
          signerName: pat3.profile.name,
          signerNationalId: "079088009999",
          signerRelationship: "Bản thân",
          signedAt: now,
        },
      ]);
      console.log("✅ Seeded BHYT Info & Data Privacy Consents.");

      // ── STEP 6: BIOMARKERS CATALOG ───────────────────────────────────────────
      console.log("\n🧪 Step 6: Seeding Biomarkers Catalog (Standard HOA_SINH & HUYET_HOC)...");
      const BIOMARKERS_DATA = [
        { code: "WBC", name: "Bạch Cầu (WBC)", category: "HUYET_HOC", unit: "10^9/L", reference_range: { male: { min: 4.0, max: 10.0 }, female: { min: 4.0, max: 10.0 } } },
        { code: "RBC", name: "Hồng Cầu (RBC)", category: "HUYET_HOC", unit: "10^12/L", reference_range: { male: { min: 4.2, max: 5.4 }, female: { min: 3.8, max: 5.0 } } },
        { code: "HGB", name: "Huyết Sắc Tố (HGB)", category: "HUYET_HOC", unit: "g/L", reference_range: { male: { min: 130, max: 180 }, female: { min: 120, max: 160 } } },
        { code: "HCT", name: "Hematocrit (HCT)", category: "HUYET_HOC", unit: "%", reference_range: { male: { min: 38, max: 55 }, female: { min: 35, max: 49 } } },
        { code: "PLT", name: "Tiểu Cầu (PLT)", category: "HUYET_HOC", unit: "10^9/L", reference_range: { male: { min: 150, max: 400 }, female: { min: 150, max: 400 } } },
        { code: "PT_SEC", name: "Thời gian Prothrombin (PT)", category: "HUYET_HOC", unit: "giây", reference_range: { male: { min: 11, max: 14 }, female: { min: 11, max: 14 } } },
        { code: "INR", name: "Chỉ số INR", category: "HUYET_HOC", unit: "INR", reference_range: { male: { min: 0.8, max: 1.2 }, female: { min: 0.8, max: 1.2 } } },
        { code: "GLU", name: "Glucose Máu", category: "HOA_SINH", unit: "mmol/L", reference_range: { male: { min: 3.9, max: 6.4 }, female: { min: 3.9, max: 6.4 } } },
        { code: "UREA", name: "Urê (Thận)", category: "HOA_SINH", unit: "mmol/L", reference_range: { male: { min: 2.5, max: 7.5 }, female: { min: 2.5, max: 7.5 } } },
        { code: "CRE", name: "Creatinine Máu", category: "HOA_SINH", unit: "umol/L", reference_range: { male: { min: 62, max: 106 }, female: { min: 44, max: 80 } } },
        { code: "AST", name: "AST/GOT (Gan)", category: "HOA_SINH", unit: "U/L", reference_range: { male: { min: 0, max: 40 }, female: { min: 0, max: 32 } } },
        { code: "ALT", name: "ALT/GPT (Gan)", category: "HOA_SINH", unit: "U/L", reference_range: { male: { min: 0, max: 41 }, female: { min: 0, max: 33 } } },
        { code: "NA", name: "Natri (Na+)", category: "HOA_SINH", unit: "mmol/L", reference_range: { male: { min: 135, max: 145 }, female: { min: 135, max: 145 } } },
        { code: "K", name: "Kali (K+)", category: "HOA_SINH", unit: "mmol/L", reference_range: { male: { min: 3.5, max: 5.0 }, female: { min: 3.5, max: 5.0 } } },
        { code: "CL", name: "Clo (Cl-)", category: "HOA_SINH", unit: "mmol/L", reference_range: { male: { min: 98, max: 106 }, female: { min: 98, max: 106 } } },
        { code: "CSF_PROT", name: "Protein Dịch Não Tủy", category: "HOA_SINH", unit: "mg/dL", reference_range: { male: { min: 15, max: 45 }, female: { min: 15, max: 45 } } },
        { code: "CSF_GLU", name: "Glucose Dịch Não Tủy", category: "HOA_SINH", unit: "mmol/L", reference_range: { male: { min: 2.2, max: 3.9 }, female: { min: 2.2, max: 3.9 } } },
        { code: "IDH1_MUT", name: "Đột biến gen IDH1 (R132H)", category: "HOA_SINH", unit: "kết quả", reference_range: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } } },
        { code: "MGMT_METH", name: "Methyl hóa promoter MGMT", category: "HOA_SINH", unit: "%", reference_range: { male: { min: 0, max: 100 }, female: { min: 0, max: 100 } } },
        { code: "KI67_INDEX", name: "Chỉ số tăng sinh Ki-67", category: "HOA_SINH", unit: "%", reference_range: { male: { min: 0, max: 5 }, female: { min: 0, max: 5 } } },
      ];
      await Biomarker.insertMany(BIOMARKERS_DATA);
      console.log(`✅ Seeded ${BIOMARKERS_DATA.length} Biomarkers successfully.`);

      // ── STEP 7: PHARMACY INVENTORY & DRUGS ───────────────────────────────────
      console.log("\n💊 Step 7: Seeding Pharmacy Drugs (15+ neuro drugs & oncology)...");
      const drugsData = [
        {
          hospitalId: hospital._id,
          name: "Depakine Chrono 500mg",
          activeIngredient: "Sodium Valproate",
          category: "anticonvulsant",
          manufacturer: "Sanofi",
          dosageInstructions: "Uống 1 viên/lần, 2 lần/ngày sau ăn. Không bẻ viên thuốc.",
          stock: { quantity: 1200, unit: "Viên", minStock: 200 },
          price: 5200,
          expiryDate: new Date("2028-06-30"),
          interactions: ["Lamotrigine", "Carbamazepine", "Aspirin"],
          isActive: true,
        },
        {
          hospitalId: hospital._id,
          name: "Tegretol 200mg",
          activeIngredient: "Carbamazepine",
          category: "anticonvulsant",
          manufacturer: "Novartis",
          dosageInstructions: "Uống 1 viên/lần x 2 lần/ngày, tăng liều dần theo chỉ định.",
          stock: { quantity: 180, unit: "Viên", minStock: 200 },
          price: 3500,
          expiryDate: new Date("2027-10-15"),
          interactions: ["Sodium Valproate", "Phenobarbital"],
          isActive: true,
        },
        {
          hospitalId: hospital._id,
          name: "Keppra 500mg",
          activeIngredient: "Levetiracetam",
          category: "anticonvulsant",
          manufacturer: "UCB Pharma",
          dosageInstructions: "Uống 1 viên mỗi 12 giờ. Thuốc chống động kinh thế hệ mới ít tương tác gan.",
          stock: { quantity: 850, unit: "Viên", minStock: 100 },
          price: 18500,
          expiryDate: new Date("2028-12-31"),
          interactions: [],
          isActive: true,
        },
        {
          hospitalId: hospital._id,
          name: "Medrol 16mg",
          activeIngredient: "Methylprednisolone",
          category: "corticosteroid",
          manufacturer: "Pfizer",
          dosageInstructions: "Uống 1 viên vào 8h sáng sau ăn no để chống phù não.",
          stock: { quantity: 600, unit: "Viên", minStock: 100 },
          price: 9000,
          expiryDate: new Date("2027-11-20"),
          interactions: ["NSAIDs", "Ketoconazole"],
          isActive: true,
        },
        {
          hospitalId: hospital._id,
          name: "Dexamethasone 4mg/1ml",
          activeIngredient: "Dexamethasone Sodium Phosphate",
          category: "anti_edema",
          manufacturer: "Vĩnh Phúc",
          dosageInstructions: "Tiêm tĩnh mạch chậm 4mg - 8mg mỗi 6 giờ trong cấp cứu phù não quanh u.",
          stock: { quantity: 450, unit: "Ống", minStock: 50 },
          price: 12000,
          expiryDate: new Date("2027-08-30"),
          interactions: ["Phenytoin", "Rifampicin"],
          isActive: true,
        },
        {
          hospitalId: hospital._id,
          name: "Temodal 100mg (Temozolomide)",
          activeIngredient: "Temozolomide",
          category: "chemotherapy",
          manufacturer: "MSD / Schering-Plough",
          dosageInstructions: "Uống 150mg/m2 khi đói, 1 giờ trước xạ trị (Phác đồ Stupp u thần kinh đệm).",
          stock: { quantity: 240, unit: "Viên", minStock: 30 },
          price: 780000,
          expiryDate: new Date("2028-12-31"),
          interactions: ["Valproate"],
          isActive: true,
        },
        {
          hospitalId: hospital._id,
          name: "Temodal 250mg (Temozolomide)",
          activeIngredient: "Temozolomide",
          category: "chemotherapy",
          manufacturer: "MSD / Schering-Plough",
          dosageInstructions: "Uống 200mg/m2/ngày khi đói x 5 ngày của chu kỳ 28 ngày duy trì.",
          stock: { quantity: 95, unit: "Viên", minStock: 20 },
          price: 1950000,
          expiryDate: new Date("2028-12-31"),
          interactions: ["Valproate"],
          isActive: true,
        },
        {
          hospitalId: hospital._id,
          name: "Dotarem 15ml (Thuốc cản từ MRI)",
          activeIngredient: "Gadoterate Meglumine",
          category: "other",
          manufacturer: "Guerbet",
          dosageInstructions: "Tiêm tĩnh mạch 0.1 mmol/kg trước khi quét chuỗi xung T1 tăng cản từ.",
          stock: { quantity: 180, unit: "Lọ", minStock: 40 },
          price: 850000,
          expiryDate: new Date("2027-05-30"),
          interactions: [],
          isActive: true,
        },
        {
          hospitalId: hospital._id,
          name: "Mannitol 20% 250ml",
          activeIngredient: "Mannitol",
          category: "anti_edema",
          manufacturer: "B.Braun",
          dosageInstructions: "Truyền tĩnh mạch nhanh 250ml trong 30 phút hạ áp lực nội sọ cấp.",
          stock: { quantity: 300, unit: "Chai", minStock: 50 },
          price: 45000,
          expiryDate: new Date("2027-09-15"),
          interactions: [],
          isActive: true,
        },
        {
          hospitalId: hospital._id,
          name: "Paracetamol 500mg",
          activeIngredient: "Paracetamol",
          category: "pain_reliever",
          manufacturer: "Dược Hậu Giang",
          dosageInstructions: "Uống 1-2 viên mỗi 4-6 giờ khi đau đầu hoặc sốt > 38.5C.",
          stock: { quantity: 3000, unit: "Viên", minStock: 300 },
          price: 1200,
          expiryDate: new Date("2028-12-31"),
          interactions: ["Rượu"],
          isActive: true,
        },
      ];
      const seededDrugs = await Drug.insertMany(drugsData);
      console.log(`✅ Seeded ${seededDrugs.length} Drugs.`);

      // ── STEP 8: MRI ROOMS & SLOTS (FACILITY INFRASTRUCTURE) ───────────────────
      console.log("\n🧲 Step 8: Seeding MRI Rooms & Scheduling Slots...");
      const mriRoom1 = await MriRoom.create({
        hospitalId: hospital._id,
        name: "Phòng MRI 1 (Khu CĐHA Thường quy)",
        modelMachine: "Siemens MAGNETOM Vida 3.0T Biomatrix",
        location: "Tầng B1 - Tòa nhà Kỹ thuật cao",
        status: "active",
        maxSlotsPerDay: 20,
        slotDurationMinutes: 30,
        operatingHours: { start: "07:00", end: "17:00" },
        notes: "Chuyên chụp MRI sọ não, khuếch tán DWI, tưới máu não PWI, phổ cộng hưởng MRS.",
      });

      const mriRoom2 = await MriRoom.create({
        hospitalId: hospital._id,
        name: "Phòng MRI 2 (Cấp Cứu Thần Kinh)",
        modelMachine: "GE SIGNA Pioneer 3.0T AIR Edition",
        location: "Tầng 1 - Khu Cấp cứu Đột quỵ & U não",
        status: "active",
        maxSlotsPerDay: 16,
        slotDurationMinutes: 30,
        operatingHours: { start: "00:00", end: "24:00" },
        notes: "Phòng chụp ưu tiên cấp cứu tụt não, xuất huyết u não, theo dõi áp lực nội sọ.",
      });

      const mriRoom3 = await MriRoom.create({
        hospitalId: hospital._id,
        name: "Phòng MRI 3 (Tầm Soát Khám Theo Yêu Cầu)",
        modelMachine: "Philips Ingenia Ambition 1.5T",
        location: "Tầng 2 - Khu Khám VIP",
        status: "active",
        maxSlotsPerDay: 14,
        slotDurationMinutes: 35,
        operatingHours: { start: "07:30", end: "16:30" },
        notes: "Tầm soát u não sớm, đau nửa đầu mạn tính, sa sút trí tuệ.",
      });

      // Generate Slots across the rooms
      const slotTimes = [
        { h: 7, m: 30 }, { h: 8, m: 15 }, { h: 9, m: 0 }, { h: 9, m: 45 },
        { h: 10, m: 30 }, { h: 13, m: 30 }, { h: 14, m: 15 }, { h: 15, m: 0 }, { h: 15, m: 45 }
      ];

      const slotsToInsert = [];
      slotTimes.forEach((t, idx) => {
        const startTime = new Date(now);
        startTime.setHours(t.h, t.m, 0, 0);
        const endTime = new Date(startTime.getTime() + 30 * 60000);

        // Room 1 slots
        slotsToInsert.push({
          hospitalId: hospital._id,
          roomId: mriRoom1._id,
          technicianId: tech1._id,
          startTime,
          endTime,
          status: idx === 0 ? "completed" : idx === 1 ? "in_progress" : idx === 2 ? "booked" : "available",
          patientId: idx <= 2 ? (idx === 0 ? pat1._id : idx === 1 ? pat2._id : pat3._id) : null,
          priority: idx === 1 ? 1 : 5,
          notes: idx === 1 ? "Ca cấp cứu theo dõi u phù não cấp" : "Chụp khảo sát thường quy",
        });

        // Room 2 slots
        slotsToInsert.push({
          hospitalId: hospital._id,
          roomId: mriRoom2._id,
          technicianId: tech2._id,
          startTime,
          endTime,
          status: "available",
          priority: 1,
          notes: "Slot dự phòng cấp cứu 24/7",
        });
      });
      await MriSlot.insertMany(slotsToInsert);
      console.log(`✅ Seeded 3 MRI Rooms and ${slotsToInsert.length} MRI Slots.`);

      // ── STEP 9: HOSPITAL BEDS ────────────────────────────────────────────────
      console.log("\n🛏️ Step 9: Seeding Hospital Beds (Neuro-Oncology Units)...");
      await HospitalBed.insertMany([
        // Đơn nguyên Neuro-ICU
        {
          hospitalId: hospital._id,
          departmentId: "KUTN-ICU",
          departmentName: "Khoa Ung Thư Não - Hồi Sức Cấp Cứu (Neuro-ICU)",
          bedNumber: "ICU-01",
          roomNumber: "ICU-Neuro-1",
          floor: "Tầng 2",
          type: "icu_neuro_icp",
          status: "occupied",
          currentPatientId: pat2._id,
          admittedAt: new Date(now.getTime() - 18 * 3600000),
          hasIcpMonitor: true,
          hasEegMonitor: true,
          isIsolationRoom: false,
          notes: "Bệnh nhân Glioblastoma phù não cấp tính đang đo áp lực nội sọ ICP liên tục",
        },
        {
          hospitalId: hospital._id,
          departmentId: "KUTN-ICU",
          departmentName: "Khoa Ung Thư Não - Hồi Sức Cấp Cứu (Neuro-ICU)",
          bedNumber: "ICU-02",
          roomNumber: "ICU-Neuro-1",
          floor: "Tầng 2",
          type: "icu_neuro_eeg",
          status: "available",
          hasIcpMonitor: true,
          hasEegMonitor: true,
          isIsolationRoom: false,
          notes: "Giường hồi sức u não có máy đo điện não liên tục phát hiện co giật",
        },
        {
          hospitalId: hospital._id,
          departmentId: "KUTN-ICU",
          departmentName: "Khoa Ung Thư Não - Hồi Sức Cấp Cứu (Neuro-ICU)",
          bedNumber: "ICU-03",
          roomNumber: "ICU-Neuro-2",
          floor: "Tầng 2",
          type: "icu_standard",
          status: "available",
          hasIcpMonitor: false,
          hasEegMonitor: false,
          isIsolationRoom: false,
          notes: "Giường cấp cứu theo dõi thang điểm Glasgow",
        },

        // Đơn nguyên Phẫu thuật & Hồi tỉnh mở sọ
        {
          hospitalId: hospital._id,
          departmentId: "KUTN-SURG",
          departmentName: "Khoa Ung Thư Não - Hồi Tỉnh Mổ Mở Sọ (Post-Op Craniotomy)",
          bedNumber: "SURG-201",
          roomNumber: "Phòng 201 - Hậu phẫu",
          floor: "Tầng 2",
          type: "post_op_recovery",
          status: "occupied",
          currentPatientId: pat1._id,
          admittedAt: new Date(now.getTime() - 24 * 3600000),
          hasIcpMonitor: false,
          hasEegMonitor: false,
          isIsolationRoom: false,
          notes: "Hậu phẫu ngày thứ 2 mở sọ cắt u màng não thái dương trái (Meningioma)",
        },
        {
          hospitalId: hospital._id,
          departmentId: "KUTN-SURG",
          departmentName: "Khoa Ung Thư Não - Hồi Tỉnh Mổ Mở Sọ (Post-Op Craniotomy)",
          bedNumber: "SURG-202",
          roomNumber: "Phòng 201 - Hậu phẫu",
          floor: "Tầng 2",
          type: "post_op_recovery",
          status: "available",
          hasIcpMonitor: false,
          hasEegMonitor: false,
          isIsolationRoom: false,
          notes: "Theo dõi dẫn lưu não thất ngoài EVD",
        },
        {
          hospitalId: hospital._id,
          departmentId: "KUTN-SURG",
          departmentName: "Khoa Ung Thư Não - Tiền phẫu chuẩn bị mổ",
          bedNumber: "SURG-VIP",
          roomNumber: "Phòng VIP-21",
          floor: "Tầng 2",
          type: "vip",
          status: "available",
          hasIcpMonitor: false,
          hasEegMonitor: false,
          isIsolationRoom: false,
          notes: "Phòng hậu phẫu tiện nghi cao theo yêu cầu",
        },

        // Đơn nguyên Hóa - Xạ trị
        {
          hospitalId: hospital._id,
          departmentId: "KUTN-CHEMO",
          departmentName: "Khoa Ung Thư Não - Đơn nguyên Hóa Trị & Xạ Trị (Phác đồ Stupp)",
          bedNumber: "CHEMO-301",
          roomNumber: "Phòng 301 - Cách ly",
          floor: "Tầng 3",
          type: "isolation",
          status: "reserved",
          reservedForPatientId: pat3._id,
          reservedUntil: new Date(now.getTime() + 6 * 3600000),
          reserveReason: "scheduled_craniotomy",
          hasIcpMonitor: false,
          hasEegMonitor: false,
          isIsolationRoom: true,
          notes: "Cách ly phòng ngừa suy giảm bạch cầu trong đợt truyền hóa chất",
        },
        {
          hospitalId: hospital._id,
          departmentId: "KUTN-CHEMO",
          departmentName: "Khoa Ung Thư Não - Đơn nguyên Hóa Trị & Xạ Trị (Phác đồ Stupp)",
          bedNumber: "CHEMO-302",
          roomNumber: "Phòng 302",
          floor: "Tầng 3",
          type: "standard",
          status: "available",
          hasIcpMonitor: false,
          hasEegMonitor: false,
          isIsolationRoom: false,
          notes: "Uống Temozolomide kết hợp xạ trị gia tốc",
        },

        // Đơn nguyên Chăm sóc giảm nhẹ & Phục hồi chức năng
        {
          hospitalId: hospital._id,
          departmentId: "KUTN-PAL",
          departmentName: "Khoa Ung Thư Não - Chăm Sóc Giảm Nhẹ & Phục Hồi Chức Năng",
          bedNumber: "PAL-401",
          roomNumber: "Phòng 401",
          floor: "Tầng 4",
          type: "standard",
          status: "available",
          hasIcpMonitor: false,
          hasEegMonitor: false,
          isIsolationRoom: false,
          notes: "Kiểm soát đau trung ương và tập phục hồi vận động sau mổ não",
        },
      ]);
      console.log("✅ Seeded Hospital Beds.");

      // ── STEP 10: WORK SCHEDULES & SWAP REQUESTS ──────────────────────────────
      console.log("\n📅 Step 10: Seeding Work Schedules & Swap Requests...");
      const schedules = [];
      const staffList = [
        { u: doc1, role: "doctor" },
        { u: doc2, role: "doctor" },
        { u: doc3, role: "doctor" },
        { u: nurse1, role: "nurse" },
        { u: nurse2, role: "nurse" },
        { u: nurse3, role: "nurse" },
        { u: tech1, role: "technician" },
        { u: tech2, role: "technician" },
      ];

      // Schedule shifts for today and the next 3 days
      for (let dayOffset = 0; dayOffset < 4; dayOffset++) {
        const scheduleDate = new Date(now.getTime() + dayOffset * 24 * 3600000);
        scheduleDate.setHours(0, 0, 0, 0);

        staffList.forEach((st, sIdx) => {
          const shiftType = (sIdx + dayOffset) % 3 === 0 ? "sáng" : (sIdx + dayOffset) % 3 === 1 ? "chiều" : "tối";
          schedules.push({
            hospitalId: hospital._id,
            staffId: st.u._id,
            date: scheduleDate,
            shift: shiftType,
            startTime: shiftType === "sáng" ? "07:00" : shiftType === "chiều" ? "15:00" : "23:00",
            endTime: shiftType === "sáng" ? "15:00" : shiftType === "chiều" ? "23:00" : "07:00",
            role: st.role,
            status: "confirmed",
            notes: `Phân công nhiệm vụ ${st.role} ca ${shiftType} tại Khoa Ung Thư Não`,
          });
        });
      }
      const createdSchedules = await WorkSchedule.insertMany(schedules);

      // Create 1 swap request
      if (createdSchedules.length >= 2) {
        await SwapRequest.create({
          hospitalId: hospital._id,
          requesterId: doc1._id,
          scheduleId: createdSchedules[0]._id,
          targetStaffId: doc2._id,
          targetDate: new Date(now.getTime() + 2 * 24 * 3600000),
          reason: "Bận tham gia Hội chẩn Tumor Board Quốc tế tại Bệnh viện K",
          status: "pending",
        });
      }
      console.log(`✅ Seeded ${createdSchedules.length} Work Schedules & 1 Swap Request.`);

      // ── STEP 11: EMR MEDICAL RECORDS & VERSIONS ──────────────────────────────
      console.log("\n📁 Step 11: Seeding EMR Medical Records & Versions...");
      const medicalRecords = await MedicalRecord.create([
        {
          hospitalId: hospital._id,
          patientId: "BN001",
          patientName: pat1.profile.name,
          gender: "Nam",
          age: 46,
          admissionType: "Nội trú",
          department: "Khoa Ung Thư Não - Phẫu thuật Ngoại Thần Kinh",
          paymentMethod: "BHYT",
          doctorInCharge: doc1.profile.name,
          diagnosis: "U màng não (Meningioma) thùy thái dương trái, độ I theo WHO",
          treatmentPlan: "Phẫu thuật mở sọ bóc tách vi phẫu toàn bộ khối u, kiểm soát co giật bằng Depakine.",
          status: "Đang điều trị",
          signStatus: "Chưa duyệt",
        },
        {
          hospitalId: hospital._id,
          patientId: "BN002",
          patientName: pat2.profile.name,
          gender: "Nữ",
          age: 52,
          admissionType: "Nội trú",
          department: "Khoa Ung Thư Não - Hồi Sức Cấp Cứu (Neuro-ICU)",
          paymentMethod: "BHYT",
          doctorInCharge: doc2.profile.name,
          diagnosis: "U nguyên bào thần kinh đệm (Glioblastoma đa hình) độ IV, phù não đè sụp não thất",
          treatmentPlan: "Truyền tĩnh mạch Mannitol 20% + Dexamethasone chống phù não, chuẩn bị phẫu thuật giải áp.",
          status: "Đang điều trị",
          signStatus: "Chưa duyệt",
        },
        {
          hospitalId: hospital._id,
          patientId: "BN003",
          patientName: pat3.profile.name,
          gender: "Nam",
          age: 38,
          admissionType: "Ngoại trú",
          department: "Khoa Ung Thư Não - Khám Chuyên Khoa Theo Yêu Cầu",
          paymentMethod: "Dịch vụ",
          doctorInCharge: doc3.profile.name,
          diagnosis: "U tuyến yên (Pituitary Adenoma) kích thước 18mm gây mờ mắt bán manh thái dương hai bên",
          treatmentPlan: "Theo dõi thị trường, hội chẩn phẫu thuật nội soi qua xoang bướm lấy u.",
          status: "Xuất viện",
          signStatus: "Đã ký số",
          dischargeDate: new Date(now.getTime() - 3 * 24 * 3600000),
        },
      ]);

      await EMRVersion.create({
        medicalRecordId: medicalRecords[0]._id,
        version: 1,
        modifiedBy: doc1.profile.name,
        modifiedAt: new Date(now.getTime() - 12 * 3600000),
        changes: {
          diagnosis: { old: "Nghi u não", new: "U màng não (Meningioma) thùy thái dương trái" },
        },
      });
      console.log(`✅ Seeded ${medicalRecords.length} EMR Records & 1 EMR Version.`);

      // ── STEP 12: CONSULTATIONS & CONSENT FORMS ────────────────────────────────
      console.log("\n🤝 Step 12: Seeding Consultations (Tumor Board) & Consent Forms...");
      await Consultation.create({
        hospitalId: hospital._id,
        medicalRecordId: medicalRecords[0]._id,
        meetingDate: now,
        participants: [doc1.profile.name, doc2.profile.name, doc3.profile.name, "BSCKII. Lê Văn Lâm (Giải phẫu bệnh)"],
        clinicalSummary: "Bệnh nhân nam 46 tuổi phát hiện khối u thái dương kích thước 32x28mm, tăng tín hiệu đồng đều trên T1 cản từ.",
        diagnosis: "U màng não (Meningioma) thùy thái dương trái, giải phẫu tiếp giáp động mạch não giữa.",
        treatmentConclusion: "Thống nhất mổ mở sọ bóc tách u vi phẫu, bảo tồn nhánh mạch máu lớn. Dự phòng co giật trước mổ.",
      });

      await ConsentForm.create({
        hospitalId: hospital._id,
        medicalRecordId: medicalRecords[0]._id,
        procedureName: "Phẫu thuật mở sọ bóc tách vi phẫu u màng não thùy thái dương trái",
        risks: "Chảy máu nội sọ, phù não, co giật, yếu liệt chi tạm thời, nhiễm trùng khoang màng não.",
        doctorExplanation: "Đã giải thích toàn diện nguy cơ và phác đồ phẫu thuật vi phẫu có định vị thần kinh Neuronavigation.",
        doctorSignature: doc1.profile.name,
        doctorSigned: true,
        patientSignature: pat1.profile.name,
        patientSigned: true,
      });

      await ConsentForm.create({
        hospitalId: hospital._id,
        medicalRecordId: medicalRecords[1]._id,
        procedureName: "Tiêm tĩnh mạch thuốc đối quang từ Gadolinium (Dotarem) chụp MRI 3.0T",
        risks: "Dị ứng thuốc cản từ nhẹ (nổi mẩn, ngứa), phản vệ hiếm gặp, xơ hóa hệ thống thận.",
        doctorExplanation: "Đã kiểm tra chức năng thận bình thường (eGFR > 60). Gia đình đồng ý thực hiện.",
        doctorSignature: doc2.profile.name,
        doctorSigned: true,
        patientSignature: pat2.profile.name,
        patientSigned: true,
      });
      console.log("✅ Seeded Consultations & Consent Forms.");

      // ── STEP 13: TRANSFER FORMS & DISCHARGE PAPERS ───────────────────────────
      console.log("\n🚑 Step 13: Seeding Transfer Forms & Discharge Papers...");
      await TransferForm.create({
        hospitalId: hospitalBvbm._id,
        targetHospitalId: hospitalBvcr._id,
        patient_id: pat3._id,
        doctor_name: doc1.profile.name,
        transferNo: "CV-2026/001",
        hospitalNo: "BVBM-09921",
        transferTo: "Bệnh viện Chợ Rẫy - Trung tâm Ngoại Thần Kinh",
        dateIn: new Date(now.getTime() - 7 * 24 * 3600000),
        dateOut: now,
        clinicalSummary: "Bệnh nhân u tuyến yên kích thước lớn cần can thiệp phẫu thuật nội soi qua xoang bướm.",
        labSummary: "MRI sọ não: Macroadenoma tuyến yên 18mm, chức năng thận bình thường, nội tiết tố Prolactin tăng.",
        diagnosis: "U tuyến yên kích thước lớn (Pituitary Macroadenoma)",
        treatment: "Dopamine agonist, chuyển tuyến điều trị ngoại khoa tại Chợ Rẫy gần nơi cư trú.",
        patientStatus: "Tỉnh táo, huyết áp ổn định, thị lực giảm nhẹ 7/10.",
        reason: "1",
        reasonDetail: "Phù hợp quy định chuyên môn kỹ thuật cao và nguyện vọng bệnh nhân",
        status: "accepted",
        crossHospitalToken: crypto.randomBytes(16).toString("hex"),
        crossHospitalTokenExpiresAt: new Date(now.getTime() + 7 * 24 * 3600000),
      });

      await DischargePaper.create({
        hospitalId: hospital._id,
        patient_id: pat3._id,
        doctor_name: doc3.profile.name,
        dischargeNo: "RV-2026/045",
        hospitalNo: "BVBM-09921",
        dateIn: new Date(now.getTime() - 5 * 24 * 3600000),
        dateOut: now,
        diagnosis: "U tuyến yên đã hoàn tất đánh giá nội tiết và thị trường",
        treatment: "Điều trị nội khoa bảo tồn, hướng dẫn sinh hoạt, chuyển hồ sơ về tuyến cơ sở.",
        note: "Tái khám sau 1 tháng mang theo phim MRI kiểm tra lại.",
      });
      console.log("✅ Seeded Transfer Form & Discharge Paper.");

      // ── STEP 14: VITAL SIGNS & CARE SHEETS ────────────────────────────────────
      console.log("\n💓 Step 14: Seeding Vital Signs & Nurse Care Sheets...");
      await VitalSign.insertMany([
        {
          hospitalId: hospital._id,
          patient_id: pat1._id,
          pulse: 76,
          blood_pressure: { systolic: 120, diastolic: 80 },
          spo2: 99,
          weight: 68,
          height: 172,
          bmi: 23.0,
          recorded_at: new Date(now.getTime() - 6 * 3600000),
        },
        {
          hospitalId: hospital._id,
          patient_id: pat1._id,
          pulse: 78,
          blood_pressure: { systolic: 122, diastolic: 82 },
          spo2: 98,
          weight: 68,
          height: 172,
          bmi: 23.0,
          recorded_at: new Date(now.getTime() - 1 * 3600000),
        },
        {
          hospitalId: hospital._id,
          patient_id: pat2._id,
          pulse: 88,
          blood_pressure: { systolic: 145, diastolic: 92 },
          spo2: 96,
          weight: 54,
          height: 160,
          bmi: 21.1,
          recorded_at: new Date(now.getTime() - 4 * 3600000),
        },
        {
          hospitalId: hospital._id,
          patient_id: pat3._id,
          pulse: 72,
          blood_pressure: { systolic: 118, diastolic: 76 },
          spo2: 99,
          weight: 75,
          height: 178,
          bmi: 23.7,
          recorded_at: new Date(now.getTime() - 2 * 3600000),
        },
      ]);

      await CareSheet.create([
        {
          hospitalId: hospital._id,
          medicalRecordId: medicalRecords[0]._id,
          careLevel: 2,
          pulse: 76,
          bloodPressure: "120/80",
          temperature: 36.8,
          respiratoryRate: 16,
          spo2: 99,
          progressNotes: "Bệnh nhân tỉnh táo, Glasgow 15 điểm. Vết mổ khô ráo, không tụ dịch dưới da đầu.",
          careActions: "Đo huyết áp và mạch 4h/lần, hỗ trợ bệnh nhân ngồi dậy tại giường, cho uống thuốc đúng giờ.",
          nurse: nurse1.profile.name,
        },
        {
          hospitalId: hospital._id,
          medicalRecordId: medicalRecords[1]._id,
          careLevel: 1,
          pulse: 88,
          bloodPressure: "145/92",
          temperature: 37.4,
          respiratoryRate: 20,
          spo2: 96,
          progressNotes: "Bệnh nhân lơ mơ nhẹ, đáp ứng lời nói chậm, Glasgow 13 điểm. Đau đầu vùng chẩm.",
          careActions: "Kê cao đầu giường 30 độ, thở oxy qua gọng kính 2 lít/phút, truyền Mannitol theo y lệnh cấp cứu.",
          nurse: nurse2.profile.name,
        },
      ]);
      console.log("✅ Seeded Vital Signs & Care Sheets.");

      // ── STEP 15: LAB ORDERS ──────────────────────────────────────────────────
      console.log("\n🧪 Step 15: Seeding Lab Orders (Blood & CSF)...");
      await LabOrder.insertMany([
        {
          hospitalId: hospital._id,
          patient_id: pat1._id,
          patient_gender: "Nam",
          barcode: "LH-2601",
          category: "HUYET_HOC",
          status: "COMPLETED",
          ordered_at: new Date(now.getTime() - 10 * 3600000),
          resulted_at: new Date(now.getTime() - 8 * 3600000),
          results: [
            { biomarker_code: "WBC", biomarker_name: "Bạch Cầu (WBC)", value_result: 7.2, unit: "10^9/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "4.0 - 10.0" },
            { biomarker_code: "RBC", biomarker_name: "Hồng Cầu (RBC)", value_result: 4.8, unit: "10^12/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "4.2 - 5.4" },
            { biomarker_code: "HGB", biomarker_name: "Huyết Sắc Tố (HGB)", value_result: 145, unit: "g/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "130 - 180" },
            { biomarker_code: "PLT", biomarker_name: "Tiểu Cầu (PLT)", value_result: 230, unit: "10^9/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "150 - 400" },
          ],
        },
        {
          hospitalId: hospital._id,
          patient_id: pat2._id,
          patient_gender: "Nữ",
          barcode: "HS-2602",
          category: "HOA_SINH",
          status: "COMPLETED",
          ordered_at: new Date(now.getTime() - 6 * 3600000),
          resulted_at: new Date(now.getTime() - 4 * 3600000),
          results: [
            { biomarker_code: "UREA", biomarker_name: "Urê (Thận)", value_result: 5.8, unit: "mmol/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "2.5 - 7.5" },
            { biomarker_code: "CRE", biomarker_name: "Creatinine", value_result: 72, unit: "umol/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "44 - 80" },
            { biomarker_code: "GLU", biomarker_name: "Glucose Đường Huyết", value_result: 7.6, unit: "mmol/L", is_abnormal: true, abnormal_direction: "HIGH", reference_range_display: "3.9 - 6.4" },
            { biomarker_code: "NA", biomarker_name: "Natri (Na+)", value_result: 132, unit: "mmol/L", is_abnormal: true, abnormal_direction: "LOW", reference_range_display: "135 - 145" },
          ],
        },
        {
          hospitalId: hospital._id,
          patient_id: pat1._id,
          patient_gender: "Nam",
          barcode: "PREOP-2603",
          category: "HUYET_HOC",
          status: "PENDING",
          ordered_at: new Date(now.getTime() - 1 * 3600000),
          results: [],
        },
      ]);
      console.log("✅ Seeded Lab Orders.");

      // ── STEP 16: PRESCRIPTIONS & MEDICINE REMINDERS ──────────────────────────
      console.log("\n💊 Step 16: Seeding Prescriptions & Medicine Reminders...");
      const presc1 = await Prescription.create({
        hospitalId: hospital._id,
        patient_id: pat1._id,
        doctor_name: doc1.profile.name,
        diagnosis: "U màng não thùy thái dương, dự phòng co giật",
        drugs: [
          {
            name: "Depakine Chrono 500mg",
            quantity: 28,
            unit: "viên",
            usage: "Uống 1 viên sau ăn sáng, 1 viên sau ăn tối",
            timesPerDay: 2,
            durationDays: 14,
          },
          {
            name: "Paracetamol 500mg",
            quantity: 20,
            unit: "viên",
            usage: "Uống 1 viên khi đau đầu nhiều",
            timesPerDay: 2,
            durationDays: 10,
          },
        ],
        note: "Uống nguyên viên, không bẻ, tái khám sau 2 tuần.",
        clinicalSafety: {
          safetyScore: 98,
          status: "SAFE",
          warnings: [],
        },
      });

      const presc2 = await Prescription.create({
        hospitalId: hospital._id,
        patient_id: pat2._id,
        doctor_name: doc2.profile.name,
        diagnosis: "Glioblastoma phù não cấp",
        drugs: [
          {
            name: "Medrol 16mg",
            quantity: 14,
            unit: "viên",
            usage: "Uống 1 viên vào 8h sáng sau ăn",
            timesPerDay: 1,
            durationDays: 14,
          },
          {
            name: "Keppra 500mg",
            quantity: 28,
            unit: "viên",
            usage: "Uống 1 viên sáng, 1 viên tối",
            timesPerDay: 2,
            durationDays: 14,
          },
        ],
        clinicalSafety: {
          safetyScore: 92,
          status: "SAFE",
          warnings: [],
        },
      });

      await MedicineReminder.insertMany([
        {
          hospitalId: hospital._id,
          patientId: pat1._id,
          prescriptionId: presc1._id,
          drugName: "Depakine Chrono 500mg",
          dosageText: "1 viên sau ăn sáng",
          date: now,
          time: "08:00",
          status: "done",
        },
        {
          hospitalId: hospital._id,
          patientId: pat1._id,
          prescriptionId: presc1._id,
          drugName: "Depakine Chrono 500mg",
          dosageText: "1 viên sau ăn tối",
          date: now,
          time: "19:00",
          status: "pending",
        },
        {
          hospitalId: hospital._id,
          patientId: pat2._id,
          prescriptionId: presc2._id,
          drugName: "Medrol 16mg",
          dosageText: "1 viên vào 08:00 sáng sau ăn no",
          date: now,
          time: "08:00",
          status: "pending",
        },
      ]);

      await DrugReport.create({
        hospitalId: hospital._id,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        items: [
          { drugName: "Depakine Chrono 500mg", unit: "Viên", quantity: 1200, usedCount: 350 },
          { drugName: "Tegretol 200mg", unit: "Viên", quantity: 180, usedCount: 160 },
          { drugName: "Medrol 16mg", unit: "Viên", quantity: 600, usedCount: 220 },
          { drugName: "Temodal 100mg", unit: "Viên", quantity: 240, usedCount: 45 },
        ],
        author: doc1._id,
      });
      console.log("✅ Seeded Prescriptions, Reminders, and Drug Reports.");

      // ── STEP 17: CLINICAL VISITS (MULTIPLE STATES) ───────────────────────────
      console.log("\n🏥 Step 17: Seeding Clinical Visits (Waiting, In-Consult, Awaiting MRI)...");

      // Sample template diagnostic report (text-only metadata, NO physical DICOM images)
      const sampleImagingResult = await ImagingResult.create({
        hospitalId: hospital._id,
        medicalId: "BN001",
        patientName: pat1.profile.name,
        birthYear: 1980,
        gender: "Nam",
        address: "Đà Nẵng",
        orderDate: new Date(now.getTime() - 24 * 3600000),
        orderingDoctor: doc1.profile.name,
        orderingDepartment: "Khoa Ung Thư Não",
        medicalRecordNumber: "MRN-2026-9901",
        diagnosis: "U màng não thùy thái dương trái",
        procedure: "Chụp MRI sọ não 3D đa chuỗi xung có tiêm cản từ",
        technique: "T1W, T2W, FLAIR, DWI, T1+C Gadolinium",
        findings: "Khối u ngoài trục vùng thái dương trái, bắt cản từ mạnh và đồng nhất, có dấu hiệu đuôi màng cứng (dural tail sign), kích thước 32x28mm.",
        conclusion: "Hình ảnh điển hình của U màng não (Meningioma) thùy thái dương trái, chưa có dấu hiệu xâm lấn xương sọ.",
        radiologist: doc3.profile.name,
        reportDate: new Date(now.getTime() - 22 * 3600000),
        images: [], // Kept empty per user requirement: user will upload MRI data
        imagingType: "MRI",
      });

      const visits = await Visit.insertMany([
        // Visit 1: Đang chờ khám lâm sàng
        {
          hospitalId: hospital._id,
          patientId: pat1._id,
          doctorId: doc1._id,
          nurseId: nurse1._id,
          status: "đang chờ",
          priority: "trung bình",
          reason: "Tái khám kiểm tra sau đợt uống thuốc giảm đau đầu",
          date: now,
        },
        // Visit 2: Đang khám lâm sàng
        {
          hospitalId: hospital._id,
          patientId: pat2._id,
          doctorId: doc2._id,
          nurseId: nurse2._id,
          status: "đang khám",
          priority: "khẩn cấp",
          reason: "Đau đầu dữ dội kèm buồn nôn, yếu nhẹ tay phải",
          date: now,
          vitals: {
            pulse: 88,
            bloodPressure: "145/92",
            temperature: 37.4,
            spo2: 96,
            respiratoryRate: 20,
            measuredAt: new Date(now.getTime() - 30 * 60000),
          },
        },
        // Visit 3: CHỜ CHỤP MRI (👉 ĐÂY LÀ ĐIỂM CHỜ NGƯỜI DÙNG TỰ NẠP ẢNH MRI)
        {
          hospitalId: hospital._id,
          patientId: pat3._id,
          doctorId: doc1._id,
          nurseId: nurse1._id,
          technicianId: tech1._id,
          status: "chờ chụp",
          priority: "cao",
          reason: "Chỉ định chụp MRI sọ não cản từ đánh giá u tuyến yên",
          date: now,
          vitals: {
            pulse: 72,
            bloodPressure: "118/76",
            temperature: 36.6,
            spo2: 99,
            respiratoryRate: 16,
            measuredAt: new Date(now.getTime() - 45 * 60000),
          },
          mriOrder: {
            region: "Sọ não",
            brain_region: "Tuyến yên & hố yên",
            instructions: "Chụp MRI sọ não đa chuỗi xung + dựng hình động mạch cảnh 3D TOF-MRA",
            requestAiAnalysis: true,
            orderedAt: new Date(now.getTime() - 20 * 60000),
          },
        },
        // Visit 4: ĐANG CHỤP TRONG PHÒNG MÁY MRI
        {
          hospitalId: hospital._id,
          patientId: pat2._id,
          doctorId: doc2._id,
          nurseId: nurse2._id,
          technicianId: tech2._id,
          status: "đang chụp",
          priority: "khẩn cấp",
          reason: "Khảo sát cấp cứu phù não và thể tích khối u u nguyên bào",
          date: now,
          mriOrder: {
            region: "Sọ não",
            brain_region: "Bán cầu não phải",
            instructions: "Chụp khẩn cấp chuỗi xung DWI & FLAIR kiểm tra phù não",
            requestAiAnalysis: true,
            orderedAt: new Date(now.getTime() - 60 * 60000),
          },
        },
        // Visit 5: CHỜ BÁC SĨ ĐỌC PHIM
        {
          hospitalId: hospital._id,
          patientId: pat1._id,
          doctorId: doc1._id,
          nurseId: nurse1._id,
          technicianId: tech1._id,
          status: "chờ bác sĩ đọc",
          priority: "trung bình",
          reason: "Khảo sát u màng não thái dương",
          date: now,
          mriOrder: {
            region: "Sọ não",
            instructions: "Chụp kiểm tra kích thước khối u sau 6 tháng",
            requestAiAnalysis: true,
            imagingResultId: sampleImagingResult._id,
            orderedAt: new Date(now.getTime() - 2 * 3600000),
          },
        },
        // Visit 6: HOÀN TẤT
        {
          hospitalId: hospital._id,
          patientId: pat3._id,
          doctorId: doc3._id,
          nurseId: nurse3._id,
          status: "hoàn tất",
          priority: "trung bình",
          reason: "Đã hoàn tất khám và kê đơn ngoại trú",
          date: new Date(now.getTime() - 24 * 3600000),
        },
      ]);
      console.log(`✅ Seeded ${visits.length} Clinical Visits with diverse lifecycle states.`);

      // ── STEP 18: TASKS (KANBAN 8-STEP CLINICAL WORKFLOW) ─────────────────────
      console.log("\n📋 Step 18: Seeding Tasks (8-Step Clinical Kanban)...");
      const sampleVisit = visits[2]; // Visit with MRI Order
      const taskSteps = [
        { step: 1, title: "Tiếp đón bệnh nhân & Xác thực BHYT", role: "receptionist", status: "completed", assignedTo: recep1._id },
        { step: 2, title: "Khám lâm sàng thần kinh sơ bộ", role: "doctor", status: "completed", assignedTo: doc1._id },
        { step: 3, title: "Chỉ định chụp MRI sọ não 3.0T", role: "doctor", status: "completed", assignedTo: doc1._id },
        { step: 4, title: "Kỹ thuật viên thực hiện chụp MRI", role: "technician", status: "in_progress", assignedTo: tech1._id },
        { step: 5, title: "Hệ thống AI xử lý phân đoạn tổn thương não", role: "auto", status: "pending", assignedTo: null },
        { step: 6, title: "Bác sĩ CĐHA đọc & phân tích kết quả MRI", role: "doctor", status: "pending", assignedTo: doc3._id },
        { step: 7, title: "Bác sĩ điều trị ký số hồ sơ bệnh án", role: "doctor", status: "pending", assignedTo: doc1._id },
        { step: 8, title: "Thanh toán viện phí & Xuất hóa đơn VietQR", role: "receptionist", status: "pending", assignedTo: recep1._id },
      ];

      await Task.insertMany(
        taskSteps.map((s) => ({
          hospitalId: hospital._id,
          visitId: sampleVisit._id,
          patientId: sampleVisit.patientId,
          stepNumber: s.step,
          title: s.title,
          roleRequired: s.role,
          assignedToUserId: s.assignedTo,
          status: s.status,
          deadlineAt: new Date(now.getTime() + 4 * 3600000),
        }))
      );
      console.log(`✅ Seeded ${taskSteps.length} Kanban Tasks.`);

      // ── STEP 19: ASSIGNMENTS & PEER REVIEWS ──────────────────────────────────
      console.log("\n👨‍⚕️ Step 19: Seeding Assignments & Peer Reviews...");
      await Assignment.insertMany([
        {
          hospitalId: hospital._id,
          visitId: visits[4]._id,
          imagingResultId: sampleImagingResult._id,
          doctorId: doc3._id,
          type: "read",
          status: "pending",
          priority: 3,
          caseloadAtAssignment: 4,
          deadlineAt: new Date(now.getTime() + 2 * 3600000),
        },
        {
          hospitalId: hospital._id,
          visitId: visits[1]._id,
          doctorId: doc2._id,
          type: "treat",
          status: "in_progress",
          priority: 1,
          caseloadAtAssignment: 6,
          deadlineAt: new Date(now.getTime() + 1 * 3600000),
        },
      ]);

      await PeerReview.create({
        hospitalId: hospital._id,
        imagingResultId: sampleImagingResult._id,
        visitId: visits[4]._id,
        requestType: "random_qa",
        conflictReason: "",
        status: "in_review",
        readings: [
          {
            reviewerId: doc1._id,
            conclusion: "Đồng thuận kết luận u màng não thái dương trái lành tính (WHO Grade I).",
            malignancyLevel: "low",
            agreeWithAi: true,
            submittedAt: now,
          },
        ],
        samplingWeek: "2026-W39",
        createdBy: users[0]._id,
      });
      console.log("✅ Seeded Assignments & Peer Reviews.");

      // ── STEP 20: EMERGENCY ALERTS ────────────────────────────────────────────
      console.log("\n🚨 Step 20: Seeding Emergency Alerts (Code Red / Orange)...");
      await EmergencyAlert.create({
        hospitalId: hospital._id,
        visitId: visits[1]._id,
        level: "RED",
        triggeredBy: "manual",
        triggeredByUserId: doc2._id,
        midlineShiftMm: 6.5,
        tumorVolumeCm3: 42.0,
        triggerReason: "Bệnh nhân có khối u thùy trán phù não cấp gây đè sụp não thất, lệch đường giữa 6.5mm nguy cơ tụt não",
        status: "active",
        triggeredAt: now,
      });

      await EmergencyAlert.create({
        hospitalId: hospital._id,
        visitId: visits[0]._id,
        level: "ORANGE",
        triggeredBy: "manual",
        triggeredByUserId: doc1._id,
        triggerReason: "Bệnh nhân co giật cục bộ kéo dài > 5 phút tại khu vực tiếp đón",
        status: "resolved",
        triggeredAt: new Date(now.getTime() - 2 * 3600000),
        resolvedAt: new Date(now.getTime() - 1 * 3600000),
        resolvedBy: doc1._id,
        resolutionNote: "Đã tiêm tĩnh mạch Diazepam 10mg cắt cơn, bệnh nhân tỉnh lại bình thường.",
      });
      console.log("✅ Seeded Emergency Alerts.");

      // ── STEP 21: INVOICES & REVENUE REPORTS ──────────────────────────────────
      console.log("\n💰 Step 21: Seeding Invoices, Financials & Revenue Reports...");
      await Invoice.insertMany([
        {
          hospitalId: hospital._id,
          patientId: pat1._id,
          visitId: visits[0]._id,
          items: [
            { description: "Khám chuyên khoa ngoại thần kinh", amount: 150000, type: "exam" },
            { description: "Chụp cộng hưởng từ MRI sọ não 3.0T", amount: 1500000, type: "mri" },
            { description: "Phân tích tự động tổn thương u não qua AI", amount: 200000, type: "ai" },
          ],
          totalAmount: 1850000,
          status: "đã thanh toán",
          paymentMethod: "vietqr",
          orderCode: 100001,
          paidAt: new Date(now.getTime() - 2 * 3600000),
        },
        {
          hospitalId: hospital._id,
          patientId: pat2._id,
          visitId: visits[1]._id,
          items: [
            { description: "Khám cấp cứu chuyên khoa thần kinh", amount: 150000, type: "exam" },
            { description: "Truyền thuốc cấp cứu Mannitol 20%", amount: 90000, type: "drug" },
          ],
          totalAmount: 240000,
          status: "đã thanh toán",
          paymentMethod: "tiền mặt",
          orderCode: 100002,
          paidAt: new Date(now.getTime() - 1 * 3600000),
        },
        {
          hospitalId: hospital._id,
          patientId: pat3._id,
          visitId: visits[2]._id,
          items: [
            { description: "Khám chuyên khoa theo yêu cầu", amount: 150000, type: "exam" },
            { description: "Chỉ định chụp MRI sọ não chuyên sâu", amount: 1500000, type: "mri" },
          ],
          totalAmount: 1650000,
          status: "chờ thanh toán",
          paymentMethod: "",
          orderCode: 100003,
          paidAt: null,
        },
      ]);

      await RevenueReport.create({
        hospitalId: hospital._id,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        totalAmount: 384000000,
        dailyRecords: [
          { day: 1, patientCount: 42, revenue: 65000000, percentage: 16.9 },
          { day: 2, patientCount: 38, revenue: 58000000, percentage: 15.1 },
          { day: 3, patientCount: 45, revenue: 72000000, percentage: 18.7 },
          { day: 4, patientCount: 50, revenue: 81000000, percentage: 21.0 },
          { day: 5, patientCount: 62, revenue: 108000000, percentage: 28.1 },
        ],
        author: users[3]._id, // hospital_admin
      });

      console.log("✅ Seeded Invoices and Revenue Reports.");

      // ── STEP 22: ANNOUNCEMENTS, NOTIFICATIONS, TICKETS, DATASETS ──────────────
      console.log("\n📢 Step 22: Seeding Announcements, Notifications, Support, and Datasets...");
      await Announcement.insertMany([
        {
          title: "Triển khai phần mềm chẩn đoán tổn thương u não NeuroScan AI thế hệ mới",
          content: "Khoa Ung Thư Não và Khoa Chẩn đoán Hình ảnh chính thức vận hành hệ thống AI hỗ trợ phát hiện ranh giới khối u trên chuỗi xung MRI 3.0T.",
          type: "info",
          author: users[3]._id,
        },
        {
          title: "Bảo trì định kỳ máy MRI 3.0T Siemens Vida",
          content: "Máy MRI 1 sẽ được kỹ sư hãng cân chỉnh từ trường Helium vào lúc 18h00 Thứ Sáu. Toàn bộ ca chụp chuyển sang Phòng MRI 2.",
          type: "maintenance",
          author: users[3]._id,
        },
      ]);

      await Notification.insertMany([
        {
          hospitalId: hospital._id,
          recipientId: doc1._id,
          senderId: nurse1._id,
          type: "new_visit",
          title: "Ca khám mới tiếp nhận",
          message: "Bệnh nhân Tuấn Thành đang chờ tại Phòng khám số 3.",
          isRead: false,
        },
        {
          hospitalId: hospital._id,
          recipientId: tech1._id,
          senderId: doc1._id,
          type: "mri_order",
          title: "Yêu cầu chụp MRI sọ não",
          message: "Bác sĩ Nguyễn Gia Huy vừa chỉ định chụp MRI cản từ cho bệnh nhân Quốc Bảo.",
          isRead: false,
        },
        {
          hospitalId: hospital._id,
          recipientId: pat1._id,
          senderId: null,
          type: "other",
          title: "Lịch hẹn tái khám",
          message: "Bạn có lịch tái khám định kỳ tại Bệnh viện Bạch Mai vào lúc 08:30 sáng mai.",
          isRead: true,
        },
      ]);

      await SupportTicket.insertMany([
        {
          hospitalId: hospital._id,
          userId: doc1._id,
          topic: "Đồng bộ PACS với hệ thống EMR",
          message: "Cần hỗ trợ hiển thị các chuỗi xung FLAIR độ phân giải cao trực tiếp trong tab xem kết quả chẩn đoán.",
          status: "in_progress",
          priority: "high",
        },
        {
          hospitalId: hospital._id,
          userId: pat1._id,
          topic: "Thắc mắc thanh toán VietQR",
          message: "Tôi đã quét mã VietQR và tiền đã trừ tài khoản nhưng hệ thống cần 1 phút để cập nhật trạng thái.",
          status: "resolved",
          priority: "medium",
          resolvedAt: now,
          note: "Đã đối soát cổng PayOS thành công.",
        },
      ]);

      await Dataset.insertMany([
        {
          name: "Bộ dữ liệu Ung thư Não TCGA-LGG (Đã ẩn danh hóa)",
          description: "Tập dữ liệu 250 ca chụp MRI não u thần kinh đệm độ thấp dùng cho nghiên cứu khoa học y sinh.",
          price: 0,
          status: "active",
        },
        {
          name: "Bộ dữ liệu BraTS Benchmark NeuroScan 2026",
          description: "Chuẩn so sánh thuật toán AI U-Net phân đoạn phù não, hoại tử và vùng u bắt cản quang.",
          price: 0,
          status: "active",
        },
      ]);
      console.log("✅ Seeded Announcements, Notifications, Support Tickets, and Datasets.");

      // ── STEP 23: CRYPTOGRAPHIC AUDIT LOGS (HIPAA / TT13 COMPLIANT) ────────────
      console.log("\n🔒 Step 23: Seeding Cryptographic Tamper-Evident Audit Logs...");
      const auditEntries = [
        { action: "LOGIN", entity: "User", entityId: users[0]._id.toString(), performedBy: "admin@neuroscan.com", details: "Quản trị viên hệ thống đăng nhập thành công" },
        { action: "RECORD_VIEWED", entity: "MedicalRecord", entityId: medicalRecords[0]._id.toString(), performedBy: "doctor@neuroscan.com", details: "Bác sĩ Nguyễn Gia Huy xem hồ sơ bệnh án BN001" },
        { action: "STOCK_DEDUCTED", entity: "Drug", entityId: seededDrugs[0]._id.toString(), performedBy: "pharmacy_system", details: "Xuất kho 28 viên Depakine Chrono theo đơn thuốc" },
        { action: "PAYMENT_COMPLETED", entity: "Invoice", entityId: "100001", performedBy: "receptionist@neuroscan.com", details: "Thanh toán viện phí 1,850,000 VND qua VietQR" },
        { action: "BED_OCCUPIED", entity: "HospitalBed", entityId: "ICU-01", performedBy: "nurse@neuroscan.com", details: "Tiếp nhận bệnh nhân vào giường hồi sức cấp cứu u não" },
      ];

      let prevHash = "0000000000000000000000000000000000000000000000000000000000000000";
      const auditDocs = [];
      for (let i = 0; i < auditEntries.length; i++) {
        const item = auditEntries[i];
        const seq = i + 1;
        const timestamp = new Date(now.getTime() - (auditEntries.length - i) * 60000).toISOString();
        const payloadHash = crypto.createHash("sha256").update(item.details).digest("hex");
        const hashMaterial = `${prevHash}|${seq}|${timestamp}|${item.action}|${item.entity}|${item.entityId}|${item.performedBy}|${payloadHash}`;
        const currentHash = crypto.createHash("sha256").update(hashMaterial).digest("hex");

        auditDocs.push({
          action: item.action,
          entity: item.entity,
          entityId: item.entityId,
          performedBy: item.performedBy,
          hospitalId: hospital._id,
          details: item.details,
          sequenceNumber: seq,
          previousHash: prevHash,
          currentHash,
          payloadHash,
          tamperVerified: true,
          createdAt: new Date(timestamp),
        });
        prevHash = currentHash;
      }
      await AuditLog.insertMany(auditDocs);
      console.log(`✅ Seeded ${auditDocs.length} Cryptographic Audit Logs.`);

      // ── STEP 24: SUMMARY REPORT ──────────────────────────────────────────────
      console.log("\n================================================================================");
      console.log("🎉 FULL DATABASE SEEDING COMPLETED SUCCESSFULLY!");
      console.log("================================================================================");
      console.log("📊 Summary of seeded records:");
      console.log(`   - Hospitals:           2`);
      console.log(`   - Users:               ${users.length} (3 accounts per role, password: '123456')`);
      console.log(`   - Patient Profiles:    3`);
      console.log(`   - BHYT Cards:          3`);
      console.log(`   - Privacy Consents:    3`);
      console.log(`   - Biomarkers:          ${BIOMARKERS_DATA.length}`);
      console.log(`   - Drugs (Pharmacy):    ${seededDrugs.length}`);
      console.log(`   - MRI Rooms:           3`);
      console.log(`   - MRI Slots:           ${slotsToInsert.length}`);
      console.log(`   - Hospital Beds:       9`);
      console.log(`   - Work Schedules:      ${createdSchedules.length}`);
      console.log(`   - EMR Records:         ${medicalRecords.length}`);
      console.log(`   - Consultations:       1`);
      console.log(`   - Consent Forms:       2`);
      console.log(`   - Transfer Forms:      1`);
      console.log(`   - Discharge Papers:    1`);
      console.log(`   - Lab Orders:          3`);
      console.log(`   - Prescriptions:       2`);
      console.log(`   - Reminders:           3`);
      console.log(`   - Clinical Visits:     ${visits.length} (including Visit at 'chờ chụp' for you to add MRI data)`);
      console.log(`   - Kanban Tasks:        ${taskSteps.length}`);
      console.log(`   - Invoices:            3`);
      console.log(`   - Audit Logs:          ${auditDocs.length}`);
      console.log(`   - DICOM Studies:       0 (Kept empty per user requirement: ready for your MRI images)`);
      console.log(`   - DICOM Series:        0 (Kept empty per user requirement: ready for your MRI images)`);
      console.log(`   - AI Jobs:             0 (Kept empty per user requirement: ready for your pipeline)`);
      console.log("================================================================================");

      process.exit(0);
    } catch (error) {
      console.error("\n❌ Database seeding failed with error:", error);
      process.exit(1);
    }
  });
};

seedComprehensiveDatabase();
