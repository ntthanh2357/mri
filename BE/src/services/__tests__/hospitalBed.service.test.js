import mongoose from 'mongoose';
import {
  getBedsService,
  createBedService,
  reserveBedAtomicService,
  occupyBedAtomicService,
  releaseBedService
} from '../hospitalBed.service.js';
import { HospitalBed } from '../../models/hospitalBed.model.js';

describe('Unit Tests: Hospital Bed Service (hospitalBed.service.js)', () => {
  let mockHospitalId;
  let mockAdminUser;
  let mockDoctorUser;
  let mockPatientId;

  beforeAll(async () => {
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/neuroscan_test_logic';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }
    mockHospitalId = new mongoose.Types.ObjectId();
    mockPatientId = new mongoose.Types.ObjectId();

    mockAdminUser = {
      id: new mongoose.Types.ObjectId().toString(),
      hospitalId: mockHospitalId.toString(),
      role: 'admin',
      profile: { fullName: 'Quản Trị Viên Viện' }
    };

    mockDoctorUser = {
      id: new mongoose.Types.ObjectId().toString(),
      hospitalId: mockHospitalId.toString(),
      role: 'doctor',
      profile: { fullName: 'BS. Trần Văn Nam' }
    };
  });

  afterAll(async () => {
    await HospitalBed.deleteMany({ hospitalId: mockHospitalId });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  test('1. Admin tạo giường bệnh thành công và chặn trùng số giường trong cùng khoa (409)', async () => {
    const bedData = {
      departmentId: 'KHOA_HSTC',
      departmentName: 'Khoa Hồi Sức Tích Cực',
      bedNumber: 'G-101',
      roomNumber: 'P-101',
      floor: 'Tầng 1',
      type: 'icu'
    };

    const newBed = await createBedService({
      hospitalId: mockHospitalId,
      role: mockAdminUser.role,
      bedData
    });

    expect(newBed).toBeDefined();
    expect(newBed.bedNumber).toBe('G-101');
    expect(newBed.status).toBe('available');

    // Chặn trùng số giường
    await expect(
      createBedService({
        hospitalId: mockHospitalId,
        role: mockAdminUser.role,
        bedData
      })
    ).rejects.toThrow('đã tồn tại');
  });

  test('2. Giữ chỗ giường nguyên tử (Atomic Reserve) thành công', async () => {
    const bed = new HospitalBed({
      hospitalId: mockHospitalId,
      departmentId: 'KHOA_NOI',
      departmentName: 'Khoa Nội',
      bedNumber: 'G-201',
      status: 'available'
    });
    await bed.save();

    const reservedBed = await reserveBedAtomicService({
      bedId: bed._id,
      hospitalId: mockHospitalId,
      user: mockDoctorUser,
      reserveData: {
        patientId: mockPatientId,
        holdHours: 2
      }
    });

    expect(reservedBed.status).toBe('reserved');
    expect(reservedBed.reservedForPatientId.toString()).toBe(mockPatientId.toString());
    expect(reservedBed.reservedUntil).toBeDefined();
  });

  test('3. Chặn Race Condition khi 2 bác sĩ cùng giữ chỗ 1 giường (409 Conflict)', async () => {
    const bed = new HospitalBed({
      hospitalId: mockHospitalId,
      departmentId: 'KHOA_NGOAI',
      departmentName: 'Khoa Ngoại',
      bedNumber: 'G-301',
      status: 'available'
    });
    await bed.save();

    // Bác sĩ A giữ chỗ
    await reserveBedAtomicService({
      bedId: bed._id,
      hospitalId: mockHospitalId,
      user: mockDoctorUser,
      reserveData: { patientId: mockPatientId, holdHours: 4 }
    });

    // Bác sĩ B cố gắng giữ chỗ cùng lúc -> Phải ném lỗi 409
    await expect(
      reserveBedAtomicService({
        bedId: bed._id,
        hospitalId: mockHospitalId,
        user: { ...mockDoctorUser, id: new mongoose.Types.ObjectId().toString() },
        reserveData: { patientId: new mongoose.Types.ObjectId(), holdHours: 4 }
      })
    ).rejects.toThrow('Không thể giữ chỗ: Giường này hiện không ở trạng thái sẵn sàng');
  });

  test('4. Bệnh nhân nhận giường (Atomic Occupy) và giải phóng giường sang trạng thái khử khuẩn', async () => {
    const bed = new HospitalBed({
      hospitalId: mockHospitalId,
      departmentId: 'KHOA_CAP_CUU',
      departmentName: 'Khoa Cấp Cứu',
      bedNumber: 'G-401',
      status: 'available'
    });
    await bed.save();

    // Nhận giường
    const occupiedBed = await occupyBedAtomicService({
      bedId: bed._id,
      hospitalId: mockHospitalId,
      user: mockDoctorUser,
      occupyData: {
        patientId: mockPatientId,
        diagnosis: 'Nhồi máu não cấp'
      }
    });

    expect(occupiedBed.status).toBe('occupied');
    expect(occupiedBed.currentPatientId.toString()).toBe(mockPatientId.toString());

    // Trả giường -> sang cleaning
    const releasedBed = await releaseBedService({
      bedId: bed._id,
      hospitalId: mockHospitalId,
      user: mockDoctorUser,
      releaseData: { toCleaning: true }
    });

    expect(releasedBed.status).toBe('cleaning');
    expect(releasedBed.currentPatientId).toBeNull();
  });
});
