import mongoose from 'mongoose';
import {
  getBedsService,
  createBedService,
  reserveBedAtomicService,
  occupyBedAtomicService,
  releaseBedService,
  completeCleaningService,
  transferBedWithinHospitalService,
  checkNeuroIcuCapacityAlertService
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

  test('5. Kịch bản Concurrency Test: 10 bác sĩ đồng thời gửi 10 request giữ chỗ cùng 1 giường bệnh', async () => {
    // Tạo 1 giường cấp cứu Ngoại thần kinh
    const bed = new HospitalBed({
      hospitalId: mockHospitalId,
      departmentId: 'KHOA_NGOAI_TK',
      departmentName: 'Khoa Ngoại Thần Kinh',
      bedNumber: 'G-ICU-CONCURRENT-01',
      status: 'available',
      type: 'icu_neuro_icp'
    });
    await bed.save();

    // Chuẩn bị 10 bác sĩ và 10 bệnh nhân khác nhau
    const concurrentRequests = Array.from({ length: 10 }, (_, i) => {
      const docId = new mongoose.Types.ObjectId().toString();
      const patId = new mongoose.Types.ObjectId();
      return reserveBedAtomicService({
        bedId: bed._id,
        hospitalId: mockHospitalId,
        user: { id: docId, role: 'doctor', hospitalId: mockHospitalId.toString() },
        reserveData: {
          patientId: patId,
          holdHours: 4,
          reserveReason: 'emergency',
          notes: `Bác sĩ ${i + 1} yêu cầu giữ chỗ khẩn cấp`
        }
      });
    });

    // Kích hoạt đồng thời 10 request
    const results = await Promise.allSettled(concurrentRequests);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    // Khẳng định: Chính xác 1 request thành công, 9 request thất bại
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(9);

    // Kiểm tra tất cả các request thất bại đều nhận lỗi 409 Conflict
    for (const r of rejected) {
      expect(r.reason.statusCode).toBe(409);
      expect(r.reason.message).toContain('Không thể giữ chỗ: Giường này hiện không ở trạng thái sẵn sàng');
    }

    // Kiểm tra trạng thái giường trong CSDL
    const updatedBed = await HospitalBed.findById(bed._id);
    expect(updatedBed.status).toBe('reserved');
    expect(updatedBed.reservedForPatientId.toString()).toBe(fulfilled[0].value.reservedForPatientId.toString());
  });

  test('6. Tự động thu hồi giường giữ chỗ hết hạn khi có request mới (Auto-reclaim Expired Reservation)', async () => {
    const expiredPatientId = new mongoose.Types.ObjectId();
    const bed = new HospitalBed({
      hospitalId: mockHospitalId,
      departmentId: 'KHOA_NGOAI_TK',
      departmentName: 'Khoa Ngoại Thần Kinh',
      bedNumber: 'G-EXPIRED-01',
      status: 'reserved',
      reservedForPatientId: expiredPatientId,
      reservedUntil: new Date(Date.now() - 60000) // Đã hết hạn 1 phút trước
    });
    await bed.save();

    // Bác sĩ mới yêu cầu giữ chỗ cho bệnh nhân mới
    const newPatientId = new mongoose.Types.ObjectId();
    const reservedBed = await reserveBedAtomicService({
      bedId: bed._id,
      hospitalId: mockHospitalId,
      user: mockDoctorUser,
      reserveData: {
        patientId: newPatientId,
        holdHours: 4
      }
    });

    expect(reservedBed).toBeDefined();
    expect(reservedBed.status).toBe('reserved');
    expect(reservedBed.reservedForPatientId.toString()).toBe(newPatientId.toString());
    expect(reservedBed.reservedUntil.getTime()).toBeGreaterThan(Date.now());
  });

  test('7. Hoàn tất khử khuẩn buồng bệnh (completeCleaningService) đưa giường về available', async () => {
    const bed = new HospitalBed({
      hospitalId: mockHospitalId,
      departmentId: 'KHOA_HSTC',
      bedNumber: 'G-CLEAN-01',
      status: 'cleaning'
    });
    await bed.save();

    const readyBed = await completeCleaningService({
      bedId: bed._id,
      hospitalId: mockHospitalId,
      user: { id: new mongoose.Types.ObjectId().toString(), role: 'cleaner' },
      cleaningData: { notes: 'Đã khử khuẩn UV và cồn 70 độ đạt chuẩn' }
    });

    expect(readyBed.status).toBe('available');
    expect(readyBed.notes).toContain('Đã khử khuẩn UV');
  });

  test('8. Điều chuyển bệnh nhân nội viện (ICU Neuro ICP -> Hồi tỉnh post_op_recovery)', async () => {
    const transferPatientId = new mongoose.Types.ObjectId();

    // Giường 1: Đang có bệnh nhân nằm tại ICU
    const fromBed = new HospitalBed({
      hospitalId: mockHospitalId,
      departmentId: 'KHOA_HSTC',
      bedNumber: 'G-ICU-FROM',
      type: 'icu_neuro_icp',
      status: 'occupied',
      currentPatientId: transferPatientId
    });
    await fromBed.save();

    // Giường 2: Giường hồi tỉnh đang trống
    const toBed = new HospitalBed({
      hospitalId: mockHospitalId,
      departmentId: 'KHOA_HOI_TINH',
      bedNumber: 'G-POSTOP-TO',
      type: 'post_op_recovery',
      status: 'available'
    });
    await toBed.save();

    const { fromBed: sourceBed, toBed: destBed } = await transferBedWithinHospitalService({
      fromBedId: fromBed._id,
      toBedId: toBed._id,
      hospitalId: mockHospitalId,
      user: mockDoctorUser,
      transferData: {
        patientId: transferPatientId,
        reason: 'post_op_stabilization',
        diagnosis: 'U nguyên bào đệm sau mổ 48h đã ổn định ICP'
      }
    });

    // Giường đích phải occupied bởi bệnh nhân
    expect(destBed.status).toBe('occupied');
    expect(destBed.currentPatientId.toString()).toBe(transferPatientId.toString());

    // Giường nguồn phải chuyển sang cleaning
    const updatedFromBed = await HospitalBed.findById(fromBed._id);
    expect(updatedFromBed.status).toBe('cleaning');
    expect(updatedFromBed.currentPatientId).toBeNull();
  });

  test('9. Cấu hình giường ICU chuyên biệt U não (Neuro-Oncology ICP, EEG, Isolation) & Giữ chỗ mổ phiên 48h', async () => {
    // 1. Tạo giường ICU chuyên biệt đo ICP
    const icpBed = await createBedService({
      hospitalId: mockHospitalId,
      role: 'admin',
      bedData: {
        departmentId: 'KHOA_NGOAI_TK',
        bedNumber: 'G-NEURO-ICP-01',
        type: 'icu_neuro_icp',
        hasIcpMonitor: true
      }
    });
    expect(icpBed.type).toBe('icu_neuro_icp');
    expect(icpBed.hasIcpMonitor).toBe(true);

    // 2. Giữ chỗ mổ mở sọ u não theo lịch (scheduled_craniotomy) 48 tiếng
    const scheduledPatient = new mongoose.Types.ObjectId();
    const reservedSurgeryBed = await reserveBedAtomicService({
      bedId: icpBed._id,
      hospitalId: mockHospitalId,
      user: mockDoctorUser,
      reserveData: {
        patientId: scheduledPatient,
        holdHours: 48,
        reserveReason: 'scheduled_craniotomy',
        notes: 'Giữ giường ICU theo dõi tăng ICP sau mổ mở sọ Glioblastoma'
      }
    });

    expect(reservedSurgeryBed.reserveReason).toBe('scheduled_craniotomy');
    // Thời hạn giữ chỗ xấp xỉ 48 tiếng (dung sai 1 giờ)
    const holdHoursDiff = (reservedSurgeryBed.reservedUntil.getTime() - Date.now()) / (1000 * 3600);
    expect(holdHoursDiff).toBeGreaterThan(45);
    expect(holdHoursDiff).toBeLessThanOrEqual(48);
  });

  test('10. Cảnh báo quá tải giường Neuro-ICU (checkNeuroIcuCapacityAlertService)', async () => {
    const alertInfo = await checkNeuroIcuCapacityAlertService({ hospitalId: mockHospitalId });
    expect(alertInfo).toBeDefined();
    expect(typeof alertInfo.total).toBe('number');
    expect(typeof alertInfo.available).toBe('number');
    expect(['HIGH', 'NORMAL']).toContain(alertInfo.alertLevel);
    expect(typeof alertInfo.message).toBe('string');
  });
});
