import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("MONGO_URI không được tìm thấy trong biến môi trường.");
  process.exit(1);
}

async function seedRoomsAndBeds() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.');

  const db = mongoose.connection.db;
  const hospitals = await db.collection('hospitals').find({}).toArray();

  if (hospitals.length === 0) {
    console.log('Không tìm thấy bệnh viện nào để seed.');
    process.exit(1);
  }

  const existingRoomsCount = await db.collection('mrirooms').countDocuments();
  if (existingRoomsCount === 0) {
    console.log('Khởi tạo phòng chụp MRI mẫu cho các bệnh viện...');
    const rooms = [];

    for (const hosp of hospitals) {
      rooms.push(
        {
          hospitalId: hosp._id,
          name: `Phòng MRI 1.5T - Siemens Magnetom (${hosp.nameShort || hosp.code})`,
          modelMachine: 'Siemens Magnetom Sempra 1.5 Tesla',
          location: 'Tầng 1 - Khu Chẩn đoán hình ảnh',
          maxSlotsPerDay: 16,
          slotDurationMinutes: 30,
          operatingHours: { start: '07:00', end: '17:00' },
          status: 'active',
          notes: 'Máy chụp MRI sọ não và toàn thân tiêu chuẩn.',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          hospitalId: hosp._id,
          name: `Phòng MRI 3.0T Cao Cấp - GE Signa (${hosp.nameShort || hosp.code})`,
          modelMachine: 'GE Healthcare Signa Pioneer 3.0 Tesla',
          location: 'Tầng 1 - Khu CĐHA Kỹ thuật cao',
          maxSlotsPerDay: 16,
          slotDurationMinutes: 30,
          operatingHours: { start: '07:00', end: '17:00' },
          status: 'active',
          notes: 'Phục vụ chụp chuyên sâu khối u não, xung FLAIR và DWI độ phân giải cao.',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      );
    }

    const resRooms = await db.collection('mrirooms').insertMany(rooms);
    console.log(`✅ Đã tạo thành công ${resRooms.insertedCount} phòng MRI!`);
  } else {
    console.log(`Đã có ${existingRoomsCount} phòng MRI trong cơ sở dữ liệu.`);
  }

  const existingBedsCount = await db.collection('hospitalbeds').countDocuments();
  if (existingBedsCount === 0) {
    console.log('Khởi tạo danh sách giường bệnh mẫu...');
    const beds = [];

    for (const hosp of hospitals) {
      beds.push(
        {
          hospitalId: hosp._id,
          departmentId: 'KNT',
          departmentName: 'Khoa Ngoại Thần Kinh',
          bedNumber: 'KNT-101',
          roomNumber: '101',
          floor: 'Tầng 3',
          type: 'standard',
          status: 'available',
          hasIcpMonitor: false,
          hasEegMonitor: false,
          isIsolationRoom: false,
          notes: 'Giường nội trú tiêu chuẩn',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          hospitalId: hosp._id,
          departmentId: 'KNT',
          departmentName: 'Khoa Ngoại Thần Kinh',
          bedNumber: 'KNT-102',
          roomNumber: '101',
          floor: 'Tầng 3',
          type: 'post_op_recovery',
          status: 'available',
          hasIcpMonitor: false,
          hasEegMonitor: false,
          isIsolationRoom: false,
          notes: 'Giường theo dõi hậu phẫu',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          hospitalId: hosp._id,
          departmentId: 'ICU',
          departmentName: 'Hồi Sức Tích Cực Thần Kinh',
          bedNumber: 'ICU-01',
          roomNumber: 'ICU-Special',
          floor: 'Tầng 2',
          type: 'icu_neuro_icp',
          status: 'available',
          hasIcpMonitor: true,
          hasEegMonitor: false,
          isIsolationRoom: false,
          notes: 'Giường hồi sức có máy đo áp lực nội sọ liên tục (ICP Monitor)',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          hospitalId: hosp._id,
          departmentId: 'ICU',
          departmentName: 'Hồi Sức Tích Cực Thần Kinh',
          bedNumber: 'ICU-02',
          roomNumber: 'ICU-Special',
          floor: 'Tầng 2',
          type: 'icu_neuro_eeg',
          status: 'available',
          hasIcpMonitor: true,
          hasEegMonitor: true,
          isIsolationRoom: false,
          notes: 'Giường ICU có Monitor ICP và máy điện não liên tục phát hiện co giật',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      );
    }

    const resBeds = await db.collection('hospitalbeds').insertMany(beds);
    console.log(`✅ Đã tạo thành công ${resBeds.insertedCount} giường bệnh!`);
  } else {
    console.log(`Đã có ${existingBedsCount} giường bệnh trong cơ sở dữ liệu.`);
  }

  await mongoose.disconnect();
  console.log('Hoàn tất.');
  process.exit(0);
}

seedRoomsAndBeds().catch((err) => {
  console.error('Lỗi seed dữ liệu:', err);
  process.exit(1);
});
