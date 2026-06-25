import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { User } from "./models/user.model.js";
import { VitalSign } from "./models/vitalSign.model.js";
import { LabOrder } from "./models/labOrder.model.js";
import { Biomarker } from "./models/biomarker.model.js";


dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/neuro";
// mongodb+srv://admin:[EMAIL_ADDRESS]/neuro
const seedDatabase = async () => {
  try {
    console.log("Connecting to MongoDB for seeding...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected successfully.");

    // 1. Clear existing users (Optional - keep it safe or only clear test users)
    console.log("Cleaning up test users...");
    await User.deleteMany({ email: { $in: ["admin@neuroscan.com", "doctor@neuroscan.com", "patient@neuroscan.com", "nurse@neuroscan.com", "technician@neuroscan.com", "receptionist@neuroscan.com"] } });

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
        email: "nurse@neuroscan.com",
        phone: "+84888888884",
        passwordHash,
        role: "nurse",
        isVerified: true,
        profile: { name: "Điều dưỡng Lê Thị Hoa", photoUrl: "" },
      },
      {
        email: "technician@neuroscan.com",
        phone: "+84888888885",
        passwordHash,
        role: "technician",
        isVerified: true,
        profile: { name: "KTV Nguyễn Văn Nam", photoUrl: "" },
      },
      {
        email: "receptionist@neuroscan.com",
        phone: "+84888888886",
        passwordHash,
        role: "receptionist",
        isVerified: true,
        profile: { name: "Lễ tân Trần Mai", photoUrl: "" },
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
          medicalId: "26025699", // Added medicalId linking to the hospital docx forms
        },
      },
    ];

    console.log("Inserting users...");
    const createdUsers = await User.insertMany(mockUsers);
    console.log("Created users:", createdUsers.map(u => `${u.email} (${u.role})`));

    const patientUser = createdUsers.find(u => u.role === "patient");
    const now = new Date();
    const mockBiomarkers = [];
    const mockVitals = [
      {
        patient_id: patientUser._id,
        pulse: 80,
        blood_pressure: { systolic: 120, diastolic: 80 },
        spo2: 98,
        weight: 70,
        height: 175,
        bmi: 22.86,
        recorded_at: new Date(now.getTime() - 2 * 24 * 3600000)
      }
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
