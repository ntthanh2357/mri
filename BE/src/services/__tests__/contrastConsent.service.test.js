import mongoose from 'mongoose';
import {
  assessContrastRisk, normalizePatientChecklist, normalizeSignature,
  ensureContrastConsentForVisit, listPatientConsents, submitPatientChecklist, signConsentAsPatient,
} from '../contrastConsent.service.js';
import { ConsentForm } from '../../models/consentForm.model.js';
import { PatientProfile } from '../../models/patientProfile.model.js';
import { tenantStorage } from '../../middlewares/tenant.middleware.js';

describe('Phiếu đồng thuận tiêm cản quang — hàm thuần (UC-PAT-06)', () => {
  it('đánh giá nguy cơ: dị ứng cản quang → cao + chặn; thai/bệnh thận → trung bình; không gì → thấp', () => {
    expect(assessContrastRisk({ contrastAllergy: 'yes' }).isBlocked).toBe(true);
    expect(assessContrastRisk({ contrastAllergy: 'yes' }).riskLevel).toBe('high');
    const mid = assessContrastRisk({ contrastAllergy: 'no', isPregnant: true, kidneyDisease: true });
    expect(mid.riskLevel).toBe('moderate');
    expect(mid.isBlocked).toBe(false);
    expect(mid.riskFactors.length).toBe(2);
    expect(assessContrastRisk({ contrastAllergy: 'no' }).riskLevel).toBe('low');
    expect(assessContrastRisk({ contrastAllergy: 'no', gfrLevel: 25 }).isBlocked).toBe(true);
  });

  it('bảng sàng lọc bệnh nhân: chỉ nhận đáp án hợp lệ, không cho bệnh nhân tự sửa eGFR', () => {
    const { checklist, error } = normalizePatientChecklist({ contrastAllergy: 'unknown', isPregnant: 'true', gfrLevel: 120 });
    expect(error).toBeNull();
    expect(checklist.contrastAllergy).toBe('unknown');
    expect(checklist.isPregnant).toBe(true);
    expect('gfrLevel' in checklist).toBe(false);
    expect(Boolean(normalizePatientChecklist({ contrastAllergy: 'maybe' }).error)).toBe(true);
    expect(Boolean(normalizePatientChecklist({}).error)).toBe(true);
  });

  it('chữ ký vẽ: chỉ nhận đường SVG gồm lệnh M/L và số, có ít nhất 1 nét', () => {
    expect(normalizeSignature({ kind: 'drawn', svgPath: 'M10 20 L30.5 40 L50 45' }).svgPath).toBe('M10 20 L30.5 40 L50 45');
    expect(() => normalizeSignature({ kind: 'drawn', svgPath: 'M10 20' })).toThrow();
    expect(() => normalizeSignature({ kind: 'drawn', svgPath: 'M1 1 L2 2"/><script>' })).toThrow();
    expect(() => normalizeSignature({ kind: 'drawn', svgPath: 'M1 1 L2 2 '.repeat(4000) })).toThrow();
  });

  it('chữ ký gõ tên: bỏ khoảng trắng thừa, 2–80 ký tự; kiểu chữ ký lạ bị từ chối', () => {
    expect(normalizeSignature({ kind: 'typed', text: '  Nguyễn   Văn An ' }).text).toBe('Nguyễn Văn An');
    expect(() => normalizeSignature({ kind: 'typed', text: 'A' })).toThrow();
    expect(() => normalizeSignature({ kind: 'image', text: 'x' })).toThrow();
  });
});

describe('Phiếu đồng thuận tiêm cản quang — quyền bệnh nhân trên DB (UC-PAT-06)', () => {
  const hospitalId = new mongoose.Types.ObjectId();
  const me = new mongoose.Types.ObjectId();
  const other = new mongoose.Types.ObjectId();
  const visitId = new mongoose.Types.ObjectId();
  let consent;

  beforeAll(async () => {
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/neuroscan_test_logic';
    if (mongoose.connection.readyState === 0) await mongoose.connect(mongoUri);
    consent = await ensureContrastConsentForVisit({ _id: visitId, hospitalId, patientId: me });
  });

  afterAll(async () => {
    await ConsentForm.deleteMany({ hospitalId });
    await PatientProfile.deleteMany({ userId: { $in: [me, other] } });
  });

  it('tạo phiếu theo lượt khám không bị trùng khi gọi lại', async () => {
    const again = await ensureContrastConsentForVisit({ _id: visitId, hospitalId, patientId: me });
    expect(String(again._id)).toBe(String(consent._id));
  });

  it('bệnh nhân chỉ thấy phiếu của mình (kể cả khi tài khoản có hospitalId — tenancy chỉ lọc theo viện)', async () => {
    const asPatient = (userId, fn) => tenantStorage.run({ role: 'patient', userId: String(userId), hospitalId: String(hospitalId) }, fn);
    expect((await asPatient(me, () => listPatientConsents(me))).length).toBe(1);
    expect((await asPatient(other, () => listPatientConsents(other))).length).toBe(0);
  });

  it('không cho ký trước khi trả lời bảng sàng lọc; người khác không đụng được phiếu', async () => {
    let status;
    try { await signConsentAsPatient(me, consent._id, { agree: true, signature: { kind: 'typed', text: 'Bệnh nhân A' } }); } catch (e) { status = e.status; }
    expect(status).toBe(409);
    try { await submitPatientChecklist(other, consent._id, { contrastAllergy: 'no' }); status = 200; } catch (e) { status = e.status; }
    expect(status).toBe(404);
  });

  it('nguy cơ cao bị chặn ký tới khi bác sĩ duyệt', async () => {
    const res = await submitPatientChecklist(me, consent._id, { contrastAllergy: 'yes' });
    expect(res.isBlockedByChecklist).toBe(true);
    let status;
    try { await signConsentAsPatient(me, consent._id, { agree: true, signature: { kind: 'typed', text: 'Bệnh nhân A' } }); } catch (e) { status = e.status; }
    expect(status).toBe(409);
  });

  it('bác sĩ đã duyệt: gửi lại đúng câu trả lời cũ không bị chặn lại; đổi câu trả lời thì phải duyệt lại', async () => {
    await ConsentForm.updateOne({ _id: consent._id }, { $set: { isDoctorOverridden: true, isBlockedByChecklist: false } });
    const same = await submitPatientChecklist(me, consent._id, { contrastAllergy: 'yes' });
    expect(same.isDoctorOverridden).toBe(true);
    const changed = await submitPatientChecklist(me, consent._id, { contrastAllergy: 'yes', severeAsthma: true });
    expect(changed.isDoctorOverridden).toBe(false);
    expect(changed.isBlockedByChecklist).toBe(true);
  });

  it('nguy cơ thấp: ký được, lưu chữ ký vào hồ sơ để dùng lại; ký rồi không sửa bảng sàng lọc được', async () => {
    await submitPatientChecklist(me, consent._id, { contrastAllergy: 'no' });
    let status;
    try { await signConsentAsPatient(me, consent._id, { agree: false, signature: { kind: 'typed', text: 'Bệnh nhân A' } }); } catch (e) { status = e.status; }
    expect(status).toBe(400);
    const signed = await signConsentAsPatient(me, consent._id, { agree: true, signature: { kind: 'drawn', svgPath: 'M1 1 L20 20' }, saveSignature: true });
    expect(signed.patientSigned).toBe(true);
    expect(signed.patientSignatureKind).toBe('drawn');
    const profile = await PatientProfile.findOne({ userId: me, hospitalId });
    expect(profile.savedSignature.svgPath).toBe('M1 1 L20 20');
    try { await submitPatientChecklist(me, consent._id, { contrastAllergy: 'no' }); status = 200; } catch (e) { status = e.status; }
    expect(status).toBe(409);
  });
});
