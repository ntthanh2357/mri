import mongoose from 'mongoose';
import { createShare, listShares, redeemQr, resolveViewer, itemCountsOf } from '../recordShare.service.js';
import { buildSharedRecord, buildShareCatalog, resolveShareItems, MAX_ITEMS_PER_SECTION } from '../sharedRecord.service.js';
import { User } from '../../models/user.model.js';
import { Visit } from '../../models/visit.model.js';
import { VitalSign } from '../../models/vitalSign.model.js';
import { LabOrder } from '../../models/labOrder.model.js';
import { Prescription } from '../../models/prescription.model.js';
import { DischargePaper } from '../../models/dischargePaper.model.js';
import { TransferForm } from '../../models/transferForm.model.js';
import { ImagingResult } from '../../models/imagingResult.model.js';
import { PatientProfile } from '../../models/patientProfile.model.js';
import { MedicalRecord } from '../../modules/emr/models/medicalRecord.model.js';
import { RecordShare } from '../../models/recordShare.model.js';
import { ScannedDocument } from '../../models/scannedDocument.model.js';

const statusOf = async (fn) => { try { await fn(); return 200; } catch (e) { return e.status || 500; } };
const oid = () => new mongoose.Types.ObjectId();

describe('Chia sẻ bệnh án qua QR — chọn từng mục trong mỗi nhóm (UC-PAT-09)', () => {
  const hospitalId = oid();
  // mã cố định để lần chạy sau dọn được dữ liệu của lần chạy bị dừng giữa chừng
  const me = new mongoose.Types.ObjectId('6f0000000000000000000a01');
  const other = new mongoose.Types.ObjectId('6f0000000000000000000a02');
  const t0 = new Date('2026-10-13T08:00:00Z');
  const day = (n) => new Date(t0.getTime() - n * 24 * 3600 * 1000);
  // mã của từng mục, đặt sẵn để test đọc cho dễ
  const id = {
    rxOld: oid(), rxNew: oid(), rxForeign: oid(), lab1: oid(), lab2: oid(), visit1: oid(), visit2: oid(),
    vital1: oid(), vital2: oid(), vital3: oid(), film1: oid(), film2: oid(), filmUnsigned: oid(), filmForeign: oid(),
    emr1: oid(), emr2: oid(), discharge1: oid(), transfer1: oid(), transfer2: oid(),
  };
  const s = (x) => String(x);
  let doc1, doc2;

  const cleanup = async () => {
    const both = { $in: [me, other] };
    await User.collection.deleteMany({ _id: both });
    await PatientProfile.collection.deleteMany({ userId: both });
    await Prescription.collection.deleteMany({ patient_id: both });
    await LabOrder.collection.deleteMany({ patient_id: both });
    await Visit.collection.deleteMany({ patientId: both });
    await VitalSign.collection.deleteMany({ patient_id: both });
    await ImagingResult.collection.deleteMany({ medicalId: { $in: [`MID-${me}`, `MID-${other}`] } });
    await MedicalRecord.collection.deleteMany({ patientId: { $in: [s(me), s(other)] } });
    await DischargePaper.collection.deleteMany({ patient_id: both });
    await TransferForm.collection.deleteMany({ patient_id: both });
    await ScannedDocument.deleteMany({ patientId: both });
    await RecordShare.deleteMany({ patientId: both });
  };

  beforeAll(async () => {
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/neuroscan_test_logic';
    if (mongoose.connection.readyState === 0) await mongoose.connect(mongoUri);
    await cleanup();
    // ghi thẳng collection (bỏ qua validate/tenancy): chỉ cần dữ liệu tối thiểu
    await User.collection.insertMany([
      { _id: me, role: 'patient', hospitalId, email: `items-${me}@test.local`, profile: { name: 'BN Chọn Mục', medicalId: `MID-${me}` } },
      { _id: other, role: 'patient', hospitalId, email: `items-${other}@test.local`, profile: { name: 'BN Khác', medicalId: `MID-${other}` } },
    ]);
    await PatientProfile.collection.insertOne({ userId: me, drugAllergies: ['Penicillin'], emergencyContact: { name: 'Trần Thị B', relation: 'Vợ', phone: '0900000001' } });
    await Prescription.collection.insertMany([
      { _id: id.rxOld, patient_id: me, diagnosis: 'Đau đầu', doctor_name: 'BS An', drugs: [{ name: 'Paracetamol 500mg' }], recorded_at: day(400) },
      { _id: id.rxNew, patient_id: me, diagnosis: 'Tăng huyết áp', doctor_name: 'BS Bình', drugs: [{ name: 'Amlodipin 5mg' }], recorded_at: day(3) },
      { _id: id.rxForeign, patient_id: other, diagnosis: 'Bí mật của người khác', drugs: [], recorded_at: day(1) },
    ]);
    await LabOrder.collection.insertMany([
      { _id: id.lab1, patient_id: me, barcode: `T-${id.lab1}`, category: 'Sinh hoá máu', status: 'RESULTED', ordered_at: day(10), results: [{ biomarker_name: 'Glucose', value_result: '6,8' }] },
      { _id: id.lab2, patient_id: me, barcode: `T-${id.lab2}`, category: 'Huyết học', status: 'RESULTED', ordered_at: day(5), results: [] },
    ]);
    await Visit.collection.insertMany([
      { _id: id.visit1, hospitalId, patientId: me, reason: 'Đau đầu kéo dài', createdAt: day(20) },
      { _id: id.visit2, hospitalId, patientId: me, reason: 'Tái khám', createdAt: day(2) },
    ]);
    await VitalSign.collection.insertMany([
      { _id: id.vital1, patient_id: me, pulse: 70, blood_pressure: '120/80', recorded_at: day(30) },
      { _id: id.vital2, patient_id: me, pulse: 88, blood_pressure: '150/95', recorded_at: day(8) },
      { _id: id.vital3, patient_id: me, pulse: 72, blood_pressure: '125/82', recorded_at: day(1) },
    ]);
    await ImagingResult.collection.insertMany([
      { _id: id.film1, hospitalId, medicalId: `MID-${me}`, isSigned: true, procedure: 'MRI sọ não', conclusion: 'Không thấy bất thường', reportDate: day(15) },
      { _id: id.film2, hospitalId, medicalId: `MID-${me}`, isSigned: true, procedure: 'CT ngực', conclusion: 'Nốt mờ nhỏ', reportDate: day(6) },
      { _id: id.filmUnsigned, hospitalId, medicalId: `MID-${me}`, isSigned: false, procedure: 'MRI chưa ký', reportDate: day(1) },
      { _id: id.filmForeign, hospitalId, medicalId: `MID-${other}`, isSigned: true, procedure: 'Phim của người khác', reportDate: day(1) },
    ]);
    await MedicalRecord.collection.insertMany([
      { _id: id.emr1, hospitalId, patientId: s(me), department: 'Ngoại thần kinh', diagnosis: 'U màng não', psychiatricNotes: 'KHÔNG ĐƯỢC LỘ', createdAt: day(60) },
      { _id: id.emr2, hospitalId, patientId: s(me), department: 'Nội tim mạch', diagnosis: 'Tăng huyết áp', createdAt: day(12) },
    ]);
    await DischargePaper.collection.insertOne({ _id: id.discharge1, hospitalId, patient_id: me, diagnosis: 'U màng não', dateOut: day(50), recorded_at: day(50) });
    await TransferForm.collection.insertMany([
      { _id: id.transfer1, hospitalId, patient_id: me, transferTo: 'Bệnh viện Chợ Rẫy', diagnosis: 'U màng não', recorded_at: day(55) },
      { _id: id.transfer2, hospitalId, patient_id: me, transferTo: 'Bệnh viện Đà Nẵng', diagnosis: 'Tăng huyết áp', recorded_at: day(11) },
    ]);
    [doc1, doc2] = await ScannedDocument.create([
      { patientId: me, title: 'Đơn thuốc phòng khám tư', text: 'Losartan 50mg', fields: { facility: 'Phòng khám Hoà Khánh' }, fileId: 'fi-1', mimeType: 'image/jpeg', confirmedAt: day(4) },
      { patientId: me, title: 'Kết quả siêu âm', text: 'Gan nhiễm mỡ độ 1', fileId: 'fi-2', mimeType: 'image/jpeg', confirmedAt: day(2) },
      { patientId: me, title: 'Bản nháp chưa kiểm tra', text: 'x', fileId: 'fi-3', mimeType: 'image/jpeg' },
    ]);
  });

  afterAll(cleanup);

  const view = async (sections, items) => {
    const { share, qrToken } = await createShare(me, hospitalId, t0, sections, undefined, items);
    const { viewerToken } = await redeemQr(qrToken, { now: t0 });
    const v = await resolveViewer(viewerToken, { now: t0 });
    return { share, record: await buildSharedRecord(v.patientId, v.sections, { shareId: v.shareId, documentIds: v.documentIds, itemIds: v.itemIds }) };
  };

  it('danh mục để chọn: liệt kê từng mục của cả 9 nhóm kèm tên, ngày, nguồn và từ khoá tìm kiếm; chỉ của chính bệnh nhân', async () => {
    const { items } = await buildShareCatalog(me);
    const of = (section) => items.filter((x) => x.section === section);
    expect(of('prescriptions').map((x) => x.id).sort()).toEqual([s(id.rxOld), s(id.rxNew)].sort());
    expect(of('labs').length).toBe(2);
    expect(of('visits').length).toBe(2);
    expect(of('vitals').length).toBe(3);
    expect(of('imaging').map((x) => x.id).sort()).toEqual([s(id.film1), s(id.film2)].sort()); // phim chưa ký không chia sẻ được nên không liệt kê
    expect(of('inpatient').length).toBe(2);
    expect(of('papers').length).toBe(3); // 1 giấy ra viện + 2 giấy chuyển viện
    expect(of('documents').map((x) => x.id).sort()).toEqual([s(doc1._id), s(doc2._id)].sort()); // bản nháp không có
    expect(of('safety').map((x) => x.id)).toEqual(['allergies', 'emergencyContact']);

    const rx = items.find((x) => x.id === s(id.rxNew));
    expect(rx.title).toBe('Đơn thuốc');
    expect(rx.keywords.includes('amlodipin')).toBe(true); // tìm được theo tên thuốc
    expect(rx.keywords.includes('bs bình')).toBe(true);
    expect(new Date(rx.date).getTime()).toBe(day(3).getTime());
    expect(rx.source).toBe('hospital');
    expect(of('documents')[0].source).toBe('self');
    expect(of('safety')[0].source).toBe('self');
    expect(items.find((x) => x.id === s(id.lab1)).keywords.includes('glucose')).toBe(true);
    expect(items.find((x) => x.id === s(id.transfer1)).keywords.includes('chợ rẫy')).toBe(true);

    const json = JSON.stringify(items);
    for (const leak of ['Bí mật của người khác', 'Phim của người khác', 'KHÔNG ĐƯỢC LỘ', 'MRI chưa ký', 'fi-1', 'Bản nháp']) expect(json.includes(leak)).toBe(false);
    expect((await buildShareCatalog(other)).items.some((x) => x.id === s(id.rxNew))).toBe(false);
  });

  it('chọn 1 trong 2 đơn thuốc: người xem chỉ nhận đúng đơn đó và được báo là nhóm này không đầy đủ', async () => {
    const { share, record } = await view(['prescriptions', 'labs'], { prescriptions: [s(id.rxNew)] });
    expect(record.prescriptions.length).toBe(1);
    expect(record.prescriptions[0].diagnosis).toBe('Tăng huyết áp');
    expect(JSON.stringify(record).includes('Đau đầu')).toBe(false);
    expect(record.labs.length).toBe(2); // nhóm không kèm danh sách = cả nhóm như trước
    expect(record.partial).toEqual(['prescriptions']);
    const listed = (await listShares(me, t0)).find((x) => s(x._id) === s(share._id));
    expect(listed.itemCounts).toEqual({ prescriptions: 1 });
    expect(itemCountsOf(share)).toEqual({ prescriptions: 1 }); // phản hồi lúc tạo mã dùng bản ghi vừa tạo (document, không phải object thường)
    expect(itemCountsOf({})).toEqual({});
  });

  it('mọi nhóm đều lọc được theo mục: lượt khám, phim, xét nghiệm, sinh hiệu, nội trú, giấy ra/chuyển viện, giấy tờ tự quét', async () => {
    const { record } = await view(['visits', 'imaging', 'labs', 'vitals', 'inpatient', 'papers', 'documents'], {
      visits: [s(id.visit2)], imaging: [s(id.film2)], labs: [s(id.lab1)], vitals: [s(id.vital2), s(id.vital3)],
      inpatient: [s(id.emr2)], papers: [s(id.transfer2)], documents: [s(doc2._id)],
    });
    expect(record.visits.map((v) => v.reason)).toEqual(['Tái khám']);
    expect(record.imaging.map((f) => f.procedure)).toEqual(['CT ngực']);
    expect(record.labs.map((l) => l.category)).toEqual(['Sinh hoá máu']);
    expect(record.vitals.map((v) => v.pulse)).toEqual([88, 72]);
    expect(record.inpatientRecords.map((r) => r.department)).toEqual(['Nội tim mạch']);
    expect(record.dischargePapers.length).toBe(0);
    expect(record.transferForms.map((t) => t.transferTo)).toEqual(['Bệnh viện Đà Nẵng']);
    expect(record.scannedDocuments.map((d) => d.title)).toEqual(['Kết quả siêu âm']);
    const json = JSON.stringify(record);
    for (const hidden of ['Đau đầu kéo dài', 'MRI sọ não', 'Huyết học', '120/80', 'U màng não', 'Chợ Rẫy', 'Losartan', 'KHÔNG ĐƯỢC LỘ']) expect(json.includes(hidden)).toBe(false);
  });

  it('dị ứng thuốc và liên hệ khẩn cấp chọn riêng được; phần không chia sẻ được ghi rõ là KHÔNG CHIA SẺ, không phải "chưa khai báo"', async () => {
    const onlyContact = (await view(['safety'], { safety: ['emergencyContact'] })).record.safety;
    expect(onlyContact.shared).toEqual(['emergencyContact']);
    expect('drugAllergies' in onlyContact).toBe(false);
    expect(onlyContact.emergencyContact.name).toBe('Trần Thị B');
    const onlyAllergy = (await view(['safety'], { safety: ['allergies'] })).record.safety;
    expect(onlyAllergy.shared).toEqual(['allergies']);
    expect(onlyAllergy.drugAllergies).toEqual(['Penicillin']);
    expect(JSON.stringify(onlyAllergy).includes('0900000001')).toBe(false);
    const whole = (await view(['safety'])).record.safety; // không kèm danh sách = cả 2
    expect(whole.shared).toEqual(['allergies', 'emergencyContact']);
  });

  it('mục của người khác, mục không tồn tại, phim chưa ký, mã sai dạng hoặc danh sách rỗng đều bị từ chối (400), không tạo lượt chia sẻ', async () => {
    const before = await RecordShare.countDocuments({ patientId: me });
    const bad = [
      [['prescriptions'], { prescriptions: [s(id.rxForeign)] }], // đơn thuốc của bệnh nhân khác
      [['prescriptions'], { prescriptions: [s(id.rxNew), s(id.rxForeign)] }],
      [['imaging'], { imaging: [s(id.filmForeign)] }],
      [['imaging'], { imaging: [s(id.filmUnsigned)] }],
      [['labs'], { labs: [s(oid())] }],
      [['labs'], { labs: [s(id.rxNew)] }], // mã đúng nhưng thuộc nhóm khác
      [['labs'], { labs: [] }],
      [['labs'], { labs: 'tat-ca' }],
      [['labs'], { labs: [{ $ne: null }] }],
      [['labs'], { labs: ['khong-phai-ma'] }],
      [['labs'], { prescriptions: [s(id.rxNew)] }], // kèm mục của nhóm không chia sẻ
      [['labs'], { hack: [s(id.lab1)] }],
      [['labs'], ['x']],
      [['labs'], 'x'],
      [['safety'], { safety: ['cccd'] }],
      [['vitals'], { vitals: Array.from({ length: MAX_ITEMS_PER_SECTION + 1 }, () => s(oid())) }],
    ];
    for (const [sections, items] of bad) expect(await statusOf(() => createShare(me, hospitalId, t0, sections, undefined, items))).toBe(400);
    expect(await RecordShare.countDocuments({ patientId: me })).toBe(before);
    // người khác không dùng được mã mục của tôi
    expect(await statusOf(() => createShare(other, hospitalId, t0, ['prescriptions'], undefined, { prescriptions: [s(id.rxNew)] }))).toBe(400);
  });

  it('danh sách mục trùng lặp được gộp; giấy tờ tự quét gửi qua `items.documents` cũng chốt đúng như `documentIds`', async () => {
    const dup = await resolveShareItems(me, ['labs'], { labs: [s(id.lab1), s(id.lab1), s(id.lab2)] });
    expect(dup.labs.length).toBe(2);
    expect(await resolveShareItems(me, ['labs'], undefined)).toBe(undefined);
    const { share } = await createShare(me, hospitalId, t0, ['documents'], undefined, { documents: [s(doc1._id)] });
    expect(share.documentIds.map(s)).toEqual([s(doc1._id)]);
    expect(share.itemIds).toBe(undefined); // giấy tờ tự quét vẫn lưu ở documentIds, không lưu 2 nơi
  });

  it('lượt chia sẻ cũ (không có danh sách mục) vẫn như trước: cả nhóm, kể cả mục phát sinh sau khi tạo mã', async () => {
    const { record } = await view(['prescriptions']);
    expect(record.prescriptions.length).toBe(2);
    expect(record.partial).toEqual([]);
    // danh sách mục rỗng lọt vào DB bằng cách nào đó thì không trả gì (đóng mặc định), không phải trả tất cả
    const closed = await buildSharedRecord(me, ['prescriptions'], { itemIds: { prescriptions: [] } });
    expect(closed.prescriptions.length).toBe(0);
    // danh sách mục bị hỏng trong DB (không phải mảng) cũng đóng mặc định
    for (const broken of [null, 'tat-ca', {}, 5]) {
      expect((await buildSharedRecord(me, ['prescriptions'], { itemIds: { prescriptions: broken } })).prescriptions.length).toBe(0);
    }
    expect((await buildSharedRecord(me, ['safety'], { itemIds: { safety: null } })).safety.shared).toEqual([]);
    // `items.documents` sai dạng không được lặng lẽ thành "mọi giấy tờ"
    for (const broken of [null, 'x', {}]) {
      expect(await statusOf(() => createShare(me, hospitalId, t0, ['documents'], [s(doc1._id)], { documents: broken }))).toBe(400);
    }
    // danh mục chỉ nạp các trường cần cho tên / tìm kiếm: ghi chú nhạy cảm của bệnh án nội trú không rời khỏi DB
    const catalog = await buildShareCatalog(me);
    expect(catalog.items.filter((x) => x.section === 'inpatient').every((x) => Object.keys(x).sort().join() === 'date,id,keywords,section,source,sub,title')).toBe(true);
  });
});
