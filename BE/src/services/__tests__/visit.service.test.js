import mongoose from 'mongoose';
import {
  submitMriSafetyCheckService,
  requestMriRescanService,
  cancelMriOrderService,
  createMriOrderService
} from '../visit.service.js';
import { Visit } from '../../models/visit.model.js';
import { Hospital } from '../../models/hospital.model.js';
import { User } from '../../models/user.model.js';
import { Invoice } from '../../models/invoice.model.js';

describe('Unit Tests: Visit Service (visit.service.js)', () => {
  let mockHospitalId;
  let mockDoctorId;
  let mockPatientId;
  let mockTechnician;

  beforeAll(async () => {
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/neuroscan_test_logic';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }
    mockHospitalId = new mongoose.Types.ObjectId();
    mockDoctorId = new mongoose.Types.ObjectId();
    mockPatientId = new mongoose.Types.ObjectId();
    mockTechnician = {
      id: new mongoose.Types.ObjectId().toString(),
      hospitalId: mockHospitalId.toString(),
      role: 'technician',
      profile: { fullName: 'KTV. Lê Văn Bình' }
    };
  });

  afterAll(async () => {
    await Visit.deleteMany({ hospitalId: mockHospitalId });
    await Invoice.deleteMany({ hospitalId: mockHospitalId });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  test('1. Chặn chống chỉ định tuyệt đối nếu bệnh nhân mang máy tạo nhịp tim', async () => {
    const visit = new Visit({
      hospitalId: mockHospitalId,
      patientId: mockPatientId,
      doctorId: mockDoctorId,
      status: 'chờ chụp'
    });
    await visit.save();

    await expect(
      submitMriSafetyCheckService({
        visitId: visit._id,
        hospitalId: mockHospitalId,
        user: mockTechnician,
        checklistData: {
          hasPacemakerOrMetal: true,
          hasClaustrophobia: false,
          hasKidneyDisease: false,
          isPregnant: false,
          passed: false
        }
      })
    ).rejects.toThrow('CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI');

    const updated = await Visit.findById(visit._id);
    expect(updated.mriSafetyChecklist.passed).toBe(false);
  });

  test('2. Duyệt an toàn và tự động chuyển sang "đang chụp"', async () => {
    const visit = new Visit({
      hospitalId: mockHospitalId,
      patientId: mockPatientId,
      doctorId: mockDoctorId,
      status: 'chờ chụp'
    });
    await visit.save();

    const result = await submitMriSafetyCheckService({
      visitId: visit._id,
      hospitalId: mockHospitalId,
      user: mockTechnician,
      checklistData: {
        hasPacemakerOrMetal: false,
        hasClaustrophobia: false,
        hasKidneyDisease: false,
        isPregnant: false,
        passed: true,
        notes: 'Đã tháo trang sức kim loại'
      }
    });

    expect(result.visit.status).toBe('đang chụp');
    expect(result.checklist.passed).toBe(true);
    expect(result.checklist.isScreened).toBe(true);
    expect(result.checklist.screenedBy).toBe('KTV. Lê Văn Bình');
  });

  test('3. Ghi nhận yêu cầu chụp lại (Rescan) do nhiễu ảnh', async () => {
    const visit = new Visit({
      hospitalId: mockHospitalId,
      patientId: mockPatientId,
      doctorId: mockDoctorId,
      status: 'đang chụp'
    });
    await visit.save();

    const updated = await requestMriRescanService({
      visitId: visit._id,
      hospitalId: mockHospitalId,
      user: mockTechnician,
      reason: 'Bệnh nhân cử động đầu gây nhòe ảnh'
    });

    expect(updated.status).toBe('chờ chụp lại');
    expect(updated.mriRescanReason).toBe('Bệnh nhân cử động đầu gây nhòe ảnh');
  });

  test('4. Ghi nhận hủy ca chụp MRI kèm lý do lâm sàng', async () => {
    const visit = new Visit({
      hospitalId: mockHospitalId,
      patientId: mockPatientId,
      doctorId: mockDoctorId,
      status: 'chờ chụp'
    });
    await visit.save();

    const updated = await cancelMriOrderService({
      visitId: visit._id,
      hospitalId: mockHospitalId,
      user: mockTechnician,
      reason: 'Bệnh nhân hoảng loạn hội chứng sợ buồng kín'
    });

    expect(updated.status).toBe('đã hủy');
    expect(updated.mriCancelReason).toBe('Bệnh nhân hoảng loạn hội chứng sợ buồng kín');
  });
});
