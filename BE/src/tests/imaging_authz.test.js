import mongoose from 'mongoose';
import router from '../modules/imaging/imaging.routes.js';
import { updateImagingResult } from '../modules/imaging/imaging.controller.js';
import { ImagingResult } from '../modules/imaging/models/imagingResult.model.js';

// Middleware phân quyền của route (đứng sau `protect`): trả 'next' nếu cho qua, mã HTTP nếu chặn
const guardOf = (method, path) => {
  const layer = router.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
  if (!layer) throw new Error(`Không tìm thấy route ${method.toUpperCase()} ${path}`);
  if (layer.route.stack.length < 3) throw new Error(`Route ${method.toUpperCase()} ${path} không có bước phân quyền role`);
  return layer.route.stack[1].handle;
};
const run = (mw, user) => new Promise((resolve) => {
  const res = { status(code) { this.code = code; return this; }, json() { resolve(this.code); return this; } };
  mw({ user, params: {} }, res, () => resolve('next'));
});

const makeRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};

describe('Phân quyền báo cáo chẩn đoán hình ảnh (P0-2 / P0-3)', () => {
  let hospitalId;
  let doctor;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/neuroscan_test_logic');
    }
    hospitalId = new mongoose.Types.ObjectId();
    doctor = {
      id: new mongoose.Types.ObjectId().toString(),
      hospitalId: hospitalId.toString(),
      role: 'doctor',
      profile: { fullName: 'BS. CĐHA Nguyễn Văn Ký' },
      email: 'bs.ky@benhvien.vn'
    };
  });

  afterAll(async () => {
    await ImagingResult.deleteMany({ hospitalId });
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });

  it('chỉ bác sĩ được gọi PUT /api/v1/imaging/:id để đọc & ký báo cáo', async () => {
    const guard = guardOf('put', '/:id');
    expect(await run(guard, { id: 'u1', role: 'patient', hospitalId: 'h1' })).toBe(403);
    expect(await run(guard, { id: 'u2', role: 'nurse', hospitalId: 'h1' })).toBe(403);
    expect(await run(guard, { id: 'u3', role: 'technician', hospitalId: 'h1' })).toBe(403);
    expect(await run(guard, { id: 'u4', role: 'hospital_admin', hospitalId: 'h1' })).toBe(403);
    expect(await run(guard, { id: 'u5', role: 'doctor', hospitalId: 'h1' })).toBe('next');
  });

  it('bệnh nhân không được tạo kết quả CĐHA (POST /api/v1/imaging)', async () => {
    const guard = guardOf('post', '/');
    expect(await run(guard, { id: 'p1', role: 'patient', hospitalId: 'h1' })).toBe(403);
    expect(await run(guard, { id: 'r1', role: 'receptionist', hospitalId: 'h1' })).toBe(403);
    expect(await run(guard, { id: 't1', role: 'technician', hospitalId: 'h1' })).toBe('next');
    expect(await run(guard, { id: 'd1', role: 'doctor', hospitalId: 'h1' })).toBe('next');
  });

  it('bệnh nhân/điều dưỡng không được upload ảnh hay gói DICOM (POST /api/v1/imaging/upload)', async () => {
    const guard = guardOf('post', '/upload');
    expect(await run(guard, { id: 'p1', role: 'patient', hospitalId: 'h1' })).toBe(403);
    expect(await run(guard, { id: 'n1', role: 'nurse', hospitalId: 'h1' })).toBe(403);
    expect(await run(guard, { id: 't1', role: 'technician', hospitalId: 'h1' })).toBe('next');
  });

  it('báo cáo đã ký là bất biến: sửa lại bị từ chối 409 và nội dung không đổi', async () => {
    const signed = await ImagingResult.create({
      hospitalId,
      medicalId: 'BN-SIGNED-01',
      patientName: 'Bệnh nhân đã ký',
      gender: 'Nam',
      orderDate: new Date('2026-10-20'),
      procedure: 'MRI sọ não',
      imagingType: 'MRI',
      findings: 'Không thấy tổn thương',
      conclusion: 'Bình thường',
      radiologist: 'BS. CĐHA Nguyễn Văn Ký',
      reportDate: new Date('2026-10-20'),
      isSigned: true,
      signedBy: doctor.id,
      signedAt: new Date('2026-10-20')
    });

    const res = makeRes();
    await updateImagingResult(
      { params: { id: signed._id.toString() }, user: doctor, body: { conclusion: 'Có u não ác tính' } },
      res
    );

    expect(res.statusCode).toBe(409);
    const stored = await ImagingResult.findById(signed._id);
    expect(stored.conclusion).toBe('Bình thường');
  });

  it('bác sĩ ký báo cáo: tên lấy từ tài khoản, không nhận CA/chứng thư giả từ client', async () => {
    const draft = await ImagingResult.create({
      hospitalId,
      medicalId: 'BN-DRAFT-01',
      patientName: 'Bệnh nhân nháp',
      gender: 'Nữ',
      orderDate: new Date('2026-10-21'),
      procedure: 'MRI sọ não',
      imagingType: 'MRI',
      findings: 'Tổn thương giảm tín hiệu thùy trán',
      conclusion: 'Theo dõi u thần kinh đệm',
      radiologist: 'Chờ bác sĩ CĐHA đọc & ký duyệt',
      reportDate: new Date('2026-10-21')
    });

    const res = makeRes();
    await updateImagingResult(
      {
        params: { id: draft._id.toString() },
        user: doctor,
        body: {
          conclusion: 'U thần kinh đệm độ thấp, cần hội chẩn',
          radiologist: 'BS. Giả Mạo',
          certificateSerial: 'FAKE-CERT-123',
          caProvider: 'VNPT-CA',
          signatureType: 'pki_token'
        }
      },
      res
    );

    expect(res.statusCode).toBe(200);
    const stored = await ImagingResult.findById(draft._id);
    expect(stored.isSigned).toBe(true);
    expect(stored.radiologist).toBe('BS. CĐHA Nguyễn Văn Ký');
    expect(stored.digitalSignatureMetadata.certificateSerial).toBe(null);
    expect(stored.digitalSignatureMetadata.caProvider).toBe('NONE');
    expect(stored.digitalSignatureMetadata.signatureType).toBe('internal_hash');
  });
});
