import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ImagingResult } from './models/imagingResult.model.js';
import { connectDB } from './config/db.js';

dotenv.config();

const seedData = async () => {
  try {
    await connectDB();
    console.log('✅ DB connected for seeding');

    // Create mock imaging result
    await ImagingResult.create({
      medicalId: 'PT-001',
      patientName: 'Nguyễn Văn An',
      birthYear: 1981,
      gender: 'Nam',
      address: 'Đà Nẵng',
      orderDate: new Date(),
      orderingDoctor: 'BS CKII Lê Mạnh Minh',
      orderingDepartment: 'Khoa Nội Thần Kinh',
      medicalRecordNumber: 'SBA-2026-99123',
      diagnosis: 'U não thùy thái dương trái',
      procedure: 'Chụp MRI sọ não 3D',
      technique: 'MRI sọ não không cản từ',
      findings: 'Phát hiện khối u vùng thái dương, kích thước lớn.',
      conclusion: 'Theo dõi U màng não (Meningioma). Cần hội chẩn ngoại khoa.',
      radiologist: 'BS Kỹ thuật viên Test',
      reportDate: new Date(),
      images: ['/uploads/tumor_01.png'],
      imagingType: 'MRI',
    });
    console.log('✅ Mock imaging result created for PT-001');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
};

seedData();
