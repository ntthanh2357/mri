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

  // Dọn dẹp giường cũ để đảm bảo 100% dữ liệu thuộc Khoa Ung Thư Não (Neuro-Oncology)
  await db.collection('hospitalbeds').deleteMany({});
  console.log('Đã dọn dẹp giường bệnh cũ để khởi tạo hệ thống buồng giường Khoa Ung Thư Não...');

  console.log('Khởi tạo danh sách buồng giường chuyên khoa Ung Thư Não (Neuro-Oncology)...');
  const beds = [];

  for (const hosp of hospitals) {
    beds.push(
      // ── 1. ĐƠN NGUYÊN HỒI SỨC CẤP CỨU U NÃO (NEURO-ICU) ─────────────
      {
        hospitalId: hosp._id,
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
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        hospitalId: hosp._id,
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
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        hospitalId: hosp._id,
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
        createdAt: new Date(),
        updatedAt: new Date()
      },

      // ── 2. ĐƠN NGUYÊN PHẪU THUẬT U NÃO & HỒI TỈNH (SURGICAL & POST-OP) ──
      {
        hospitalId: hosp._id,
        departmentId: 'KUTN-SURG',
        departmentName: 'Khoa Ung Thư Não - Đơn nguyên Phẫu Thuật & Hồi Tỉnh Mổ Mở Sọ (Post-Op Craniotomy)',
        bedNumber: 'SURG-201',
        roomNumber: 'Phòng 201 - Hậu phẫu',
        floor: 'Tầng 2',
        type: 'post_op_recovery',
        status: 'available',
        hasIcpMonitor: false,
        hasEegMonitor: false,
        isIsolationRoom: false,
        notes: 'Giường hồi tỉnh sau phẫu thuật mở sọ vi phẫu cắt u não (Craniotomy for Glioma/Meningioma)',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        hospitalId: hosp._id,
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
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        hospitalId: hosp._id,
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
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        hospitalId: hosp._id,
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
        createdAt: new Date(),
        updatedAt: new Date()
      },

      // ── 3. ĐƠN NGUYÊN HÓA TRỊ & XẠ TRỊ U NÃO (CHEMOTHERAPY & IMMUNO) ──
      {
        hospitalId: hosp._id,
        departmentId: 'KUTN-CHEMO',
        departmentName: 'Khoa Ung Thư Não - Đơn nguyên Hóa Trị & Xạ Trị (Phác đồ Stupp / Temozolomide)',
        bedNumber: 'CHEMO-301',
        roomNumber: 'Phòng 301 - Cách ly',
        floor: 'Tầng 3',
        type: 'isolation',
        status: 'available',
        hasIcpMonitor: false,
        hasEegMonitor: false,
        isIsolationRoom: true,
        notes: 'Buồng cách ly áp lực phòng vô trùng bảo vệ bệnh nhân u não suy giảm miễn dịch / hạ bạch cầu nặng do hóa trị Temozolomide',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        hospitalId: hosp._id,
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
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        hospitalId: hosp._id,
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
        createdAt: new Date(),
        updatedAt: new Date()
      },

      // ── 4. ĐƠN NGUYÊN CHĂM SÓC GIẢM NHẸ & PHỤC HỒI CHỨC NĂNG U NÃO ───
      {
        hospitalId: hosp._id,
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
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        hospitalId: hosp._id,
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
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        hospitalId: hosp._id,
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
        createdAt: new Date(),
        updatedAt: new Date()
      }
    );
  }

  const resBeds = await db.collection('hospitalbeds').insertMany(beds);
  console.log(`✅ Đã tạo thành công ${resBeds.insertedCount} giường bệnh chuyên khoa Ung Thư Não!`);

  await mongoose.disconnect();
  console.log('Hoàn tất.');
  process.exit(0);
}

seedRoomsAndBeds().catch((err) => {
  console.error('Lỗi seed dữ liệu:', err);
  process.exit(1);
});
