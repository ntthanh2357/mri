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
import { HospitalBed } from "./models/hospitalBed.model.js";
import { connectDB } from "./config/db.js";
import { tenantStorage } from "./middlewares/tenant.middleware.js";

dotenv.config();

const seedAllData = async () => {
  return tenantStorage.run({ bypassTenancy: true, isSuperAdmin: true }, async () => {
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
      HospitalBed.deleteMany({}),
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
        departmentId: "KUTN",
        isVerified: true,
        profile: { name: "KS. Huy Hoàng (Quản trị Hệ thống HIS/PACS)", photoUrl: "", medicalId: "", licenseUrl: "", address: "", specialty: "it_admin" },
      },
      {
        email: "admin2@neuroscan.com",
        phone: "+84999999994",
        passwordHash,
        role: "admin",
        departmentId: "KUTN",
        isVerified: true,
        profile: { name: "KS. Đại Nghĩa (Bảo mật Y tế & Hạ tầng Mạng)", photoUrl: "", medicalId: "", licenseUrl: "", address: "", specialty: "security_admin" },
      },
      {
        email: "admin3@neuroscan.com",
        phone: "+84999999995",
        passwordHash,
        role: "admin",
        departmentId: "KUTN",
        isVerified: true,
        profile: { name: "KS. Minh Trí (Quản trị AI & Dữ liệu Bệnh án EMR)", photoUrl: "", medicalId: "", licenseUrl: "", address: "", specialty: "ai_engineer" },
      },

      // ==========================================
      // ROLE: HOSPITAL_ADMIN (Lãnh đạo Bệnh viện & Khoa)
      // ==========================================
      {
        email: "admin.bvbm@neuroscan.com",
        phone: "+84999999111",
        passwordHash,
        role: "hospital_admin",
        hospitalId: hospital._id,
        departmentId: "KUTN",
        isVerified: true,
        profile: { name: "PGS.TS Vũ Đình Hoàng (Giám đốc Điều hành Khối Thần kinh & Ung Bướu)", photoUrl: "", medicalId: "", licenseUrl: "", address: "", specialty: "hospital_director" },
      },
      {
        email: "hospital_admin2@neuroscan.com",
        phone: "+84999999112",
        passwordHash,
        role: "hospital_admin",
        hospitalId: hospital._id,
        departmentId: "KUTN",
        isVerified: true,
        profile: { name: "ThS.BS Nguyễn Bích Thủy (Trưởng phòng Kế hoạch Tổng hợp & QLCL)", photoUrl: "", medicalId: "", licenseUrl: "", address: "", specialty: "medical_affairs" },
      },
      {
        email: "hospital_admin3@neuroscan.com",
        phone: "+84999999113",
        passwordHash,
        role: "hospital_admin",
        hospitalId: hospital._id,
        departmentId: "KD",
        isVerified: true,
        profile: { name: "DS.CKII Đỗ Trọng Quân (Trưởng khoa Dược & Giám sát Dược Lâm sàng)", photoUrl: "", medicalId: "", licenseUrl: "", address: "", specialty: "clinical_pharmacist" },
      },

      // ==========================================
      // ROLE: DOCTOR (Bác sĩ Ung Thư Não & Thần Kinh)
      // ==========================================
      {
        email: "doctor@neuroscan.com",
        phone: "+84999999992",
        passwordHash,
        role: "doctor",
        hospitalId: hospital._id,
        departmentId: "KUTN-SURG",
        isVerified: true,
        profile: { name: "TS.BS.CKII Nguyễn Gia Huy (Trưởng khoa Ung Thư Não - Phẫu thuật Thần kinh)", photoUrl: "", medicalId: "BS-001", licenseUrl: "https://storage.googleapis.com/neuroscan-cchn/cchn_gia_huy.pdf", address: "Hà Nội", specialty: "neurosurgeon" },
      },
      {
        email: "doctor2@neuroscan.com",
        phone: "+84999999996",
        passwordHash,
        role: "doctor",
        hospitalId: hospital._id,
        departmentId: "KUTN-CHEMO",
        isVerified: true,
        profile: { name: "ThS.BS Trần Khánh An (Phó khoa - Ung Thư Thần Kinh Lâm Sàng & Hóa Xạ Trị)", photoUrl: "", medicalId: "BS-002", licenseUrl: "https://storage.googleapis.com/neuroscan-cchn/cchn_khanh_an.pdf", address: "Hà Nội", specialty: "neuro_oncologist" },
      },
      {
        email: "doctor3@neuroscan.com",
        phone: "+84999999997",
        passwordHash,
        role: "doctor",
        hospitalId: hospital._id,
        departmentId: "KCDHA",
        isVerified: true,
        profile: { name: "BS.CKI Phạm Thanh Hải (Bác sĩ Chẩn đoán Hình ảnh Thần kinh & MRI 3.0T)", photoUrl: "", medicalId: "BS-003", licenseUrl: "https://storage.googleapis.com/neuroscan-cchn/cchn_thanh_hai.pdf", address: "Hà Nội", specialty: "neuroradiologist" },
      },

      // ==========================================
      // ROLE: NURSE (Điều dưỡng Hồi sức & Chăm sóc U Não)
      // ==========================================
      {
        email: "nurse@neuroscan.com",
        phone: "+84888888884",
        passwordHash,
        role: "nurse",
        hospitalId: hospital._id,
        departmentId: "KUTN-ICU",
        isVerified: true,
        profile: { name: "ĐD.CKI Lê Thị Hoa (Điều dưỡng Trưởng Khoa Ung Thư Não)", photoUrl: "", medicalId: "DD-001", licenseUrl: "", address: "Hà Nội", specialty: "neuro_icu_nurse" },
      },
      {
        email: "nurse2@neuroscan.com",
        phone: "+84888888887",
        passwordHash,
        role: "nurse",
        hospitalId: hospital._id,
        departmentId: "KUTN-CHEMO",
        isVerified: true,
        profile: { name: "CNĐD Nguyễn Thị Bình (Điều dưỡng Chăm sóc Hóa trị U Não)", photoUrl: "", medicalId: "DD-002", licenseUrl: "", address: "Hà Nội", specialty: "oncology_nurse" },
      },
      {
        email: "nurse3@neuroscan.com",
        phone: "+84888888888",
        passwordHash,
        role: "nurse",
        hospitalId: hospital._id,
        departmentId: "KUTN-SURG",
        isVerified: true,
        profile: { name: "CNĐD Phạm Văn Cường (Điều dưỡng Hồi tỉnh Sau Phẫu thuật Mở Sọ)", photoUrl: "", medicalId: "DD-003", licenseUrl: "", address: "Hà Nội", specialty: "surgical_nurse" },
      },

      // ==========================================
      // ROLE: TECHNICIAN (Kỹ thuật viên CĐHA & MRI)
      // ==========================================
      {
        email: "technician@neuroscan.com",
        phone: "+84888888885",
        passwordHash,
        role: "technician",
        hospitalId: hospital._id,
        departmentId: "KCDHA",
        isVerified: true,
        profile: { name: "KTV.CKI Nguyễn Văn Nam (Kỹ thuật viên Trưởng Máy MRI 3.0T Sọ Não)", photoUrl: "", medicalId: "KTV-001", licenseUrl: "", address: "Hà Nội", specialty: "mri_technician" },
      },
      {
        email: "technician2@neuroscan.com",
        phone: "+84888888889",
        passwordHash,
        role: "technician",
        hospitalId: hospital._id,
        departmentId: "KCDHA",
        isVerified: true,
        profile: { name: "KTV Trần Hữu Đạt (KTV Vận hành MRI & Xử lý Dựng hình 3D Khối U)", photoUrl: "", medicalId: "KTV-002", licenseUrl: "", address: "Hà Nội", specialty: "mri_technician" },
      },
      {
        email: "technician3@neuroscan.com",
        phone: "+84888888890",
        passwordHash,
        role: "technician",
        hospitalId: hospital._id,
        departmentId: "KUTN-CHEMO",
        isVerified: true,
        profile: { name: "KTV Lê Hoàng Long (KTV Mô phỏng Xạ trị Thần kinh Gia tốc)", photoUrl: "", medicalId: "KTV-003", licenseUrl: "", address: "Hà Nội", specialty: "radiation_technician" },
      },

      // ==========================================
      // ROLE: RECEPTIONIST (Nhân viên Tiếp đón & Thu ngân)
      // ==========================================
      {
        email: "receptionist@neuroscan.com",
        phone: "+84888888886",
        passwordHash,
        role: "receptionist",
        hospitalId: hospital._id,
        departmentId: "KUTN-CLI",
        isVerified: true,
        profile: { name: "Trần Mai (Điều phối viên Tiếp đón & Đăng ký Khám U Não)", photoUrl: "", medicalId: "NV-001", licenseUrl: "", address: "Hà Nội", specialty: "receptionist" },
      },
      {
        email: "receptionist2@neuroscan.com",
        phone: "+84888888891",
        passwordHash,
        role: "receptionist",
        hospitalId: hospital._id,
        departmentId: "KUTN-CLI",
        isVerified: true,
        profile: { name: "Ngô Thị Tuyết (Chuyên viên Phân luồng Cấp cứu & BHYT U Não)", photoUrl: "", medicalId: "NV-002", licenseUrl: "", address: "Hà Nội", specialty: "receptionist" },
      },
      {
        email: "receptionist3@neuroscan.com",
        phone: "+84888888892",
        passwordHash,
        role: "receptionist",
        hospitalId: hospital._id,
        departmentId: "KUTN-CLI",
        isVerified: true,
        profile: { name: "Phan Anh Tuấn (Điều phối viên Hội chẩn & Chuyển tuyến U Não)", photoUrl: "", medicalId: "NV-003", licenseUrl: "", address: "Hà Nội", specialty: "receptionist" },
      },

      // ==========================================
      // ROLE: PATIENT (Bệnh nhân U Não)
      // ==========================================
      {
        email: "patient@neuroscan.com",
        phone: "+84999999993",
        passwordHash,
        role: "patient",
        hospitalId: hospital._id,
        isVerified: true,
        profile: {
          name: "Bệnh nhân Tuấn Thành (U Màng Não Meningioma)",
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
          name: "Bệnh nhân Minh Hằng (Glioblastoma Đa Hình Phù Não)",
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
          name: "Bệnh nhân Quốc Bảo (U Tuyến Yên Đè Giao Thoa Thị Giác)",
          photoUrl: "",
          bhytNumber: "GD4797932200789",
          medicalId: "PT-003",
          address: "Bắc Ninh",
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
        department: "Khoa Ung Thư Não - Phân khu Phẫu thuật & Hồi tỉnh",
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
        department: "Khoa Ung Thư Não - Phân khu Hồi Sức Cấp Cứu (Neuro-ICU)",
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
        department: "Khoa Ung Thư Não - Phân khu Chăm Sóc Giảm Nhẹ",
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
        orderingDepartment: "Khoa Ung Thư Não",
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
      {
        hospitalId: hospital._id,
        patient_id: pat1._id,
        patient_gender: "Nam",
        barcode: "PREOP-NEURO-001",
        category: "HOA_SINH",
        status: "PENDING",
        ordered_at: new Date(now.getTime() - 2 * 3600000),
        results: [],
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

    // 14. Create Invoices
    console.log("Seeding Invoices...");
    await Invoice.insertMany([
      {
        hospitalId: hospital._id,
        patientId: pat1._id,
        items: [
          { description: "Khám lâm sàng thần kinh", amount: 150000, type: "exam" },
          { description: "Chụp cộng hưởng từ MRI sọ não 3D", amount: 1500000, type: "mri" },
          { description: "Phân tích tự động u não qua AI", amount: 200000, type: "ai" }
        ],
        totalAmount: 1850000,
        status: "đã thanh toán",
        paymentMethod: "vietqr",
        paidAt: new Date(now.getTime() - 1 * 3600000),
      },
      {
        hospitalId: hospital._id,
        patientId: pat2._id,
        items: [
          { description: "Khám lâm sàng thần kinh", amount: 150000, type: "exam" },
          { description: "Phân tích tự động u não qua AI", amount: 200000, type: "ai" }
        ],
        totalAmount: 350000,
        status: "đã thanh toán",
        paymentMethod: "tiền mặt",
        paidAt: new Date(now.getTime() - 2 * 3600000),
      },
      {
        hospitalId: hospital._id,
        patientId: pat3._id,
        items: [
          { description: "Chụp cộng hưởng từ MRI sọ não cản từ đa chuỗi xung", amount: 1500000, type: "mri" }
        ],
        totalAmount: 1500000,
        status: "hoàn trả",
        paymentMethod: "chuyển khoản",
        paidAt: new Date(now.getTime() - 4 * 3600000),
      },
      {
        hospitalId: hospital._id,
        patientId: pat1._id,
        items: [
          { description: "Khám chuyên khoa thần kinh", amount: 150000, type: "exam" }
        ],
        totalAmount: 150000,
        status: "chờ thanh toán",
        paymentMethod: "",
        paidAt: null,
      }
    ]);
    console.log("✅ Seeded Invoices.");

    // 13. Create Hospital Beds for Khoa Ung Thư Não (Neuro-Oncology Department)
    console.log("Seeding Hospital Beds for Khoa Ung Thư Não...");
    await HospitalBed.insertMany([
      // ── 1. ĐƠN NGUYÊN HỒI SỨC CẤP CỨU U NÃO (NEURO-ICU) ─────────────
      {
        hospitalId: hospital._id,
        departmentId: 'KUTN-ICU',
        departmentName: 'Khoa Ung Thư Não - Đơn nguyên Hồi Sức Cấp Cứu (Neuro-ICU)',
        bedNumber: 'ICU-01',
        roomNumber: 'ICU-Neuro-1',
        floor: 'Tầng 2',
        type: 'icu_neuro_icp',
        status: 'available',
        hasIcpMonitor: true,
        hasEegMonitor: false,
        isIsolationRoom: false,
        notes: 'Giường hồi sức tích cực u não trang bị Monitor đo áp lực nội sọ liên tục (ICP Monitor) - Cấp cứu tụt não',
      },
      {
        hospitalId: hospital._id,
        departmentId: 'KUTN-ICU',
        departmentName: 'Khoa Ung Thư Não - Đơn nguyên Hồi Sức Cấp Cứu (Neuro-ICU)',
        bedNumber: 'ICU-02',
        roomNumber: 'ICU-Neuro-1',
        floor: 'Tầng 2',
        type: 'icu_neuro_eeg',
        status: 'available',
        hasIcpMonitor: true,
        hasEegMonitor: true,
        isIsolationRoom: false,
        notes: 'Giường hồi sức u não có Monitor ICP và máy đo điện não liên tục (Continuous EEG) phát hiện co giật u não',
      },
      {
        hospitalId: hospital._id,
        departmentId: 'KUTN-ICU',
        departmentName: 'Khoa Ung Thư Não - Đơn nguyên Hồi Sức Cấp Cứu (Neuro-ICU)',
        bedNumber: 'ICU-03',
        roomNumber: 'ICU-Neuro-2',
        floor: 'Tầng 2',
        type: 'icu_standard',
        status: 'available',
        hasIcpMonitor: false,
        hasEegMonitor: false,
        isIsolationRoom: false,
        notes: 'Giường hồi sức tích cực u não cấp cứu theo dõi tri giác GCS',
      },

      // ── 2. ĐƠN NGUYÊN PHẪU THUẬT U NÃO & HỒI TỈNH (SURGICAL & POST-OP) ──
      {
        hospitalId: hospital._id,
        departmentId: 'KUTN-SURG',
        departmentName: 'Khoa Ung Thư Não - Đơn nguyên Phẫu Thuật & Hồi Tỉnh Mổ Mở Sọ (Post-Op Craniotomy)',
        bedNumber: 'SURG-201',
        roomNumber: 'Phòng 201 - Hậu phẫu',
        floor: 'Tầng 2',
        type: 'post_op_recovery',
        status: 'occupied',
        currentPatientId: pat1._id,
        admittedAt: new Date(now.getTime() - 12 * 3600000),
        occupiedAt: new Date(now.getTime() - 12 * 3600000),
        hasIcpMonitor: false,
        hasEegMonitor: false,
        isIsolationRoom: false,
        notes: 'Chẩn đoán: Hậu phẫu ngày thứ 2 mổ mở sọ cắt u màng não (Meningioma) thùy thái dương trái',
      },
      {
        hospitalId: hospital._id,
        departmentId: 'KUTN-SURG',
        departmentName: 'Khoa Ung Thư Não - Đơn nguyên Phẫu Thuật & Hồi Tỉnh Mổ Mở Sọ (Post-Op Craniotomy)',
        bedNumber: 'SURG-202',
        roomNumber: 'Phòng 201 - Hậu phẫu',
        floor: 'Tầng 2',
        type: 'post_op_recovery',
        status: 'available',
        hasIcpMonitor: false,
        hasEegMonitor: false,
        isIsolationRoom: false,
        notes: 'Giường theo dõi hậu phẫu mở sọ, tri giác và dẫn lưu não thất ngoài (EVD)',
      },
      {
        hospitalId: hospital._id,
        departmentId: 'KUTN-SURG',
        departmentName: 'Khoa Ung Thư Não - Đơn nguyên Phẫu Thuật & Hồi Tỉnh Mổ Mở Sọ (Post-Op Craniotomy)',
        bedNumber: 'SURG-203',
        roomNumber: 'Phòng 202',
        floor: 'Tầng 2',
        type: 'standard',
        status: 'available',
        hasIcpMonitor: false,
        hasEegMonitor: false,
        isIsolationRoom: false,
        notes: 'Giường nội trú tiền phẫu chuẩn bị mổ u não (Chụp định vị thần kinh Neuronavigation)',
      },
      {
        hospitalId: hospital._id,
        departmentId: 'KUTN-SURG',
        departmentName: 'Khoa Ung Thư Não - Đơn nguyên Phẫu Thuật & Hồi Tỉnh Mổ Mở Sọ (Post-Op Craniotomy)',
        bedNumber: 'SURG-VIP',
        roomNumber: 'Phòng VIP-21',
        floor: 'Tầng 2',
        type: 'vip',
        status: 'available',
        hasIcpMonitor: false,
        hasEegMonitor: false,
        isIsolationRoom: false,
        notes: 'Phòng chăm sóc u não hậu phẫu tiện nghi cao theo yêu cầu',
      },

      // ── 3. ĐƠN NGUYÊN HÓA TRỊ & XẠ TRỊ U NÃO (CHEMOTHERAPY & IMMUNO) ──
      {
        hospitalId: hospital._id,
        departmentId: 'KUTN-CHEMO',
        departmentName: 'Khoa Ung Thư Não - Đơn nguyên Hóa Trị & Xạ Trị (Phác đồ Stupp / Temozolomide)',
        bedNumber: 'CHEMO-301',
        roomNumber: 'Phòng 301 - Cách ly',
        floor: 'Tầng 3',
        type: 'isolation',
        status: 'reserved',
        reservedForPatientId: pat2._id,
        reservedUntil: new Date(now.getTime() + 4 * 3600000),
        reserveReason: 'scheduled_craniotomy',
        hasIcpMonitor: false,
        hasEegMonitor: false,
        isIsolationRoom: true,
        notes: 'Giữ chỗ trước đợt hóa chất Temozolomide phác đồ Stupp (Bảo vệ bệnh nhân suy giảm bạch cầu)',
      },
      {
        hospitalId: hospital._id,
        departmentId: 'KUTN-CHEMO',
        departmentName: 'Khoa Ung Thư Não - Đơn nguyên Hóa Trị & Xạ Trị (Phác đồ Stupp / Temozolomide)',
        bedNumber: 'CHEMO-302',
        roomNumber: 'Phòng 302',
        floor: 'Tầng 3',
        type: 'standard',
        status: 'available',
        hasIcpMonitor: false,
        hasEegMonitor: false,
        isIsolationRoom: false,
        notes: 'Giường nội trú điều trị hóa chất đường uống Temozolomide kết hợp xạ trị gia tốc phân liều',
      },
      {
        hospitalId: hospital._id,
        departmentId: 'KUTN-CHEMO',
        departmentName: 'Khoa Ung Thư Não - Đơn nguyên Hóa Trị & Xạ Trị (Phác đồ Stupp / Temozolomide)',
        bedNumber: 'CHEMO-303',
        roomNumber: 'Phòng 302',
        floor: 'Tầng 3',
        type: 'standard',
        status: 'available',
        hasIcpMonitor: false,
        hasEegMonitor: false,
        isIsolationRoom: false,
        notes: 'Giường theo dõi đáp ứng điều trị đích và tác dụng phụ thần kinh sau truyền hóa chất',
      },

      // ── 4. ĐƠN NGUYÊN CHĂM SÓC GIẢM NHẸ & PHỤC HỒI CHỨC NĂNG U NÃO ───
      {
        hospitalId: hospital._id,
        departmentId: 'KUTN-PAL',
        departmentName: 'Khoa Ung Thư Não - Đơn nguyên Chăm Sóc Giảm Nhẹ & Phục Hồi Chức Năng',
        bedNumber: 'PAL-401',
        roomNumber: 'Phòng 401',
        floor: 'Tầng 4',
        type: 'standard',
        status: 'available',
        hasIcpMonitor: false,
        hasEegMonitor: false,
        isIsolationRoom: false,
        notes: 'Kiểm soát đau trung ương, chống phù não bằng Corticosteroid và chăm sóc giảm nhẹ u não tiến triển',
      },
      {
        hospitalId: hospital._id,
        departmentId: 'KUTN-PAL',
        departmentName: 'Khoa Ung Thư Não - Đơn nguyên Chăm Sóc Giảm Nhẹ & Phục Hồi Chức Năng',
        bedNumber: 'PAL-402',
        roomNumber: 'Phòng 401',
        floor: 'Tầng 4',
        type: 'standard',
        status: 'available',
        hasIcpMonitor: false,
        hasEegMonitor: false,
        isIsolationRoom: false,
        notes: 'Giường phục hồi chức năng vận động, thăng bằng và ngôn ngữ sau phẫu thuật cắt bỏ u não',
      },
      {
        hospitalId: hospital._id,
        departmentId: 'KUTN-PAL',
        departmentName: 'Khoa Ung Thư Não - Đơn nguyên Chăm Sóc Giảm Nhẹ & Phục Hồi Chức Năng',
        bedNumber: 'PAL-VIP',
        roomNumber: 'Phòng VIP-41',
        floor: 'Tầng 4',
        type: 'vip',
        status: 'available',
        hasIcpMonitor: false,
        hasEegMonitor: false,
        isIsolationRoom: false,
        notes: 'Phòng chăm sóc giảm nhẹ u não gia đình theo yêu cầu (Phòng tiện nghi cao)',
      }
    ]);
    console.log("✅ Seeded Hospital Beds for Khoa Ung Thư Não.");

    console.log("\n🎉 ALL SEED DATA GENERATED SUCCESSFULLY! (Exactly 3 accounts per role, bound to Bệnh viện Bạch Mai)");
    process.exit(0);
  } catch (error) {
    console.error("❌ Database seeding failed:", error);
    process.exit(1);
  }
  });
};

seedAllData();
