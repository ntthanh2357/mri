
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

    // ============================================================
    // Hồ sơ bệnh án - Chuyên khoa Thần Kinh / Phẫu Thuật Thần Kinh
    // ============================================================
    const records = await MedicalRecord.create([
      {
        patientId: 'PT-001',
        patientName: 'Nguyễn Văn An',
        age: 45,
        gender: 'Nam',
        admissionType: 'Nội trú',
        department: 'Khoa Nội Thần Kinh',
        paymentMethod: 'Viện phí',
        doctorInCharge: 'BS CKII Lê Mạnh Minh',
        diagnosis: 'U não thùy thái dương trái (Meningioma) - theo dõi',
        treatmentPlan: 'Theo dõi tích cực, chụp MRI định kỳ, hội chẩn phẫu thuật thần kinh',
        status: 'Đang điều trị',
        signStatus: 'Chưa duyệt',
      },
      {
        patientId: 'PT-002',
        patientName: 'Trần Thị Mai',
        age: 52,
        gender: 'Nữ',
        admissionType: 'Nội trú',
        department: 'Khoa Phẫu Thuật Thần Kinh',
        paymentMethod: 'Viện phí',
        doctorInCharge: 'PGS TS Hoàng Văn Minh',
        diagnosis: 'U màng não (Meningioma) thùy trán - chỉ định phẫu thuật',
        treatmentPlan: 'Phẫu thuật cắt bỏ u qua đường mổ mở sọ, theo dõi hậu phẫu',
        status: 'Đang điều trị',
        signStatus: 'Chưa duyệt',
      },
      {
        patientId: 'PT-003',
        patientName: 'Lê Quốc Hùng',
        age: 38,
        gender: 'Nam',
        admissionType: 'Ngoại trú',
        department: 'Khoa Nội Thần Kinh',
        paymentMethod: 'Viện phí',
        doctorInCharge: 'BS Gia Huy',
        diagnosis: 'Động kinh cục bộ thứ phát sau u não - xuất viện, theo dõi ngoại trú',
        treatmentPlan: 'Dùng thuốc chống động kinh Levetiracetam, tái khám sau 4 tuần',
        status: 'Xuất viện',
        signStatus: 'Đã ký số',
        dischargeDate: new Date('2026-06-15'),
      },
    ]);
    console.log('✅ Mock medical records created');

    // ============================================================
    // Phiếu Chăm Sóc - Khoa Thần Kinh
    // ============================================================
    await CareSheet.create([
      {
        medicalRecordId: records[0]._id,
        careLevel: 2,
        nurse: 'Y tá Lê Thị Hoa',
        pulse: 72,
        bloodPressure: '118/76',
        temperature: 36.8,
        respiratoryRate: 16,
        spo2: 98,
        progressNotes: 'Bệnh nhân tỉnh táo, đau đầu giảm so với hôm qua (5/10 → 3/10). Không có co giật, không nôn.',
        careActions: 'Đo sinh hiệu 4h/lần, cho uống thuốc giảm phù não (Dexamethasone), theo dõi tri giác theo thang điểm GCS.',
      },
      {
        medicalRecordId: records[0]._id,
        careLevel: 2,
        nurse: 'Y tá Lê Thị Hoa',
        pulse: 76,
        bloodPressure: '122/80',
        temperature: 36.9,
        respiratoryRate: 17,
        spo2: 97,
        progressNotes: 'Bệnh nhân ngủ được, buổi sáng có đau đầu nhẹ vùng thái dương, GCS 15/15.',
        careActions: 'Theo dõi sinh hiệu, hướng dẫn bệnh nhân tránh gắng sức, nhắc uống đủ nước.',
      },
      {
        medicalRecordId: records[1]._id,
        careLevel: 1,
        nurse: 'Y tá Lê Thị Hoa',
        pulse: 80,
        bloodPressure: '130/85',
        temperature: 37.1,
        respiratoryRate: 18,
        spo2: 98,
        progressNotes: 'Bệnh nhân hậu phẫu ngày 1, tỉnh táo, vết mổ khô sạch, không có dấu hiệu phù não tăng.',
        careActions: 'Chăm sóc vết mổ, thay băng, tiêm kháng sinh, theo dõi áp lực nội sọ.',
      },
    ]);
    console.log('✅ Mock care sheets created');

    // ============================================================
    // Phiếu Hội Chẩn - Đa Chuyên Khoa Thần Kinh
    // ============================================================
    await Consultation.create({
      medicalRecordId: records[0]._id,
      meetingDate: new Date('2026-06-17'),
      participants: ['BS CKII Lê Mạnh Minh', 'PGS TS Hoàng Văn Minh', 'BS Nguyễn Hồng Hà (Chẩn đoán hình ảnh)', 'BS Gia Huy (Gây mê hồi sức)'],
      clinicalSummary: 'Bệnh nhân nam 45 tuổi, đau đầu liên tục 3 tháng, MRI phát hiện u thùy thái dương trái kích thước 22x24mm nghi Meningioma lành tính, chưa chèn ép đường giữa.',
      diagnosis: 'U màng não (Meningioma) thùy thái dương trái, WHO độ I, chưa có chỉ định mổ cấp cứu.',
      treatmentConclusion: 'Theo dõi bảo tồn, tái chụp MRI sau 3 tháng. Nếu khối tăng kích thước > 5mm hoặc xuất hiện triệu chứng thần kinh khu trú → hội chẩn phẫu thuật thần kinh ngay.',
    });
    console.log('✅ Mock consultation created');

    // ============================================================
    // Phiếu Đồng Ý Phẫu Thuật - Mổ U Não
    // ============================================================
    await ConsentForm.create({
      medicalRecordId: records[1]._id,
      procedureName: 'Phẫu thuật mở sọ cắt bỏ u não thùy trán (Craniotomy for Meningioma)',
      risks: 'Nguy cơ phù não sau mổ, chảy máu nội sọ, nhiễm trùng vết mổ, thiếu hụt thần kinh cục bộ (yếu liệt, rối loạn ngôn ngữ), động kinh sau phẫu thuật',
      doctorExplanation: 'Đã giải thích đầy đủ cho bệnh nhân và người thân về chỉ định, kỹ thuật, nguy cơ và biến chứng có thể xảy ra trong và sau phẫu thuật. Bệnh nhân hiểu và đồng ý.',
      doctorSignature: 'PGS TS Hoàng Văn Minh',
      doctorSigned: true,
      patientSignature: 'Trần Thị Mai',
      patientSigned: true,
    });
    console.log('✅ Mock consent form created (neurosurgery)');

    console.log('\n🎉 All mock EMR data seeded successfully! (Neurology / Neurosurgery only)');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seedData();
