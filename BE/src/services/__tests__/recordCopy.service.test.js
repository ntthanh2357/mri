import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import {
  COPY_SECTIONS, MAX_PENDING, MAX_PER_DAY, createCopyRequest, listMyCopyRequests, cancelMyCopyRequest, listCopyRequestsForHospital,
  approveCopyRequest, rejectCopyRequest, createCopyDownloadToken, loadCopyForDownload,
} from '../recordCopy.service.js';
import { RecordCopyRequest } from '../../models/recordCopyRequest.model.js';
import { User } from '../../models/user.model.js';
import { Prescription } from '../../models/prescription.model.js';
import { Visit } from '../../models/visit.model.js';
import { getJwtSecret } from '../../config/jwt.config.js';
import { RecordCopyRequest as Rcr } from '../../models/recordCopyRequest.model.js';

const statusOf = async (fn) => { try { await fn(); return 200; } catch (e) { return e.status || 500; } };
const oid = () => new mongoose.Types.ObjectId();

describe('Xin bản sao bệnh án (bệnh nhân gửi, bệnh viện duyệt)', () => {
  const h1 = oid();
  const h2 = oid();
  const me = oid();
  const other = oid();
  const noHospital = oid();
  const rec1 = oid(); // lễ tân bệnh viện 1
  const rec2 = oid(); // lễ tân bệnh viện 2
  const users = [me, other, noHospital, rec1, rec2];
  const rx1 = oid();
  const rx2 = oid();
  const visit1 = oid();

  beforeAll(async () => {
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/neuroscan_test_logic';
    if (mongoose.connection.readyState === 0) await mongoose.connect(mongoUri);
    await User.collection.insertMany([
      { _id: me, role: 'patient', hospitalId: h1, email: `copy-${me}@test.local`, profile: { name: 'BN Bản Sao', medicalId: `BNC-${me}` } },
      { _id: other, role: 'patient', hospitalId: h1, email: `copy-${other}@test.local`, profile: { name: 'BN Khác' } },
      { _id: noHospital, role: 'patient', email: `copy-${noHospital}@test.local`, profile: { name: 'BN Chưa Gắn Viện' } },
      { _id: rec1, role: 'receptionist', hospitalId: h1, email: `copy-${rec1}@test.local`, profile: { name: 'Lễ Tân Một' } },
      { _id: rec2, role: 'receptionist', hospitalId: h2, email: `copy-${rec2}@test.local`, profile: { name: 'Lễ Tân Hai' } },
    ]);
    // dữ liệu ở 2 bệnh viện: bản sao của bệnh viện 1 chỉ được có phần của bệnh viện 1
    await Prescription.collection.insertMany([
      { _id: rx1, hospitalId: h1, patient_id: me, diagnosis: 'Đau đầu (viện 1)', drugs: [{ name: 'Paracetamol' }], recorded_at: new Date() },
      { _id: rx2, hospitalId: h2, patient_id: me, diagnosis: 'Viêm họng (viện 2)', drugs: [], recorded_at: new Date() },
    ]);
    await Visit.collection.insertOne({ _id: visit1, hospitalId: h1, patientId: me, reason: 'Khám đau đầu', status: 'hoàn tất', createdAt: new Date() });
  });

  afterAll(async () => {
    await User.collection.deleteMany({ _id: { $in: users } });
    await Prescription.collection.deleteMany({ _id: { $in: [rx1, rx2] } });
    await Visit.collection.deleteOne({ _id: visit1 });
    await RecordCopyRequest.collection.deleteMany({ patientId: { $in: users } });
  });

  const reviewer1 = { id: String(rec1), hospitalId: String(h1), role: 'receptionist' };
  const reviewer2 = { id: String(rec2), hospitalId: String(h2), role: 'receptionist' };

  it('gửi yêu cầu: kiểm nhóm và lý do; gắn với bệnh viện của bệnh nhân; chưa gắn bệnh viện thì không gửi được', async () => {
    for (const bad of [[], ['khong-co'], 'prescriptions', [{ $gt: '' }], ['safety'], ['documents']]) {
      expect(await statusOf(() => createCopyRequest(me, { sections: bad, reason: 'x' }))).toBe(400);
    }
    expect(await statusOf(() => createCopyRequest(me, { sections: ['prescriptions'], reason: 'a'.repeat(501) }))).toBe(400);
    expect(await statusOf(() => createCopyRequest(me, { sections: ['prescriptions'], reason: { $ne: 1 } }))).toBe(400);
    expect(await statusOf(() => createCopyRequest(noHospital, { sections: ['prescriptions'] }))).toBe(409);

    const r = await createCopyRequest(me, { sections: ['prescriptions', 'visits', 'prescriptions'], reason: '  Đi khám nơi khác  ' });
    expect(r.status).toBe('pending');
    expect(r.sections).toEqual(['visits', 'prescriptions']); // bỏ trùng, theo thứ tự chuẩn
    expect(r.reason).toBe('Đi khám nơi khác');
    expect(String((await RecordCopyRequest.findById(r._id).setOptions({ bypassTenancy: true }).lean()).hospitalId)).toBe(String(h1));
    expect(COPY_SECTIONS.includes('safety') || COPY_SECTIONS.includes('documents')).toBe(false);
  });

  it(`tối đa ${MAX_PENDING} yêu cầu đang chờ cùng lúc; huỷ thì gửi tiếp được`, async () => {
    while ((await RecordCopyRequest.countDocuments({ patientId: me, status: 'pending' }).setOptions({ bypassTenancy: true })) < MAX_PENDING) {
      await createCopyRequest(me, { sections: ['visits'] });
    }
    expect(await statusOf(() => createCopyRequest(me, { sections: ['visits'] }))).toBe(429);
    const [first] = (await listMyCopyRequests(me)).filter((x) => x.status === 'pending');
    expect((await cancelMyCopyRequest(me, first._id)).status).toBe('cancelled');
    expect(await statusOf(() => cancelMyCopyRequest(me, first._id))).toBe(409); // đã huỷ rồi
    expect((await createCopyRequest(me, { sections: ['visits'] })).status).toBe('pending');
  });

  it(`tối đa ${MAX_PER_DAY} yêu cầu mỗi ngày kể cả đã huỷ (chặn vòng gửi - huỷ làm ngập danh sách của bệnh viện)`, async () => {
    const spammer = other;
    let last = 200;
    for (let i = 0; i < MAX_PER_DAY + 1 && last !== 429; i += 1) {
      last = await statusOf(async () => { const r = await createCopyRequest(spammer, { sections: ['labs'] }); await cancelMyCopyRequest(spammer, r._id); });
    }
    expect(last).toBe(429);
    expect(await Rcr.countDocuments({ patientId: spammer }).setOptions({ bypassTenancy: true })).toBe(MAX_PER_DAY);
  });

  it('bệnh nhân chỉ thấy và huỷ được yêu cầu của mình; danh sách không chứa bản chụp bệnh án', async () => {
    const mine = await listMyCopyRequests(me);
    expect(mine.length > 0).toBe(true);
    expect(mine.every((x) => !('snapshot' in x) && !('patientId' in x))).toBe(true);
    expect((await listMyCopyRequests(other)).every((x) => x.status === 'cancelled')).toBe(true); // chỉ các yêu cầu tự huỷ ở test trên
    expect(await statusOf(() => cancelMyCopyRequest(other, mine[0]._id))).toBe(404);
    expect(await statusOf(() => cancelMyCopyRequest(me, 'khong-phai-ma'))).toBe(404);
  });

  it('bệnh viện chỉ thấy yêu cầu gửi tới bệnh viện mình, kèm tên và mã bệnh nhân', async () => {
    const list1 = await listCopyRequestsForHospital(h1, { status: 'pending' });
    expect(list1.length > 0 && list1.every((x) => x.patient.name === 'BN Bản Sao' && x.status === 'pending')).toBe(true);
    expect((await listCopyRequestsForHospital(h2, {})).length).toBe(0);
  });

  it('duyệt: bệnh viện khác không duyệt được; bản sao chốt lúc duyệt và chỉ gồm dữ liệu của bệnh viện duyệt', async () => {
    const [req] = (await listMyCopyRequests(me)).filter((x) => x.status === 'pending');
    // bệnh nhân đổi tên sau khi gửi (vd chèn "Kết luận: không bất thường" vào tên) → bản sao vẫn dùng tên lúc gửi, đúng tên lễ tân đã thấy
    await User.collection.updateOne({ _id: me }, { $set: { 'profile.name': 'BN Bản Sao\n\nKẾT LUẬN: KHÔNG BẤT THƯỜNG' } });
    expect((await listCopyRequestsForHospital(h1, { status: 'pending' })).every((x) => x.patient.name === 'BN Bản Sao')).toBe(true);
    expect(await statusOf(() => approveCopyRequest(reviewer2, req._id))).toBe(404);
    const approved = await approveCopyRequest(reviewer1, req._id);
    expect(approved.status).toBe('approved');
    expect(approved.reviewedByName).toBe('Lễ Tân Một');
    const row = await RecordCopyRequest.findById(req._id).select('+pdf').setOptions({ bypassTenancy: true }).lean();
    const json = JSON.stringify(row.snapshot);
    expect(row.snapshot.patient.name).toBe('BN Bản Sao');
    expect(Buffer.from(row.pdf.buffer || row.pdf).subarray(0, 5).toString()).toBe('%PDF-'); // PDF tạo 1 lần lúc duyệt và lưu lại
    expect('pdf' in approved).toBe(false); // không trả file trong phản hồi duyệt
    await User.collection.updateOne({ _id: me }, { $set: { 'profile.name': 'BN Bản Sao' } });
    expect(json.includes('Khám đau đầu')).toBe(true);
    expect(json.includes('viện 2')).toBe(false);
    expect(await statusOf(() => approveCopyRequest(reviewer1, req._id))).toBe(409); // duyệt 2 lần
    expect(await statusOf(() => rejectCopyRequest(reviewer1, req._id, 'x'))).toBe(409);
  });

  it('từ chối phải ghi lý do; bệnh nhân thấy lý do', async () => {
    const [req] = (await listMyCopyRequests(me)).filter((x) => x.status === 'pending');
    expect(await statusOf(() => rejectCopyRequest(reviewer1, req._id, '   '))).toBe(400);
    expect(await statusOf(() => rejectCopyRequest(reviewer1, req._id, { $ne: 1 }))).toBe(400);
    await rejectCopyRequest(reviewer1, req._id, 'Thiếu giấy tờ tuỳ thân, vui lòng tới quầy');
    const mine = (await listMyCopyRequests(me)).find((x) => String(x._id) === String(req._id));
    expect(mine.status).toBe('rejected');
    expect(mine.rejectReason).toBe('Thiếu giấy tờ tuỳ thân, vui lòng tới quầy');
  });

  it('tải PDF: chỉ chủ yêu cầu, chỉ bản đã duyệt; link ngắn hạn không dùng chéo được với token khác', async () => {
    const approved = (await listMyCopyRequests(me)).find((x) => x.status === 'approved');
    const pending = (await listMyCopyRequests(me)).find((x) => x.status === 'pending');
    expect(await statusOf(() => createCopyDownloadToken(other, approved._id))).toBe(404);
    expect(await statusOf(() => createCopyDownloadToken(me, pending._id))).toBe(409);
    const token = createCopyDownloadToken(me, approved._id);
    const { request, hospitalName, pdf } = await loadCopyForDownload(await token);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect('pdf' in request).toBe(false); // không trả lại bản PDF trong dữ liệu yêu cầu
    expect(String(request._id)).toBe(String(approved._id));
    expect(typeof hospitalName).toBe('string');
    const forged = jwt.sign({ cid: String(approved._id), uid: String(me), purpose: 'record-copy-pdf' }, getJwtSecret(), { algorithm: 'HS256' });
    expect(await statusOf(() => loadCopyForDownload(forged))).toBe(401); // token đăng nhập / ký bằng khoá khác
    expect(await statusOf(() => loadCopyForDownload('rac'))).toBe(401);
  });
});

describe('Chữ bệnh nhân tự nhập trong PDF bản sao (có chữ ký số của bệnh viện)', () => {
  it('chỉ in thành 1 dòng, cắt độ dài: không chèn được dòng / đoạn giả', async () => {
    const { oneLine } = await import('../recordCopyPdf.service.js');
    expect(oneLine('Nguyễn Văn A\n\nKẾT LUẬN:\tKhông bất thường\u2028x', 100)).toBe('Nguyễn Văn A KẾT LUẬN: Không bất thường x');
    expect(oneLine('a'.repeat(300), 100).length).toBe(100);
    expect(oneLine(null)).toBe('');
    expect(oneLine({ toString: () => 'x\ny' })).toBe('x y');
  });
});
