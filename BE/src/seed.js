import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { User } from "./models/user.model.js";
import { Biomarker } from "./models/biomarker.model.js";
import { LabOrder } from "./models/labOrder.model.js";
import { VitalSign } from "./models/vitalSign.model.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/neuro";

const seedDatabase = async () => {
  try {
    console.log("Connecting to MongoDB for seeding...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected successfully.");

    // 1. Dọn dẹp dữ liệu cũ
    console.log("Cleaning up old data...");
    await User.deleteMany({ email: { $in: ["admin@neuroscan.com", "doctor@neuroscan.com", "patient@neuroscan.com"] } });
    await Biomarker.deleteMany({});
    await LabOrder.deleteMany({});
    await VitalSign.deleteMany({});
    console.log("Cleanup finished.");

    // 2. Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash("123456", salt);

    // 3. Khởi tạo người dùng mẫu
    const mockUsers = [
      {
        email: "admin@neuroscan.com",
        phone: "+84999999991",
        passwordHash,
        role: "admin",
        isVerified: true,
        profile: { name: "Huy Hoàng Admin", photoUrl: "" },
      },
      {
        email: "doctor@neuroscan.com",
        phone: "+84999999992",
        passwordHash,
        role: "doctor",
        isVerified: true,
        profile: {
          name: "Bác sĩ Gia Huy",
          photoUrl: "",
          licenseUrl: "https://storage.googleapis.com/neuroscan-cchn/cchn_gia_huy.pdf",
        },
      },
      {
        email: "patient@neuroscan.com",
        phone: "+84999999993",
        passwordHash,
        role: "patient",
        isVerified: true,
        profile: {
          name: "Bệnh nhân Tuấn Thành",
          photoUrl: "",
          bhytNumber: "GD4797932200123",
        },
      },
    ];

    console.log("Inserting users...");
    const createdUsers = await User.insertMany(mockUsers);
    const patientUser = createdUsers.find(u => u.role === "patient");
    console.log("Users seeded successfully.");

    // 4. Danh mục biomarker ĐẦY ĐỦ theo phiếu mẫu Hóa sinh & Huyết học
    const mockBiomarkers = [

      // ═══════════════════════════════════════════════
      // PHIẾU HÓA SINH MÁU (MS: 22/BV-02)
      // ═══════════════════════════════════════════════

      // Nhóm Thận - Chức năng thận
      { code: "UREA", name: "Urê (Thận)", category: "HOA_SINH", unit: "mmol/L",
        reference_range: { male: { min: 2.5, max: 7.5 }, female: { min: 2.5, max: 7.5 }, text: "2.5 - 7.5 mmol/L" } },
      { code: "CRE", name: "Creatinin (Thận)", category: "HOA_SINH", unit: "μmol/L",
        reference_range: { male: { min: 62, max: 120 }, female: { min: 53, max: 100 }, text: "Nam: 62-120, Nữ: 53-100 μmol/L" } },
      { code: "ACID_URIC", name: "Acid Uric", category: "HOA_SINH", unit: "μmol/L",
        reference_range: { male: { min: 180, max: 420 }, female: { min: 150, max: 360 }, text: "Nam: 180-420, Nữ: 150-360 μmol/L" } },

      // Nhóm Đường huyết
      { code: "GLU", name: "Glucose (Đường huyết)", category: "HOA_SINH", unit: "mmol/L",
        reference_range: { male: { min: 3.9, max: 6.4 }, female: { min: 3.9, max: 6.4 }, text: "3.9 - 6.4 mmol/L" } },

      // Nhóm Bilirubin - Chức năng gan mật
      { code: "BILI_TP", name: "Bilirubin Toàn Phần", category: "HOA_SINH", unit: "μmol/L",
        reference_range: { male: { max: 17 }, female: { max: 17 }, text: "≤ 17 μmol/L" } },
      { code: "BILI_TT", name: "Bilirubin Trực Tiếp", category: "HOA_SINH", unit: "μmol/L",
        reference_range: { male: { max: 4.3 }, female: { max: 4.3 }, text: "≤ 4.3 μmol/L" } },
      { code: "BILI_GT", name: "Bilirubin Gián Tiếp", category: "HOA_SINH", unit: "μmol/L",
        reference_range: { male: { max: 12.7 }, female: { max: 12.7 }, text: "≤ 12.7 μmol/L" } },

      // Nhóm Protein
      { code: "PROTEIN_TP", name: "Protein Toàn Phần", category: "HOA_SINH", unit: "g/L",
        reference_range: { male: { min: 65, max: 82 }, female: { min: 65, max: 82 }, text: "65 - 82 g/L" } },
      { code: "ALBUMIN", name: "Albumin", category: "HOA_SINH", unit: "g/L",
        reference_range: { male: { min: 35, max: 50 }, female: { min: 35, max: 50 }, text: "35 - 50 g/L" } },
      { code: "GLOBULIN", name: "Globulin", category: "HOA_SINH", unit: "g/L",
        reference_range: { male: { min: 24, max: 38 }, female: { min: 24, max: 38 }, text: "24 - 38 g/L" } },
      { code: "AG_RATIO", name: "Tỷ lệ A/G", category: "HOA_SINH", unit: "",
        reference_range: { male: { min: 1.3, max: 1.8 }, female: { min: 1.3, max: 1.8 }, text: "1.3 - 1.8" } },

      // Nhóm Đông máu
      { code: "FIBRINOGEN", name: "Fibrinogen", category: "HOA_SINH", unit: "g/L",
        reference_range: { male: { min: 2, max: 4 }, female: { min: 2, max: 4 }, text: "2 - 4 g/L" } },

      // Nhóm Mỡ máu (Lipid)
      { code: "CHOL", name: "Cholesterol Toàn Phần", category: "HOA_SINH", unit: "mmol/L",
        reference_range: { male: { min: 3.9, max: 5.2 }, female: { min: 3.9, max: 5.2 }, text: "3.9 - 5.2 mmol/L" } },
      { code: "TRIG", name: "Triglycerid", category: "HOA_SINH", unit: "mmol/L",
        reference_range: { male: { min: 0.46, max: 1.88 }, female: { min: 0.46, max: 1.88 }, text: "0.46 - 1.88 mmol/L" } },
      { code: "HDL", name: "HDL-Cholesterol", category: "HOA_SINH", unit: "mmol/L",
        reference_range: { male: { min: 0.9 }, female: { min: 0.9 }, text: "≥ 0.9 mmol/L" } },
      { code: "LDL", name: "LDL-Cholesterol", category: "HOA_SINH", unit: "mmol/L",
        reference_range: { male: { max: 3.4 }, female: { max: 3.4 }, text: "≤ 3.4 mmol/L" } },

      // Nhóm Điện giải
      { code: "NA", name: "Natri (Na+)", category: "HOA_SINH", unit: "mmol/L",
        reference_range: { male: { min: 135, max: 145 }, female: { min: 135, max: 145 }, text: "135 - 145 mmol/L" } },
      { code: "K", name: "Kali (K+)", category: "HOA_SINH", unit: "mmol/L",
        reference_range: { male: { min: 3.5, max: 5.0 }, female: { min: 3.5, max: 5.0 }, text: "3.5 - 5.0 mmol/L" } },
      { code: "CL", name: "Chloride (Cl-)", category: "HOA_SINH", unit: "mmol/L",
        reference_range: { male: { min: 98, max: 106 }, female: { min: 98, max: 106 }, text: "98 - 106 mmol/L" } },
      { code: "CA", name: "Calci (Ca2+)", category: "HOA_SINH", unit: "mmol/L",
        reference_range: { male: { min: 2.15, max: 2.6 }, female: { min: 2.15, max: 2.6 }, text: "2.15 - 2.6 mmol/L" } },
      { code: "CA_ION", name: "Calci Ion Hoá", category: "HOA_SINH", unit: "mmol/L",
        reference_range: { male: { min: 1.17, max: 1.29 }, female: { min: 1.17, max: 1.29 }, text: "1.17 - 1.29 mmol/L" } },
      { code: "MG", name: "Magiê (Mg2+)", category: "HOA_SINH", unit: "mmol/L",
        reference_range: { male: { min: 0.8, max: 1.0 }, female: { min: 0.8, max: 1.0 }, text: "0.8 - 1.0 mmol/L" } },
      { code: "PHOS", name: "Phospho (P)", category: "HOA_SINH", unit: "mmol/L",
        reference_range: { male: { min: 0.9, max: 1.5 }, female: { min: 0.9, max: 1.5 }, text: "NL: 0.9 - 1.5 mmol/L" } },

      // Nhóm Men gan - Enzym
      { code: "AST", name: "AST (GOT) - Men gan", category: "HOA_SINH", unit: "U/L",
        reference_range: { male: { max: 37 }, female: { max: 37 }, text: "≤ 37 U/L" } },
      { code: "ALT", name: "ALT (GPT) - Men gan", category: "HOA_SINH", unit: "U/L",
        reference_range: { male: { max: 40 }, female: { max: 40 }, text: "≤ 40 U/L" } },
      { code: "GGT", name: "GGT (Gamma-GT)", category: "HOA_SINH", unit: "U/L",
        reference_range: { male: { min: 11, max: 50 }, female: { min: 7, max: 32 }, text: "Nam: 11-50, Nữ: 7-32 U/L" } },
      { code: "ALP", name: "Phosphatase Kiềm (ALP)", category: "HOA_SINH", unit: "U/L",
        reference_range: { male: { min: 40, max: 150 }, female: { min: 40, max: 150 }, text: "40 - 150 U/L" } },
      { code: "LDH", name: "LDH (Lactate Dehydrogenase)", category: "HOA_SINH", unit: "U/L",
        reference_range: { male: { min: 230, max: 460 }, female: { min: 230, max: 460 }, text: "230 - 460 U/L" } },

      // Nhóm Tim mạch (Cardiac)
      { code: "CK", name: "Creatine Kinase (CK)", category: "HOA_SINH", unit: "U/L",
        reference_range: { male: { min: 24, max: 190 }, female: { min: 24, max: 167 }, text: "Nam: 24-190, Nữ: 24-167 U/L" } },
      { code: "CKMB", name: "CK-MB (Tim)", category: "HOA_SINH", unit: "U/L",
        reference_range: { male: { max: 24 }, female: { max: 24 }, text: "≤ 24 U/L" } },

      // Nhóm Khoáng chất khác
      { code: "FE", name: "Sắt (Fe)", category: "HOA_SINH", unit: "μmol/L",
        reference_range: { male: { min: 11, max: 27 }, female: { min: 7, max: 26 }, text: "Nam: 11-27, Nữ: 7-26 μmol/L" } },
      { code: "CHE", name: "Cholinesterase", category: "HOA_SINH", unit: "U/L",
        reference_range: { male: { min: 5300, max: 12900 }, female: { min: 5300, max: 12900 }, text: "5300 - 12900 U/L" } },
      { code: "AMYLASE", name: "Amylase (Tụy)", category: "HOA_SINH", unit: "U/L",
        reference_range: { male: { min: 25, max: 125 }, female: { min: 25, max: 125 }, text: "25 - 125 U/L" } },

      // Nhóm Khí máu (Blood Gas)
      { code: "PH", name: "pH Động Mạch", category: "HOA_SINH", unit: "",
        reference_range: { male: { min: 7.37, max: 7.45 }, female: { min: 7.37, max: 7.45 }, text: "7.37 - 7.45" } },
      { code: "PCO2", name: "pCO2", category: "HOA_SINH", unit: "mmHg",
        reference_range: { male: { min: 35, max: 46 }, female: { min: 32, max: 43 }, text: "Nam: 35-46, Nữ: 32-43 mmHg" } },
      { code: "PO2", name: "pO2 Động Mạch", category: "HOA_SINH", unit: "mmHg",
        reference_range: { male: { min: 71, max: 104 }, female: { min: 71, max: 104 }, text: "71 - 104 mmHg" } },
      { code: "HCO3", name: "HCO3 Chuẩn (Bicarbonate)", category: "HOA_SINH", unit: "mmol/L",
        reference_range: { male: { min: 21, max: 26 }, female: { min: 21, max: 26 }, text: "21 - 26 mmol/L" } },
      { code: "BE", name: "Kiềm Dư (Base Excess)", category: "HOA_SINH", unit: "mmol/L",
        reference_range: { male: { min: -2, max: 3 }, female: { min: -2, max: 3 }, text: "-2 đến +3 mmol/L" } },

      // ═══════════════════════════════════════════════
      // PHIẾU HUYẾT HỌC - Tổng phân tích tế bào máu
      // ═══════════════════════════════════════════════

      // Bạch cầu (WBC)
      { code: "WBC", name: "Bạch Cầu (WBC)", category: "HUYET_HOC", unit: "10^9/L",
        reference_range: { male: { min: 4.0, max: 10.0 }, female: { min: 4.0, max: 10.0 }, text: "4.0 - 10.0 × 10⁹/L" } },
      { code: "NEU_PCT", name: "Bạch cầu Trung tính % (NEU%)", category: "HUYET_HOC", unit: "%",
        reference_range: { male: { min: 50, max: 75 }, female: { min: 50, max: 75 }, text: "50 - 75%" } },
      { code: "NEU_ABS", name: "Bạch cầu Trung tính # (NEU#)", category: "HUYET_HOC", unit: "10^9/L",
        reference_range: { male: { min: 1.7, max: 7.5 }, female: { min: 1.7, max: 7.5 }, text: "1.7 - 7.5 × 10⁹/L" } },
      { code: "LYM_PCT", name: "Lymphocyte % (LYM%)", category: "HUYET_HOC", unit: "%",
        reference_range: { male: { min: 20, max: 45 }, female: { min: 20, max: 45 }, text: "20 - 45%" } },
      { code: "LYM_ABS", name: "Lymphocyte # (LYM#)", category: "HUYET_HOC", unit: "10^9/L",
        reference_range: { male: { min: 0.4, max: 4.5 }, female: { min: 0.4, max: 4.5 }, text: "0.4 - 4.5 × 10⁹/L" } },
      { code: "MONO_PCT", name: "Monocyte % (MONO%)", category: "HUYET_HOC", unit: "%",
        reference_range: { male: { min: 0, max: 9 }, female: { min: 0, max: 9 }, text: "0 - 9%" } },
      { code: "MONO_ABS", name: "Monocyte # (MONO#)", category: "HUYET_HOC", unit: "10^9/L",
        reference_range: { male: { min: 0, max: 0.9 }, female: { min: 0, max: 0.9 }, text: "0 - 0.9 × 10⁹/L" } },
      { code: "EOS_PCT", name: "Bạch cầu Ưa Acid % (EOS%)", category: "HUYET_HOC", unit: "%",
        reference_range: { male: { min: 0, max: 6 }, female: { min: 0, max: 6 }, text: "0 - 6%" } },
      { code: "EOS_ABS", name: "Bạch cầu Ưa Acid # (EOS#)", category: "HUYET_HOC", unit: "10^9/L",
        reference_range: { male: { min: 0, max: 0.7 }, female: { min: 0, max: 0.7 }, text: "0 - 0.7 × 10⁹/L" } },
      { code: "BASO_PCT", name: "Bạch cầu Ưa Base % (BASO%)", category: "HUYET_HOC", unit: "%",
        reference_range: { male: { min: 0, max: 2.5 }, female: { min: 0, max: 2.5 }, text: "0 - 2.5%" } },
      { code: "BASO_ABS", name: "Bạch cầu Ưa Base # (BASO#)", category: "HUYET_HOC", unit: "10^9/L",
        reference_range: { male: { min: 0, max: 0.2 }, female: { min: 0, max: 0.2 }, text: "0 - 0.2 × 10⁹/L" } },

      // Hồng cầu (RBC series)
      { code: "RBC", name: "Hồng Cầu (RBC)", category: "HUYET_HOC", unit: "10^12/L",
        reference_range: { male: { min: 4.0, max: 5.0 }, female: { min: 4.0, max: 5.0 }, text: "4.0 - 5.0 × 10¹²/L" } },
      { code: "HGB", name: "Huyết Sắc Tố (HGB/Hemoglobin)", category: "HUYET_HOC", unit: "g/L",
        reference_range: { male: { min: 130, max: 180 }, female: { min: 120, max: 160 }, text: "Nam: 130-180, Nữ: 120-160 g/L" } },
      { code: "HCT", name: "Hematocrit (HCT)", category: "HUYET_HOC", unit: "%",
        reference_range: { male: { min: 35, max: 55 }, female: { min: 35, max: 55 }, text: "35 - 55%" } },
      { code: "MCV", name: "Thể tích TB hồng cầu (MCV)", category: "HUYET_HOC", unit: "fL",
        reference_range: { male: { min: 80, max: 97 }, female: { min: 80, max: 97 }, text: "80 - 97 fL" } },
      { code: "MCH", name: "Lượng HGB TB hồng cầu (MCH)", category: "HUYET_HOC", unit: "pg",
        reference_range: { male: { min: 26, max: 32 }, female: { min: 26, max: 32 }, text: "26 - 32 pg" } },
      { code: "MCHC", name: "Nồng độ HGB TB hồng cầu (MCHC)", category: "HUYET_HOC", unit: "g/L",
        reference_range: { male: { min: 320, max: 360 }, female: { min: 320, max: 360 }, text: "320 - 360 g/L" } },
      { code: "RDW", name: "Phân bố kích thước hồng cầu (RDW)", category: "HUYET_HOC", unit: "%",
        reference_range: { male: { min: 10, max: 15 }, female: { min: 10, max: 15 }, text: "10 - 15%" } },

      // Tiểu cầu (PLT series)
      { code: "PLT", name: "Tiểu Cầu (PLT)", category: "HUYET_HOC", unit: "10^9/L",
        reference_range: { male: { min: 150, max: 450 }, female: { min: 150, max: 450 }, text: "150 - 450 × 10⁹/L" } },
      { code: "MPV", name: "Thể tích TB tiểu cầu (MPV)", category: "HUYET_HOC", unit: "fL",
        reference_range: { male: { min: 5, max: 11 }, female: { min: 5, max: 11 }, text: "5 - 11 fL" } },
      { code: "PCT", name: "Plateletcrit (PCT)", category: "HUYET_HOC", unit: "%",
        reference_range: { male: { min: 0, max: 9.98 }, female: { min: 0, max: 9.98 }, text: "0 - 9.98%" } },

      // Chỉ số bổ sung (Immature)
      { code: "IG_PCT", name: "Granulocyte Chưa Trưởng Thành % (IG%)", category: "HUYET_HOC", unit: "%",
        reference_range: { male: { min: 0.16, max: 0.61 }, female: { min: 0.16, max: 0.61 }, text: "0.16 - 0.61%" } },
      { code: "IG_ABS", name: "Granulocyte Chưa Trưởng Thành # (IG#)", category: "HUYET_HOC", unit: "10^9/L",
        reference_range: { male: { min: 0.01, max: 0.04 }, female: { min: 0.01, max: 0.04 }, text: "0.01 - 0.04 × 10⁹/L" } },
      { code: "NRBC_PCT", name: "Hồng cầu có nhân % (NRBC%)", category: "HUYET_HOC", unit: "/100WBC",
        reference_range: { male: { max: 0.056 }, female: { max: 0.056 }, text: "≤ 0.056 /100WBC" } },
      { code: "NRBC_ABS", name: "Hồng cầu có nhân # (NRBC#)", category: "HUYET_HOC", unit: "10^9/L",
        reference_range: { male: { min: 0, max: 0.014 }, female: { min: 0, max: 0.014 }, text: "0 - 0.014 × 10⁹/L" } },
    ];

    console.log(`Inserting ${mockBiomarkers.length} biomarkers...`);
    await Biomarker.insertMany(mockBiomarkers);
    console.log("Biomarkers seeded successfully.");

    // 5. Lịch sử sinh hiệu bệnh nhân Tuấn Thành
    const now = new Date();
    const mockVitals = [
      { patient_id: patientUser._id, pulse: 72, blood_pressure: { systolic: 118, diastolic: 78 }, spo2: 98, weight: 68, height: 172, bmi: 22.99, recorded_at: new Date(now.getTime() - 48 * 3600000) },
      { patient_id: patientUser._id, pulse: 78, blood_pressure: { systolic: 125, diastolic: 82 }, spo2: 97, weight: 68, height: 172, bmi: 22.99, recorded_at: new Date(now.getTime() - 24 * 3600000) },
      { patient_id: patientUser._id, pulse: 85, blood_pressure: { systolic: 132, diastolic: 85 }, spo2: 96, weight: 68, height: 172, bmi: 22.99, recorded_at: new Date(now.getTime() - 12 * 3600000) },
      { patient_id: patientUser._id, pulse: 81, blood_pressure: { systolic: 128, diastolic: 83 }, spo2: 98, weight: 68, height: 172, bmi: 22.99, recorded_at: new Date(now.getTime() - 6 * 3600000) },
      { patient_id: patientUser._id, pulse: 74, blood_pressure: { systolic: 120, diastolic: 80 }, spo2: 99, weight: 68, height: 172, bmi: 22.99, recorded_at: new Date(now.getTime() - 1 * 3600000) },
    ];

    console.log("Inserting vitals history...");
    await VitalSign.insertMany(mockVitals);
    console.log("Vitals seeded successfully.");

    // 6. Phiếu xét nghiệm mẫu - ĐẦY ĐỦ theo phiếu thật
    const mockLabOrders = [
      {
        patient_id: patientUser._id,
        patient_gender: "Nam",
        barcode: "LH-2601",
        category: "HUYET_HOC",
        status: "COMPLETED",
        ordered_at: new Date(now.getTime() - 24 * 3600000),
        resulted_at: new Date(now.getTime() - 23 * 3600000),
        results: [
          // Kết quả tổng phân tích tế bào máu ngoại vi (mô phỏng theo phiếu FPT eHospital)
          { biomarker_code: "WBC", biomarker_name: "Bạch Cầu (WBC)", value_result: 6.8, unit: "10^9/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "4.0 - 10.0" },
          { biomarker_code: "NEU_PCT", biomarker_name: "Bạch cầu Trung tính % (NEU%)", value_result: 62.5, unit: "%", is_abnormal: false, abnormal_direction: "", reference_range_display: "50 - 75" },
          { biomarker_code: "NEU_ABS", biomarker_name: "Bạch cầu Trung tính # (NEU#)", value_result: 4.25, unit: "10^9/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "1.7 - 7.5" },
          { biomarker_code: "LYM_PCT", biomarker_name: "Lymphocyte % (LYM%)", value_result: 28.3, unit: "%", is_abnormal: false, abnormal_direction: "", reference_range_display: "20 - 45" },
          { biomarker_code: "LYM_ABS", biomarker_name: "Lymphocyte # (LYM#)", value_result: 1.92, unit: "10^9/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "0.4 - 4.5" },
          { biomarker_code: "MONO_PCT", biomarker_name: "Monocyte % (MONO%)", value_result: 6.2, unit: "%", is_abnormal: false, abnormal_direction: "", reference_range_display: "0 - 9" },
          { biomarker_code: "EOS_PCT", biomarker_name: "Bạch cầu Ưa Acid % (EOS%)", value_result: 2.4, unit: "%", is_abnormal: false, abnormal_direction: "", reference_range_display: "0 - 6" },
          { biomarker_code: "RBC", biomarker_name: "Hồng Cầu (RBC)", value_result: 4.6, unit: "10^12/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "4.0 - 5.0" },
          { biomarker_code: "HGB", biomarker_name: "Huyết Sắc Tố (HGB)", value_result: 142, unit: "g/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "130 - 180" },
          { biomarker_code: "HCT", biomarker_name: "Hematocrit (HCT)", value_result: 44.2, unit: "%", is_abnormal: false, abnormal_direction: "", reference_range_display: "35 - 55" },
          { biomarker_code: "MCV", biomarker_name: "Thể tích TB hồng cầu (MCV)", value_result: 88.5, unit: "fL", is_abnormal: false, abnormal_direction: "", reference_range_display: "80 - 97" },
          { biomarker_code: "MCH", biomarker_name: "Lượng HGB TB hồng cầu (MCH)", value_result: 29.1, unit: "pg", is_abnormal: false, abnormal_direction: "", reference_range_display: "26 - 32" },
          { biomarker_code: "MCHC", biomarker_name: "Nồng độ HGB TB hồng cầu (MCHC)", value_result: 340, unit: "g/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "320 - 360" },
          { biomarker_code: "RDW", biomarker_name: "Phân bố kích thước hồng cầu (RDW)", value_result: 12.8, unit: "%", is_abnormal: false, abnormal_direction: "", reference_range_display: "10 - 15" },
          { biomarker_code: "PLT", biomarker_name: "Tiểu Cầu (PLT)", value_result: 245, unit: "10^9/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "150 - 450" },
          { biomarker_code: "MPV", biomarker_name: "Thể tích TB tiểu cầu (MPV)", value_result: 8.5, unit: "fL", is_abnormal: false, abnormal_direction: "", reference_range_display: "5 - 11" },
        ]
      },
      {
        patient_id: patientUser._id,
        patient_gender: "Nam",
        barcode: "HS-2602",
        category: "HOA_SINH",
        status: "COMPLETED",
        ordered_at: new Date(now.getTime() - 12 * 3600000),
        resulted_at: new Date(now.getTime() - 11 * 3600000),
        results: [
          // Kết quả Hóa sinh máu đầy đủ theo phiếu MS: 22/BV-02
          { biomarker_code: "UREA", biomarker_name: "Urê (Thận)", value_result: 6.0, unit: "mmol/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "2.5 - 7.5" },
          { biomarker_code: "GLU", biomarker_name: "Glucose (Đường huyết)", value_result: 7.2, unit: "mmol/L", is_abnormal: true, abnormal_direction: "HIGH", reference_range_display: "3.9 - 6.4" },
          { biomarker_code: "CRE", biomarker_name: "Creatinin (Thận)", value_result: 95.0, unit: "μmol/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "62 - 120" },
          { biomarker_code: "ACID_URIC", biomarker_name: "Acid Uric", value_result: 380.0, unit: "μmol/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "180 - 420" },
          { biomarker_code: "BILI_TP", biomarker_name: "Bilirubin Toàn Phần", value_result: 12.5, unit: "μmol/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "<= 17" },
          { biomarker_code: "CHOL", biomarker_name: "Cholesterol Toàn Phần", value_result: 5.8, unit: "mmol/L", is_abnormal: true, abnormal_direction: "HIGH", reference_range_display: "3.9 - 5.2" },
          { biomarker_code: "TRIG", biomarker_name: "Triglycerid", value_result: 2.1, unit: "mmol/L", is_abnormal: true, abnormal_direction: "HIGH", reference_range_display: "0.46 - 1.88" },
          { biomarker_code: "HDL", biomarker_name: "HDL-Cholesterol", value_result: 1.1, unit: "mmol/L", is_abnormal: false, abnormal_direction: "", reference_range_display: ">= 0.9" },
          { biomarker_code: "LDL", biomarker_name: "LDL-Cholesterol", value_result: 3.9, unit: "mmol/L", is_abnormal: true, abnormal_direction: "HIGH", reference_range_display: "<= 3.4" },
          { biomarker_code: "NA", biomarker_name: "Natri (Na+)", value_result: 138, unit: "mmol/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "135 - 145" },
          { biomarker_code: "K", biomarker_name: "Kali (K+)", value_result: 4.2, unit: "mmol/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "3.5 - 5.0" },
          { biomarker_code: "CL", biomarker_name: "Chloride (Cl-)", value_result: 101, unit: "mmol/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "98 - 106" },
          { biomarker_code: "AST", biomarker_name: "AST (GOT) - Men gan", value_result: 45.0, unit: "U/L", is_abnormal: true, abnormal_direction: "HIGH", reference_range_display: "<= 37" },
          { biomarker_code: "ALT", biomarker_name: "ALT (GPT) - Men gan", value_result: 38.0, unit: "U/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "<= 40" },
          { biomarker_code: "GGT", biomarker_name: "GGT (Gamma-GT)", value_result: 55.0, unit: "U/L", is_abnormal: true, abnormal_direction: "HIGH", reference_range_display: "11 - 50" },
          { biomarker_code: "PROTEIN_TP", biomarker_name: "Protein Toàn Phần", value_result: 72.0, unit: "g/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "65 - 82" },
          { biomarker_code: "ALBUMIN", biomarker_name: "Albumin", value_result: 42.0, unit: "g/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "35 - 50" },
        ]
      },
      {
        patient_id: patientUser._id,
        patient_gender: "Nam",
        barcode: "LIS-9999",
        category: "HOA_SINH",
        status: "PENDING",
        ordered_at: new Date(now.getTime() - 2 * 3600000),
        results: []
      },
      {
        patient_id: patientUser._id,
        patient_gender: "Nam",
        barcode: "LIS-HH-0001",
        category: "HUYET_HOC",
        status: "PENDING",
        ordered_at: new Date(now.getTime() - 1 * 3600000),
        results: []
      }
    ];

    console.log("Inserting lab orders...");
    await LabOrder.insertMany(mockLabOrders);
    console.log("Lab orders seeded successfully.");

    console.log(`\n✅ Seeding hoàn tất!`);
    console.log(`   - Users: ${mockUsers.length}`);
    console.log(`   - Biomarkers: ${mockBiomarkers.length} (${mockBiomarkers.filter(b => b.category === "HOA_SINH").length} Hóa sinh + ${mockBiomarkers.filter(b => b.category === "HUYET_HOC").length} Huyết học)`);
    console.log(`   - Vitals: ${mockVitals.length}`);
    console.log(`   - Lab Orders: ${mockLabOrders.length}`);
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
};

seedDatabase();
