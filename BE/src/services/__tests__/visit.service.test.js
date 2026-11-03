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
import { ConsentForm } from '../../models/consentForm.model.js';
import { ensureContrastConsentForVisit } from '../contrastConsent.service.js';

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

  test('2c. Bệnh nhân vừa sửa phiếu tự khai sau khi KTV mở bảng kiểm: không nhận bảng kiểm dựa trên lời khai cũ', async () => {
    const seenAt = new Date('2026-10-15T01:00:00Z');
    const newerAt = new Date('2026-10-15T01:20:00Z');
    const visit = new Visit({ hospitalId: mockHospitalId, patientId: mockPatientId, doctorId: mockDoctorId, status: 'chờ chụp',
      patientMriScreening: { answers: { metalFragments: 'yes' }, level: 'danger', declaredAt: newerAt } });
    await visit.save();
    const safe = { hasPacemakerOrMetal: false, hasClaustrophobia: false, hasKidneyDisease: false, isPregnant: false, passed: true };
    for (const screeningDeclaredAt of [seenAt.toISOString(), undefined, null, 'rác']) {
      let err;
      try { await submitMriSafetyCheckService({ visitId: visit._id, hospitalId: mockHospitalId, user: mockTechnician, checklistData: { ...safe, screeningDeclaredAt } }); } catch (e) { err = e; }
      expect(err?.statusCode).toBe(409);
    }
    expect((await Visit.findById(visit._id)).mriSafetyChecklist.isScreened).toBe(false);
    const ok = await submitMriSafetyCheckService({ visitId: visit._id, hospitalId: mockHospitalId, user: mockTechnician, checklistData: { ...safe, screeningDeclaredAt: newerAt.toISOString() } });
    expect(ok.checklist.isScreened).toBe(true);
  });

  test('2b. Có tiêm cản quang mà bệnh nhân chưa ký phiếu: lưu bảng kiểm nhưng KHÔNG tự chuyển "đang chụp" (UC-PAT-06)', async () => {
    const visit = new Visit({
      hospitalId: mockHospitalId,
      patientId: mockPatientId,
      doctorId: mockDoctorId,
      status: 'chờ chụp',
      mriOrder: { region: 'Não bộ', withContrast: true, orderedAt: new Date() },
    });
    await visit.save();
    const consent = await ensureContrastConsentForVisit(visit);
    const safe = { hasPacemakerOrMetal: false, hasClaustrophobia: false, hasKidneyDisease: false, isPregnant: false, passed: true };

    const first = await submitMriSafetyCheckService({ visitId: visit._id, hospitalId: mockHospitalId, user: mockTechnician, checklistData: safe });
    expect(first.visit.status).toBe('chờ chụp');
    expect(first.contrastConsentPending).toBe(true);
    expect(first.checklist.passed).toBe(true);

    await ConsentForm.updateOne({ _id: consent._id, hospitalId: mockHospitalId }, { $set: { patientSigned: true } });
    const second = await submitMriSafetyCheckService({ visitId: visit._id, hospitalId: mockHospitalId, user: mockTechnician, checklistData: safe });
    expect(second.visit.status).toBe('đang chụp');
    expect(second.contrastConsentPending).toBe(false);
    await ConsentForm.deleteMany({ hospitalId: mockHospitalId });
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

  // ── Hồi quy P0-1: client không được tự tuyên bố "an toàn" ──────────────────
  test('P0-1a. Gửi hasPacemakerOrMetal=true kèm passed=true vẫn bị chặn (không bypass được)', async () => {
    const visit = new Visit({ hospitalId: mockHospitalId, patientId: mockPatientId, doctorId: mockDoctorId, status: 'chờ chụp' });
    await visit.save();

    let err;
    try {
      await submitMriSafetyCheckService({
        visitId: visit._id,
        hospitalId: mockHospitalId,
        user: mockTechnician,
        checklistData: { hasPacemakerOrMetal: true, passed: true }
      });
    } catch (e) { err = e; }

    expect(err?.statusCode).toBe(400);
    expect(err.message).toContain('CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI');
    const stored = await Visit.findById(visit._id);
    expect(stored.status).toBe('chờ chụp');
    expect(stored.mriSafetyChecklist.passed).toBe(false);
  });

  test('P0-1b. KTV không được ghi đè chống chỉ định kim loại dù có nêu lý do', async () => {
    const visit = new Visit({ hospitalId: mockHospitalId, patientId: mockPatientId, doctorId: mockDoctorId, status: 'chờ chụp' });
    await visit.save();

    await expect(
      submitMriSafetyCheckService({
        visitId: visit._id,
        hospitalId: mockHospitalId,
        user: mockTechnician,
        checklistData: { hasPacemakerOrMetal: true, passed: true, overrideReason: 'Bệnh nhân khai mảnh kim loại nhỏ đã cũ' }
      })
    ).rejects.toThrow('CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI');
  });

  test('P0-1c. Bác sĩ ghi đè có lý do chuyên môn: lưu vết người chấp thuận và cho vào buồng', async () => {
    const visit = new Visit({ hospitalId: mockHospitalId, patientId: mockPatientId, doctorId: mockDoctorId, status: 'chờ chụp' });
    await visit.save();
    const doctor = { id: new mongoose.Types.ObjectId().toString(), hospitalId: mockHospitalId.toString(), role: 'doctor', profile: { fullName: 'BS. Trần Văn A' } };

    const result = await submitMriSafetyCheckService({
      visitId: visit._id,
      hospitalId: mockHospitalId,
      user: doctor,
      checklistData: {
        hasPacemakerOrMetal: true,
        overrideReason: 'Thiết bị titanium đã được xác nhận tương thích 1.5T theo hồ sơ cấy ghép',
        passed: false // client cố gửi false cũng không ảnh hưởng: server tự quyết định
      }
    });

    expect(result.checklist.passed).toBe(true);
    expect(result.checklist.overriddenByName).toBe('BS. Trần Văn A');
    expect(result.visit.status).toBe('đang chụp');
  });

  test('P0-1d. Bệnh nhân tự khai có máy tạo nhịp tim: bác sĩ cũng không được ghi đè', async () => {
    const declaredAt = new Date('2026-10-20T02:00:00Z');
    const visit = new Visit({
      hospitalId: mockHospitalId, patientId: mockPatientId, doctorId: mockDoctorId, status: 'chờ chụp',
      patientMriScreening: { answers: { pacemaker: 'yes' }, level: 'danger', declaredAt }
    });
    await visit.save();
    const doctor = { id: new mongoose.Types.ObjectId().toString(), hospitalId: mockHospitalId.toString(), role: 'doctor', profile: { fullName: 'BS. Trần Văn A' } };

    await expect(
      submitMriSafetyCheckService({
        visitId: visit._id,
        hospitalId: mockHospitalId,
        user: doctor,
        checklistData: {
          screeningDeclaredAt: declaredAt.toISOString(),
          hasPacemakerOrMetal: false,
          overrideReason: 'Bác sĩ muốn chụp dù bệnh nhân có máy tạo nhịp'
        }
      })
    ).rejects.toThrow('CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI');
    expect((await Visit.findById(visit._id)).status).toBe('chờ chụp');
  });

  test('P0-1e. Thai kỳ / suy thận có cản quang: KTV không được tự chuyển "đang chụp", cần bác sĩ', async () => {
    const visit = new Visit({
      hospitalId: mockHospitalId, patientId: mockPatientId, doctorId: mockDoctorId, status: 'chờ chụp',
      mriOrder: { region: 'Não bộ', withContrast: true, orderedAt: new Date() }
    });
    await visit.save();

    const first = await submitMriSafetyCheckService({
      visitId: visit._id,
      hospitalId: mockHospitalId,
      user: mockTechnician,
      checklistData: { hasKidneyDisease: true }
    });
    expect(first.requiresDoctorReview).toBe(true);
    expect(first.checklist.passed).toBe(false);
    expect(first.visit.status).toBe('chờ chụp');

    // Bác sĩ xác nhận → được phép vào buồng (vẫn giữ cờ suy thận để theo dõi eGFR)
    const doctor = { id: new mongoose.Types.ObjectId().toString(), hospitalId: mockHospitalId.toString(), role: 'doctor', profile: { fullName: 'BS. Trần Văn A' } };
    const second = await submitMriSafetyCheckService({
      visitId: visit._id,
      hospitalId: mockHospitalId,
      user: doctor,
      checklistData: { hasKidneyDisease: true }
    });
    expect(second.requiresDoctorReview).toBe(false);
    expect(second.checklist.hasKidneyDisease).toBe(true);
  });
});
