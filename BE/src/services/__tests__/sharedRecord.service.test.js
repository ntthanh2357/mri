import mongoose from 'mongoose';
import { toSharedEmr, toSharedImaging, toSharedSafety, buildSharedRecord, SHARE_SECTIONS } from '../sharedRecord.service.js';
import { User } from '../../models/user.model.js';
import { Prescription } from '../../models/prescription.model.js';
import { PatientProfile } from '../../models/patientProfile.model.js';
import { ScannedDocument } from '../../models/scannedDocument.model.js';

describe('Bệnh án chia sẻ qua QR — chỉ gửi nhóm bệnh nhân đã chọn', () => {
  const pid = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/neuroscan_test_logic';
    if (mongoose.connection.readyState === 0) await mongoose.connect(mongoUri);
    // ghi thẳng collection (bỏ qua validate/tenancy) — chỉ cần dữ liệu tối thiểu
    await User.collection.insertOne({ _id: pid, role: 'patient', email: `share-${pid}@test.local`, profile: { name: 'BN Test', gender: 'Nam' } });
    await Prescription.collection.insertOne({ patient_id: pid, diagnosis: 'Đau đầu', drugs: [], recorded_at: new Date() });
    await PatientProfile.collection.insertOne({ userId: pid, drugAllergies: ['Penicillin'] });
    await ScannedDocument.create([
      { patientId: pid, title: 'Đơn thuốc ngoài', text: 'Amlodipin 5mg', fileId: 'file-ok', mimeType: 'image/jpeg', confirmedAt: new Date() },
      { patientId: pid, title: 'Bản nháp', text: 'chưa kiểm tra', fileId: 'file-draft', mimeType: 'image/jpeg' },
    ]);
  });

  afterAll(async () => {
    await User.collection.deleteOne({ _id: pid });
    await Prescription.collection.deleteMany({ patient_id: pid });
    await PatientProfile.collection.deleteMany({ userId: pid });
    await ScannedDocument.deleteMany({ patientId: pid });
  });

  it('chỉ chọn Phim: không có đơn thuốc, dị ứng; thông tin cơ bản vẫn có', async () => {
    const r = await buildSharedRecord(pid, ['imaging']);
    expect(r.sections).toEqual(['imaging']);
    expect(r.patient.name).toBe('BN Test');
    expect(Array.isArray(r.imaging)).toBe(true);
    for (const k of ['prescriptions', 'safety', 'visits', 'labs', 'vitals', 'inpatientRecords', 'dischargePapers', 'transferForms', 'scannedDocuments']) {
      expect(k in r).toBe(false);
    }
    expect(JSON.stringify(r).includes('Penicillin')).toBe(false);
  });

  it('chọn Giấy tờ tự quét: chỉ giấy tờ đã kiểm tra, ảnh qua link ngắn hạn, không lộ mã file nội bộ', async () => {
    const r = await buildSharedRecord(pid, ['documents']);
    expect(r.scannedDocuments.length).toBe(1);
    expect(r.scannedDocuments[0].title).toBe('Đơn thuốc ngoài');
    expect(r.scannedDocuments[0].imageUrl.startsWith('/api/v1/shared-records/document-image/')).toBe(true);
    const json = JSON.stringify(r);
    expect(json.includes('file-ok') || json.includes('Bản nháp')).toBe(false);
  });

  it('lượt chia sẻ đã chốt danh sách giấy tờ: chỉ trả đúng giấy tờ đó; bản nháp không lọt dù có trong danh sách', async () => {
    const [ok, draft] = await Promise.all(['Đơn thuốc ngoài', 'Bản nháp'].map((title) => ScannedDocument.findOne({ patientId: pid, title }).lean()));
    expect((await buildSharedRecord(pid, ['documents'], { documentIds: [ok._id] })).scannedDocuments.length).toBe(1);
    expect((await buildSharedRecord(pid, ['documents'], { documentIds: [] })).scannedDocuments.length).toBe(0);
    expect((await buildSharedRecord(pid, ['documents'], { documentIds: [draft._id] })).scannedDocuments.length).toBe(0);
  });

  it('không truyền nhóm: đủ tất cả nhóm như trước', async () => {
    const r = await buildSharedRecord(pid);
    expect(r.sections).toEqual(SHARE_SECTIONS);
    expect(r.scannedDocuments.length).toBe(1);
    expect(r.prescriptions.length).toBe(1);
    expect(r.safety.drugAllergies[0]).toBe('Penicillin');
  });
});

describe('Bệnh án chia sẻ qua QR — lọc dữ liệu (UC-PAT-09)', () => {
  it('bệnh án nội trú: bỏ ghi chú tâm thần, HIV, di truyền và dữ liệu ký số nội bộ', () => {
    const shared = toSharedEmr({
      _id: 'r1', diagnosis: 'U màng não', treatmentPlan: 'Phẫu thuật', psychiatricNotes: 'x', hivStatusNotes: 'y', geneticNotes: 'z',
      digitalSignatureMetadata: { signedHash: 'abc' }, dicomIntegrityHash: 'h', legalHold: true,
    }, { careSheets: [{ pulse: 80 }], consultations: [] });
    const json = JSON.stringify(shared);
    expect(shared.diagnosis).toBe('U màng não');
    expect(shared.careSheets.length).toBe(1);
    for (const k of ['psychiatricNotes', 'hivStatusNotes', 'geneticNotes', 'digitalSignatureMetadata', 'dicomIntegrityHash', 'legalHold']) {
      expect(json.includes(k)).toBe(false);
    }
  });

  it('phim chụp: chỉ lấy phim đã ký, giữ ảnh và kết luận bác sĩ', () => {
    expect(toSharedImaging({ isSigned: false, conclusion: 'x' })).toBeNull();
    const img = toSharedImaging({ isSigned: true, procedure: 'MRI sọ não', conclusion: 'Không thấy khối choán chỗ', images: ['/uploads/a.jpg'], storageFileId: 'drive-id', aiJobId: 'job' });
    expect(img.conclusion).toBe('Không thấy khối choán chỗ');
    expect(img.images.length).toBe(1);
    expect('storageFileId' in img).toBe(false);
    expect('aiJobId' in img).toBe(false);
  });

  it('thông tin an toàn: chỉ dị ứng thuốc và liên hệ khẩn cấp, không lộ CCCD/thẻ BHYT', () => {
    const s = toSharedSafety({ drugAllergies: ['Penicillin'], emergencyContact: { name: 'Lan', relation: 'Mẹ', phone: '0905' }, citizenIdEnc: 'v1:x', bhytDeclared: { cardNumberEnc: 'v1:y' } });
    expect(s.drugAllergies[0]).toBe('Penicillin');
    expect(s.emergencyContact.name).toBe('Lan');
    const json = JSON.stringify(s);
    expect(json.includes('citizen') || json.includes('bhyt') || json.includes('v1:')).toBe(false);
  });
});
