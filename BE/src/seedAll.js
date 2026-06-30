import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

import Hospital from "./models/hospital.model.js";
import { User } from "./models/user.model.js";
import { VitalSign } from "./models/vitalSign.model.js";
import { LabOrder } from "./models/labOrder.model.js";
import MedicalRecord from "./models/medicalRecord.model.js";
import CareSheet from "./models/careSheet.model.js";
import Consultation from "./models/consultation.model.js";
import ConsentForm from "./models/consentForm.model.js";
import { ImagingResult } from "./models/imagingResult.model.js";
import { Visit } from "./models/visit.model.js";
import { Invoice } from "./models/invoice.model.js";
import { connectDB } from "./config/db.js";

dotenv.config();

const seedAllData = async () => {
  try {
    console.log("Connecting to database...");
    await connectDB();
    console.log("Successfully connected to database. Cleaning old data...");

    // 1. Clean all existing data to prevent duplicate keys and mixed state
    await Promise.all([
      Hospital.deleteMany({}),
      User.deleteMany({}),
      VitalSign.deleteMany({}),
      LabOrder.deleteMany({}),
      MedicalRecord.deleteMany({}),
      CareSheet.deleteMany({}),
      Consultation.deleteMany({}),
      ConsentForm.deleteMany({}),
      ImagingResult.deleteMany({}),
      Visit.deleteMany({}),
      Invoice.deleteMany({}),
    ]);
    console.log("🧹 All old data cleared successfully.");

    // 2. Create Hospital
    console.log("Seeding Hospital...");
    const hospital = await Hospital.create({
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
      },
      isActive: true,
    });
    console.log(`🏥 Created Hospital: ${hospital.name} (Code: ${hospital.code})`);

    // 3. Create Password Hashes
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash("123456", salt);

    // 4. Create Users (3 accounts per role)
    console.log("Seeding Users (3 accounts per role)...");
    const mockUsers = [
      // ==========================================
      // ROLE: ADMIN (System Admin)
      // ==========================================
      {
        email: "admin@neuroscan.com",
        phone: "+84999999991",
        passwordHash,
        role: "admin",
        isVerified: true,
        profile: { name: "Huy Hoàng Admin 1", photoUrl: "", medicalId: "", licenseUrl: "", address: "" },
      },
      {
        email: "admin2@neuroscan.com",
        phone: "+84999999994",
        passwordHash,
        role: "admin",
        isVerified: true,
        profile: { name: "Đại Nghĩa Admin 2", photoUrl: "", medicalId: "", licenseUrl: "", address: "" },
      },
      {
        email: "admin3@neuroscan.com",
        phone: "+84999999995",
        passwordHash,
        role: "admin",
        isVerified: true,
        profile: { name: "Minh Trí Admin 3", photoUrl: "", medicalId: "", licenseUrl: "", address: "" },
      },

      // ==========================================
      // ROLE: HOSPITAL_ADMIN (Quản lý bệnh viện)
      // ==========================================
      {
        email: "admin.bvbm@neuroscan.com",
        phone: "+84999999111",
        passwordHash,
        role: "hospital_admin",
        hospitalId: hospital._id,
        isVerified: true,
        profile: { name: "Quản lý Bạch Mai 1", photoUrl: "", medicalId: "", licenseUrl: "", address: "" },
      },
      {
        email: "hospital_admin2@neuroscan.com",
        phone: "+84999999112",
        passwordHash,
        role: "hospital_admin",
        hospitalId: hospital._id,
        isVerified: true,
        profile: { name: "Quản lý Bạch Mai 2", photoUrl: "", medicalId: "", licenseUrl: "", address: "" },
      },
      {
        email: "hospital_admin3@neuroscan.com",
        phone: "+84999999113",
        passwordHash,
        role: "hospital_admin",
        hospitalId: hospital._id,
        isVerified: true,
        profile: { name: "Quản lý Bạch Mai 3", photoUrl: "", medicalId: "", licenseUrl: "", address: "" },
      },

      // ==========================================
      // ROLE: DOCTOR (Bác sĩ)
      // ==========================================
      {
        email: "doctor@neuroscan.com",
        phone: "+84999999992",
        passwordHash,
        role: "doctor",
        hospitalId: hospital._id,
        isVerified: true,
        profile: { name: "Bác sĩ Gia Huy 1", photoUrl: "", medicalId: "", licenseUrl: "https://storage.googleapis.com/neuroscan-cchn/cchn_gia_huy.pdf", address: "" },
      },
      {
        email: "doctor2@neuroscan.com",
        phone: "+84999999996",
        passwordHash,
        role: "doctor",
        hospitalId: hospital._id,
        isVerified: true,
        profile: { name: "Bác sĩ Khánh An 2", photoUrl: "", medicalId: "", licenseUrl: "https://storage.googleapis.com/neuroscan-cchn/cchn_khanh_an.pdf", address: "" },
      },
      {
        email: "doctor3@neuroscan.com",
        phone: "+84999999997",
        passwordHash,
        role: "doctor",
        hospitalId: hospital._id,
        isVerified: true,
        profile: { name: "Bác sĩ Thanh Hải 3", photoUrl: "", medicalId: "", licenseUrl: "https://storage.googleapis.com/neuroscan-cchn/cchn_thanh_hai.pdf", address: "" },
      },

      // ==========================================
      // ROLE: NURSE (Điều dưỡng / Y tá)
      // ==========================================
      {
        email: "nurse@neuroscan.com",
        phone: "+84888888884",
        passwordHash,
        role: "nurse",
        hospitalId: hospital._id,
        isVerified: true,
        profile: { name: "Điều dưỡng Lê Thị Hoa 1", photoUrl: "", medicalId: "", licenseUrl: "", address: "" },
      },
      {
        email: "nurse2@neuroscan.com",
        phone: "+84888888887",
        passwordHash,
        role: "nurse",
        hospitalId: hospital._id,
        isVerified: true,
        profile: { name: "Điều dưỡng Nguyễn Thị Bình 2", photoUrl: "", medicalId: "", licenseUrl: "", address: "" },
      },
      {
        email: "nurse3@neuroscan.com",
        phone: "+84888888888",
        passwordHash,
        role: "nurse",
        hospitalId: hospital._id,
        isVerified: true,
        profile: { name: "Điều dưỡng Phạm Văn Cường 3", photoUrl: "", medicalId: "", licenseUrl: "", address: "" },
      },

      // ==========================================
      // ROLE: TECHNICIAN (Kỹ thuật viên)
      // ==========================================
      {
        email: "technician@neuroscan.com",
        phone: "+84888888885",
        passwordHash,
        role: "technician",
        hospitalId: hospital._id,
        isVerified: true,
        profile: { name: "KTV Nguyễn Văn Nam 1", photoUrl: "", medicalId: "", licenseUrl: "", address: "" },
      },
      {
        email: "technician2@neuroscan.com",
        phone: "+84888888889",
        passwordHash,
        role: "technician",
        hospitalId: hospital._id,
        isVerified: true,
        profile: { name: "KTV Trần Hữu Đạt 2", photoUrl: "", medicalId: "", licenseUrl: "", address: "" },
      },
      {
        email: "technician3@neuroscan.com",
        phone: "+84888888890",
        passwordHash,
        role: "technician",
        hospitalId: hospital._id,
        isVerified: true,
        profile: { name: "KTV Lê Hoàng Long 3", photoUrl: "", medicalId: "", licenseUrl: "", address: "" },
      },

      // ==========================================
      // ROLE: RECEPTIONIST (Lễ tân)
      // ==========================================
      {
        email: "receptionist@neuroscan.com",
        phone: "+84888888886",
        passwordHash,
        role: "receptionist",
        hospitalId: hospital._id,
        isVerified: true,
        profile: { name: "Lễ tân Trần Mai 1", photoUrl: "", medicalId: "", licenseUrl: "", address: "" },
      },
      {
        email: "receptionist2@neuroscan.com",
        phone: "+84888888891",
        passwordHash,
        role: "receptionist",
        hospitalId: hospital._id,
        isVerified: true,
        profile: { name: "Lễ tân Ngô Thị Tuyết 2", photoUrl: "", medicalId: "", licenseUrl: "", address: "" },
      },
      {
        email: "receptionist3@neuroscan.com",
        phone: "+84888888892",
        passwordHash,
        role: "receptionist",
        hospitalId: hospital._id,
        isVerified: true,
        profile: { name: "Lễ tân Phan Anh Tuấn 3", photoUrl: "", medicalId: "", licenseUrl: "", address: "" },
      },

      // ==========================================
      // ROLE: PATIENT (Bệnh nhân)
      // ==========================================
      {
        email: "patient@neuroscan.com",
        phone: "+84999999993",
        passwordHash,
        role: "patient",
        hospitalId: hospital._id,
        isVerified: true,
        profile: {
          name: "Bệnh nhân Tuấn Thành 1",
          photoUrl: "",
          bhytNumber: "GD4797932200123",
          medicalId: "PT-001",
          address: "Hà Nội",
        },
      },
      {
        email: "patient2@neuroscan.com",
        phone: "+84999999998",
        passwordHash,
        role: "patient",
        hospitalId: hospital._id,
        isVerified: true,
        profile: {
          name: "Bệnh nhân Minh Hằng 2",
          photoUrl: "",
          bhytNumber: "GD4797932200456",
          medicalId: "PT-002",
          address: "Hải Phòng",
        },
      },
      {
        email: "patient3@neuroscan.com",
        phone: "+84999999999",
        passwordHash,
        role: "patient",
        hospitalId: hospital._id,
        isVerified: true,
        profile: {
          name: "Bệnh nhân Quốc Bảo 3",
          photoUrl: "",
          bhytNumber: "GD4797932200789",
          medicalId: "PT-003",
          address: "Nam Định",
        },
      },
    ];

    const users = await User.insertMany(mockUsers);
    console.log(`✅ Seeded ${users.length} Users successfully.`);

    const pat1 = users.find(u => u.email === "patient@neuroscan.com");
    const pat2 = users.find(u => u.email === "patient2@neuroscan.com");
    const pat3 = users.find(u => u.email === "patient3@neuroscan.com");

    const doc1 = users.find(u => u.email === "doctor@neuroscan.com");
    const doc2 = users.find(u => u.email === "doctor2@neuroscan.com");
    const doc3 = users.find(u => u.email === "doctor3@neuroscan.com");

    const nurse1 = users.find(u => u.email === "nurse@neuroscan.com");
    const nurse2 = users.find(u => u.email === "nurse2@neuroscan.com");
    const nurse3 = users.find(u => u.email === "nurse3@neuroscan.com");

    // 5. Create Vital Signs History
    console.log("Seeding Vital Signs...");
    const now = new Date();
    await VitalSign.insertMany([
      {
        hospitalId: hospital._id,
        patient_id: pat1._id,
        pulse: 75,
        blood_pressure: { systolic: 120, diastolic: 80 },
        spo2: 99,
        weight: 68,
        height: 172,
        bmi: 23.0,
        recorded_at: new Date(now.getTime() - 24 * 3600000),
      },
      {
        hospitalId: hospital._id,
        patient_id: pat2._id,
        pulse: 82,
        blood_pressure: { systolic: 135, diastolic: 85 },
        spo2: 98,
        weight: 54,
        height: 160,
        bmi: 21.1,
        recorded_at: new Date(now.getTime() - 24 * 3600000),
      },
      {
        hospitalId: hospital._id,
        patient_id: pat3._id,
        pulse: 70,
        blood_pressure: { systolic: 115, diastolic: 75 },
        spo2: 99,
        weight: 75,
        height: 178,
        bmi: 23.7,
        recorded_at: new Date(now.getTime() - 24 * 3600000),
      },
    ]);
    console.log("✅ Seeded Vital Signs.");

    // 6. Create Medical Records
    console.log("Seeding Medical Records (EMR)...");
    const records = await MedicalRecord.create([
      {
        hospitalId: hospital._id,
        patientId: "PT-001",
        patientName: pat1.profile.name,
        gender: "Nam",
        age: 45,
        admissionType: "Nội trú",
        department: "Khoa Nội Thần Kinh",
        paymentMethod: "Viện phí",
        doctorInCharge: doc1.profile.name,
        diagnosis: "U não thùy thái dương trái (Meningioma) - theo dõi",
        treatmentPlan: "Theo dõi tích cực, chụp MRI định kỳ, hội chẩn phẫu thuật thần kinh",
        status: "Đang điều trị",
        signStatus: "Chưa duyệt",
      },
      {
        hospitalId: hospital._id,
        patientId: "PT-002",
        patientName: pat2.profile.name,
        gender: "Nữ",
        age: 52,
        admissionType: "Nội trú",
        department: "Khoa Phẫu Thuật Thần Kinh",
        paymentMethod: "BHYT",
        doctorInCharge: doc2.profile.name,
        diagnosis: "U màng não (Meningioma) thùy trán - chỉ định phẫu thuật",
        treatmentPlan: "Phẫu thuật cắt u màng não trán phải, theo dõi tri giác",
        status: "Đang điều trị",
        signStatus: "Chưa duyệt",
      },
      {
        hospitalId: hospital._id,
        patientId: "PT-003",
        patientName: pat3.profile.name,
        gender: "Nam",
        age: 38,
        admissionType: "Ngoại trú",
        department: "Khoa Nội Thần Kinh",
        paymentMethod: "Dịch vụ",
        doctorInCharge: doc3.profile.name,
        diagnosis: "Động kinh cục bộ thứ phát sau u não - đã phẫu thuật ổn định",
        treatmentPlan: "Uống Levetiracetam 500mg x 2 lần/ngày, tái khám định kỳ",
        status: "Xuất viện",
        signStatus: "Đã ký số",
        dischargeDate: new Date(now.getTime() - 5 * 24 * 3600000),
      },
    ]);
    console.log(`✅ Seeded ${records.length} Medical Records.`);

    // 7. Create Care Sheets
    console.log("Seeding Care Sheets...");
    await CareSheet.create([
      {
        hospitalId: hospital._id,
        medicalRecordId: records[0]._id,
        careLevel: 2,
        pulse: 76,
        bloodPressure: "120/80",
        temperature: 36.8,
        respiratoryRate: 16,
        spo2: 98,
        progressNotes: "Bệnh nhân tỉnh táo, đau đầu nhẹ vùng thái dương, không nôn.",
        careActions: "Đo huyết áp và mạch 4h/lần, hướng dẫn nghỉ ngơi tại giường.",
        nurse: nurse1.profile.name,
      },
      {
        hospitalId: hospital._id,
        medicalRecordId: records[1]._id,
        careLevel: 1,
        pulse: 84,
        bloodPressure: "135/85",
        temperature: 37.2,
        respiratoryRate: 18,
        spo2: 97,
        progressNotes: "Bệnh nhân hậu phẫu ngày thứ 2, vết mổ khô, tỉnh táo, tiếp xúc tốt.",
        careActions: "Thay băng vết mổ, theo dõi sát sinh hiệu, tiêm thuốc theo y lệnh.",
        nurse: nurse2.profile.name,
      },
    ]);
    console.log("✅ Seeded Care Sheets.");

    // 8. Create Consultations
    console.log("Seeding Consultations...");
    await Consultation.create([
      {
        hospitalId: hospital._id,
        medicalRecordId: records[0]._id,
        meetingDate: new Date(),
        participants: [doc1.profile.name, doc2.profile.name, "BS Nguyễn Hồng Hà (Chẩn đoán hình ảnh)"],
        clinicalSummary: "Bệnh nhân nam 45 tuổi phát hiện khối u thái dương trái kích thước 2.5cm, có triệu chứng đau đầu cục bộ.",
        diagnosis: "U màng não thái dương trái lành tính, chưa xâm lấn mạch máu lớn.",
        treatmentConclusion: "Chỉ định chụp MRI tăng cường cản từ, chuẩn bị hội chẩn mổ mở sọ lấy u vào tuần tới.",
      },
    ]);
    console.log("✅ Seeded Consultation.");

    // 9. Create Consent Forms
    console.log("Seeding Consent Forms...");
    await ConsentForm.create([
      {
        hospitalId: hospital._id,
        medicalRecordId: records[1]._id,
        procedureName: "Phẫu thuật mở sọ cắt u màng não thùy trán",
        risks: "Chảy máu não, phù não, nhiễm trùng vết mổ, liệt nửa người tạm thời, động kinh.",
        doctorExplanation: "Đã giải thích rõ ràng các biến chứng phẫu thuật cho bệnh nhân và gia đình. Bệnh nhân ký cam kết đồng ý thực hiện.",
        doctorSignature: doc2.profile.name,
        doctorSigned: true,
        patientSignature: pat2.profile.name,
        patientSigned: true,
      },
    ]);
    console.log("✅ Seeded Consent Form.");

    // 10. Create Imaging Results
    console.log("Seeding Imaging Results...");
    const imagingResults = await ImagingResult.create([
      {
        hospitalId: hospital._id,
        medicalId: "PT-001",
        patientName: pat1.profile.name,
        birthYear: 1981,
        gender: "Nam",
        address: pat1.profile.address,
        orderDate: new Date(),
        orderingDoctor: doc1.profile.name,
        orderingDepartment: "Khoa Nội Thần Kinh",
        medicalRecordNumber: "SBA-2026-99123",
        diagnosis: "U não thùy thái dương trái",
        procedure: "Chụp MRI sọ não 3D",
        technique: "MRI sọ não có cản từ",
        findings: "Khối u vùng thái dương trái kích thước 22x24mm, tăng tín hiệu đồng đều trên T1W tăng cản từ.",
        conclusion: "U màng não thùy thái dương trái nghi Meningioma lành tính.",
        radiologist: "KTV Nguyễn Văn Nam 1",
        reportDate: new Date(),
        images: ["/uploads/tumor_01.png"],
        imagingType: "MRI",
      },
    ]);
    console.log("✅ Seeded Imaging Results.");

    // 11. Create Lab Orders
    console.log("Seeding Lab Orders...");
    await LabOrder.insertMany([
      {
        hospitalId: hospital._id,
        patient_id: pat1._id,
        patient_gender: "Nam",
        barcode: "LH-2601",
        category: "HUYET_HOC",
        status: "COMPLETED",
        ordered_at: new Date(now.getTime() - 12 * 3600000),
        resulted_at: new Date(now.getTime() - 11 * 3600000),
        results: [
          { biomarker_code: "WBC", biomarker_name: "Bạch Cầu (WBC)", value_result: 6.8, unit: "10^9/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "4.0 - 10.0" },
          { biomarker_code: "RBC", biomarker_name: "Hồng Cầu (RBC)", value_result: 4.6, unit: "10^12/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "4.0 - 5.0" },
          { biomarker_code: "HGB", biomarker_name: "Huyết Sắc Tố (HGB)", value_result: 142, unit: "g/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "130 - 180" },
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
        resulted_at: new Date(now.getTime() - 5 * 3600000),
        results: [
          { biomarker_code: "UREA", biomarker_name: "Urê (Thận)", value_result: 6.0, unit: "mmol/L", is_abnormal: false, abnormal_direction: "", reference_range_display: "2.5 - 7.5" },
          { biomarker_code: "GLU", biomarker_name: "Glucose (Đường huyết)", value_result: 7.2, unit: "mmol/L", is_abnormal: true, abnormal_direction: "HIGH", reference_range_display: "3.9 - 6.4" },
        ],
      },
    ]);
    console.log("✅ Seeded Lab Orders.");

    // 12. Retrieve Technicians
    const tech1 = users.find(u => u.email === "technician@neuroscan.com");
    const tech2 = users.find(u => u.email === "technician2@neuroscan.com");
    const tech3 = users.find(u => u.email === "technician3@neuroscan.com");

    // 13. Create Visits
    console.log("Seeding Visits...");
    await Visit.insertMany([
      {
        hospitalId: hospital._id,
        patientId: pat1._id,
        doctorId: doc1._id,
        nurseId: nurse1._id,
        status: "đang chờ",
        reason: "Đau đầu dữ dội kèm buồn nôn",
      },
      {
        hospitalId: hospital._id,
        patientId: pat2._id,
        doctorId: doc2._id,
        nurseId: nurse2._id,
        status: "đang khám",
        reason: "Co giật nhẹ vùng mặt trái, hay quên",
        vitals: {
          pulse: 82,
          bloodPressure: "135/85",
          temperature: 37.2,
          spo2: 97,
          respiratoryRate: 18,
          measuredAt: new Date(now.getTime() - 2 * 3600000),
        }
      },
      {
        hospitalId: hospital._id,
        patientId: pat1._id,
        doctorId: doc1._id,
        nurseId: nurse1._id,
        technicianId: tech1._id,
        status: "chờ chụp",
        reason: "Khối u vùng thái dương nghi u màng não",
        vitals: {
          pulse: 75,
          bloodPressure: "120/80",
          temperature: 36.8,
          spo2: 99,
          respiratoryRate: 16,
          measuredAt: new Date(now.getTime() - 3 * 3600000),
        },
        mriOrder: {
          region: "Não bộ",
          instructions: "Chụp cộng hưởng từ sọ não có cản từ dựng mạch máu 3D.",
          requestAiAnalysis: true,
          orderedAt: new Date(now.getTime() - 1 * 3600000),
        }
      },
      {
        hospitalId: hospital._id,
        patientId: pat2._id,
        doctorId: doc2._id,
        nurseId: nurse2._id,
        technicianId: tech2._id,
        status: "đang chụp",
        reason: "Theo dõi khối u vùng hố sau",
        vitals: {
          pulse: 80,
          bloodPressure: "130/80",
          temperature: 37.0,
          spo2: 98,
          respiratoryRate: 17,
          measuredAt: new Date(now.getTime() - 2 * 3600000),
        },
        mriOrder: {
          region: "Não bộ",
          instructions: "Chụp khảo sát u góc cầu tiểu não lát cắt mỏng.",
          requestAiAnalysis: true,
          orderedAt: new Date(now.getTime() - 1 * 3600000),
        }
      },
      {
        hospitalId: hospital._id,
        patientId: pat1._id,
        doctorId: doc1._id,
        nurseId: nurse1._id,
        technicianId: tech1._id,
        status: "chờ bác sĩ đọc",
        reason: "U màng não thái dương",
        vitals: {
          pulse: 74,
          bloodPressure: "119/76",
          temperature: 36.7,
          spo2: 99,
          respiratoryRate: 16,
          measuredAt: new Date(now.getTime() - 4 * 3600000),
        },
        mriOrder: {
          region: "Não bộ",
          instructions: "Chụp MRI sọ não cản quang.",
          requestAiAnalysis: true,
          imagingResultId: imagingResults[0]._id,
          orderedAt: new Date(now.getTime() - 3 * 3600000),
        }
      }
    ]);
    console.log("✅ Seeded Visits.");

    console.log("\n🎉 ALL SEED DATA GENERATED SUCCESSFULLY! (Exactly 3 accounts per role, bound to Bệnh viện Bạch Mai)");
    process.exit(0);
  } catch (error) {
    console.error("❌ Database seeding failed:", error);
    process.exit(1);
  }
};

seedAllData();
