
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import MedicalRecord from './models/medicalRecord.model.js';
import CareSheet from './models/careSheet.model.js';
import Consultation from './models/consultation.model.js';
import ConsentForm from './models/consentForm.model.js';
import { connectDB } from './config/db.js';

dotenv.config();

const seedData = async () => {
  try {
    await connectDB();
    console.log('✅ DB connected for seeding');

    // Clear existing data
    await MedicalRecord.deleteMany({});
    await CareSheet.deleteMany({});
    await Consultation.deleteMany({});
    await ConsentForm.deleteMany({});
    console.log('🧹 Old EMR data cleared');

    // Create mock medical records
    const records = await MedicalRecord.create([
      {
        patientId: 'PT-001',
        patientName: 'Nguyễn Văn An',
        age: 45,
        gender: 'Nam',
        bhytNumber: 'BH1234567890',
        admissionType: 'Nội trú',
        department: 'Khoa Nội Thần Kinh',
        paymentMethod: 'BHYT',
        doctorInCharge: 'BS CKII Lê Mạnh Minh',
        diagnosis: 'Đau đầu mãn tính, nghi ngờ migraine',
        treatmentPlan: 'Điều trị bằng thuốc, theo dõi huyết áp',
        status: 'Đang điều trị',
        signStatus: 'Chưa duyệt',
      },
      {
        patientId: 'PT-002',
        patientName: 'Trương Thị Ngọc Bích',
        age: 38,
        gender: 'Nữ',
        bhytNumber: 'BH0987654321',
        admissionType: 'Ngoại trú',
        department: 'Khoa Nội Khớp',
        paymentMethod: 'Viện phí',
        doctorInCharge: 'PGS TS Hoàng Thị Thanh',
        diagnosis: 'Viêm khớp đầu gối phải',
        treatmentPlan: 'Uống thuốc giảm đau, vật lý trị liệu',
        status: 'Xuất viện',
        signStatus: 'Đã ký số',
        dischargeDate: new Date('2026-06-15'),
      },
    ]);
    console.log('✅ Mock medical records created');

    // Create mock care sheets
    await CareSheet.create([
      {
        medicalRecordId: records[0]._id,
        careLevel: 2,
        nurse: 'Y tá Lê Thị Hoa',
        pulse: 78,
        bloodPressure: '120/80',
        temperature: 36.8,
        respiratoryRate: 16,
        spo2: 98,
        progressNotes: 'Bệnh nhân tỉnh táo, đáp ứng tốt với điều trị',
        careActions: 'Đo huyết áp, cho uống thuốc, thay băng',
      },
      {
        medicalRecordId: records[0]._id,
        careLevel: 2,
        nurse: 'Y tá Trần Văn Đông',
        pulse: 82,
        bloodPressure: '125/85',
        temperature: 37.0,
        respiratoryRate: 18,
        spo2: 97,
        progressNotes: 'Bệnh nhân ngủ ngon, không có triệu chứng bất thường',
        careActions: 'Theo dõi sinh hiệu, hướng dẫn chế độ ăn',
      },
    ]);
    console.log('✅ Mock care sheets created');

    // Create mock consultation
    await Consultation.create({
      medicalRecordId: records[0]._id,
      meetingDate: new Date('2026-06-17'),
      participants: ['BS Lê Mạnh Minh', 'BS CKII Nguyễn Hồng Hà', 'BS Trần Văn Hải'],
      clinicalSummary: 'Bệnh nhân đau đầu phía trán, mức độ 7/10',
      diagnosis: 'Migraine không có tiền triệu',
      treatmentConclusion: 'Điều trị bằng Sumatriptan, theo dõi huyết áp hàng ngày',
    });
    console.log('✅ Mock consultation created');

    // Create mock consent
    await ConsentForm.create({
      medicalRecordId: records[1]._id,
      procedureName: 'Chọc khớp đầu gối phải',
      risks: 'Nhiễm trùng, đau, xuất huyết nhẹ',
      doctorExplanation: 'Đã giải thích rõ ràng về thủ thuật và các rủi ro cho bệnh nhân',
      doctorSignature: 'PGS TS Hoàng Thị Thanh',
      doctorSigned: true,
      patientSignature: 'Trương Thị Ngọc Bích',
      patientSigned: true,
    });
    console.log('✅ Mock consent form created');

    console.log('\n🎉 All mock EMR data seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seedData();
