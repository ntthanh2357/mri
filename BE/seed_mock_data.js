import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Import Models
import { Hospital } from './src/models/hospital.model.js';
import { User } from './src/models/user.model.js';
import { PatientProfile } from './src/models/patientProfile.model.js';
import { Visit } from './src/models/visit.model.js';
import { ImagingResult } from './src/models/imagingResult.model.js';
import { Drug } from './src/models/drug.model.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://group5:12345@mri.kwwgmt6.mongodb.net/neuro";

async function seed() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB.");

    console.log("Clearing existing mock data...");
    // Just clearing for this hospital to avoid nuking everything, but let's clear all for clean slate
    await Hospital.deleteMany({});
    await User.deleteMany({});
    await PatientProfile.deleteMany({});
    await Visit.deleteMany({});
    await ImagingResult.deleteMany({});
    await Drug.deleteMany({});

    console.log("Creating Hospital...");
    const hospital = await Hospital.create({
      name: "Bệnh viện Đa khoa NeuroScan AI",
      nameShort: "NeuroScan AI",
      code: "HOSP001",
      address: { street: "291 Nguyễn Văn Linh", ward: "Thạc Gián", district: "Thanh Khê", province: "Đà Nẵng" },
      status: "active",
      isActive: true,
      pricing: { examFee: 150000, mriFee: 1500000, aiFee: 200000, maxPatients: 1000 }
    });

    console.log("Creating Drugs...");
    const drugs = [
      {
        hospitalId: hospital._id,
        name: "Paracetamol 500mg",
        activeIngredient: "Paracetamol",
        category: "pain_reliever",
        manufacturer: "Dược Hậu Giang",
        dosageInstructions: "Uống 1-2 viên mỗi 4-6 giờ khi sốt hoặc đau.",
        stock: { quantity: 1000, unit: "Viên", minStock: 50 },
        price: 2000,
        expiryDate: new Date("2028-12-31"),
        isActive: true
      },
      {
        hospitalId: hospital._id,
        name: "Medrol 4mg",
        activeIngredient: "Methylprednisolone",
        category: "corticosteroid",
        manufacturer: "Pfizer",
        dosageInstructions: "Uống 1 viên vào buổi sáng sau ăn.",
        stock: { quantity: 500, unit: "Viên", minStock: 20 },
        price: 4500,
        expiryDate: new Date("2028-12-31"),
        isActive: true
      },
      {
        hospitalId: hospital._id,
        name: "Depakine Chrono 500mg",
        activeIngredient: "Sodium Valproate",
        category: "anticonvulsant",
        manufacturer: "Sanofi",
        dosageInstructions: "Uống 1 viên mỗi 12 giờ.",
        stock: { quantity: 300, unit: "Viên", minStock: 15 },
        price: 8000,
        expiryDate: new Date("2028-12-31"),
        isActive: true
      }
    ];
    await Drug.insertMany(drugs);

    console.log("Creating Users (Staff)...");
    const passwordHash = await bcrypt.hash("123456", 10);

    const roles = [
      { role: "nurse", email: "dieuduong@neuro.com", name: "Điều dưỡng Lê Văn B" },
      { role: "doctor", email: "bacsi@neuro.com", name: "Bác sĩ Trần Thị C" },
      { role: "hospital_admin", email: "admin@neuro.com", name: "Quản lý Bệnh viện A" }
    ];

    const staffDocs = await Promise.all(roles.map(r => User.create({
      email: r.email,
      hospitalId: hospital._id,
      passwordHash,
      role: r.role,
      isVerified: true,
      profile: { name: r.name, medicalId: `STAFF_${r.role.toUpperCase()}` }
    })));

    const getStaff = (role) => staffDocs.find(s => s.role === role)._id;

    console.log("Creating Patients...");
    const patient1User = await User.create({
      email: "benhnhan1@gmail.com",
      hospitalId: hospital._id,
      passwordHash,
      role: "patient",
      isVerified: true,
      profile: { name: "Bệnh nhân Nguyễn Văn Một", medicalId: "BN001", phone: "0901111111" }
    });
    await PatientProfile.create({
      hospitalId: hospital._id,
      userId: patient1User._id,
      gender: "nam",
      phone: "0901111111",
      address: "Hải Châu, Đà Nẵng"
    });

    const patient2User = await User.create({
      email: "benhnhan2@gmail.com",
      hospitalId: hospital._id,
      passwordHash,
      role: "patient",
      isVerified: true,
      profile: { name: "Bệnh nhân Trần Thị Hai", medicalId: "BN002", phone: "0902222222" }
    });
    await PatientProfile.create({
      hospitalId: hospital._id,
      userId: patient2User._id,
      gender: "nu",
      phone: "0902222222",
      address: "Sơn Trà, Đà Nẵng"
    });

    const patient3User = await User.create({
      email: "benhnhan3@gmail.com",
      hospitalId: hospital._id,
      passwordHash,
      role: "patient",
      isVerified: true,
      profile: { name: "Bệnh nhân Lê Văn Ba", medicalId: "BN003", phone: "0903333333" }
    });
    await PatientProfile.create({
      hospitalId: hospital._id,
      userId: patient3User._id,
      gender: "nam",
      phone: "0903333333",
      address: "Cẩm Lệ, Đà Nẵng"
    });

    console.log("Creating Workflow Visits...");

    // Workflow 1: Điều dưỡng tiếp nhận và đo sinh hiệu, Đang chờ Bác sĩ khám
    await Visit.create({
      hospitalId: hospital._id,
      patientId: patient1User._id,
      nurseId: getStaff('nurse'),
      status: 'đang khám', // in current bad logic, 'đang khám' is waiting for doctor
      visitType: 'Khám thần kinh',
      reason: 'Đau đầu kéo dài',
      vitals: { pulse: 80, bloodPressure: "120/80", temperature: 37, spo2: 98, measuredAt: new Date() }
    });

    // Workflow 2: Bác sĩ đã chỉ định chụp MRI, Đang chụp (do Bác sĩ/Điều dưỡng phụ trách)
    await Visit.create({
      hospitalId: hospital._id,
      patientId: patient2User._id,
      doctorId: getStaff('doctor'),
      nurseId: getStaff('nurse'),
      status: 'đang chụp',
      visitType: 'Khám u não',
      reason: 'Chóng mặt, buồn nôn',
      mriOrder: {
        region: 'Sọ não',
        instructions: 'Chụp MRI sọ não có cản từ',
        requestAiAnalysis: true,
        orderedAt: new Date()
      }
    });

    // Workflow 3: Đã có kết quả AI, chờ Bác sĩ đọc
    const imagingResult = await ImagingResult.create({
      hospitalId: hospital._id,
      medicalId: 'BN003',
      patientName: 'Bệnh nhân Lê Văn Ba',
      gender: 'Nam',
      procedure: 'Chụp MRI sọ não',
      findings: 'Có khối u kích thước 2x2cm ở thùy trán',
      conclusion: 'U màng não (Meningioma) thùy trán',
      radiologist: 'BS Trần Thị C',
      reportDate: new Date(),
      orderDate: new Date(),
      imagingType: 'MRI'
    });

    await Visit.create({
      hospitalId: hospital._id,
      patientId: patient3User._id,
      doctorId: getStaff('doctor'),
      nurseId: getStaff('nurse'),
      status: 'chờ bác sĩ đọc',
      visitType: 'Khám tầm soát MRI',
      reason: 'Kiểm tra định kỳ',
      mriOrder: {
        region: 'Sọ não',
        instructions: 'Chụp MRI tầm soát',
        requestAiAnalysis: true,
        orderedAt: new Date(),
        imagingResultId: imagingResult._id
      }
    });

    console.log("Mock data seeded successfully.");
    process.exit(0);

  } catch (err) {
    console.error("Error seeding data:", err);
    process.exit(1);
  }
}

seed();
