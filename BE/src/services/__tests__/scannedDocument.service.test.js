import mongoose from 'mongoose';
import { Readable } from 'stream';
import {
  imageKind, scanDocument, listDocuments, saveDocument, deleteDocument, listSharedDocuments, getImage,
  createImageToken, verifyImageToken, toPublicDoc, cleanFields, MAX_TEXT, MAX_TITLE, MAX_DOCS, MAX_SCANS_PER_DAY,
} from '../scannedDocument.service.js';
import { ScannedDocument, ScanUsage } from '../../models/scannedDocument.model.js';
import { RecordShare } from '../../models/recordShare.model.js';

const statusOf = async (fn) => { try { await fn(); return 200; } catch (e) { return e.status || 500; } };
const readAll = async (stream) => { const chunks = []; for await (const c of stream) chunks.push(c); return Buffer.concat(chunks); };

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4, 0), Buffer.from('WEBP'), Buffer.alloc(32, 1)]);
const PDF = Buffer.from('%PDF-1.7 fake pdf content');
// Bản ảnh AI service trả về sau khi chuẩn hoá (JPEG, đã bỏ EXIF) — khác với file gốc bệnh nhân gửi
const NORMALIZED = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xdb]), Buffer.alloc(40, 7)]);

// Ranh giới bên ngoài (AI server, kho file) thay bằng bản giả trong bộ nhớ
const fakeStorage = () => {
  const files = new Map();
  let n = 0;
  return {
    files,
    putFile: async (args) => { const fileId = `f${++n}`; files.set(fileId, { ...args }); return { fileId }; },
    getFileStream: async (fileId) => {
      const f = files.get(fileId);
      if (!f) throw Object.assign(new Error('missing'), { status: 404 });
      return { stream: Readable.from([f.buffer]), file: { category: f.category, patientId: f.patientId } };
    },
    deleteFile: async (fileId) => { files.delete(fileId); },
  };
};
const okOcr = async () => ({ title: 'Đơn thuốc', text: 'Paracetamol 500mg\nNgày uống 2 lần', image: NORMALIZED, failed: false });

describe('Giấy tờ bệnh nhân tự quét (UC-PAT-09 mở rộng)', () => {
  const hospitalId = new mongoose.Types.ObjectId();
  const me = new mongoose.Types.ObjectId();
  const other = new mongoose.Types.ObjectId();
  const heavy = new mongoose.Types.ObjectId();
  const racer = new mongoose.Types.ObjectId();
  const fielder = new mongoose.Types.ObjectId();
  const everyone = [me, other, heavy, racer, fielder];
  let storage;

  beforeAll(async () => {
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/neuroscan_test_logic';
    if (mongoose.connection.readyState === 0) await mongoose.connect(mongoUri);
    await ScanUsage.init(); // cần chỉ mục duy nhất (patientId, day) cho hạn mức quét
    storage = fakeStorage();
  });

  afterAll(async () => {
    await ScannedDocument.deleteMany({ patientId: { $in: everyone } });
    await ScanUsage.deleteMany({ patientId: { $in: everyone } });
    await RecordShare.deleteMany({ patientId: { $in: everyone } });
  });

  it('nhận diện ảnh theo nội dung file (JPEG/PNG/WEBP), không tin tên hay kiểu client gửi', () => {
    expect(imageKind(JPEG).mime).toBe('image/jpeg');
    expect(imageKind(PNG).mime).toBe('image/png');
    expect(imageKind(WEBP).mime).toBe('image/webp');
    expect(imageKind(PDF)).toBeNull();
    expect(imageKind(Buffer.alloc(0))).toBeNull();
    expect(imageKind('not a buffer')).toBeNull();
  });

  it('quét: lưu BẢN ẢNH ĐÃ CHUẨN HOÁ (không phải file gốc còn EXIF/GPS) vào kho riêng, ở trạng thái chưa kiểm tra', async () => {
    const { doc, ocrFailed } = await scanDocument({ patientId: me, hospitalId, buffer: PNG }, { ocr: okOcr, storage });
    expect(ocrFailed).toBe(false);
    expect(doc.title).toBe('Đơn thuốc');
    expect(doc.text.includes('Paracetamol')).toBe(true);
    expect(doc.confirmedAt).toBeNull();
    expect(doc.mimeType).toBe('image/jpeg');
    const stored = storage.files.get(doc.fileId);
    expect(stored.buffer.equals(NORMALIZED)).toBe(true);
    expect(stored.category).toBe('patient_upload');
    expect(stored.patientId).toBe(String(me));
  });

  it('thông tin AI tách (loại giấy, ngày, nơi khám, thuốc) được làm sạch trước khi lưu; bệnh nhân sửa lại được', async () => {
    const seen = [];
    const fieldsOcr = async (buffer, mime, opts) => {
      seen.push(opts);
      return {
        ...(await okOcr()), cropped: true,
        fields: {
          docType: 'prescription', date: ' 10/10/2026 ', facility: 'PK An Bình', doctor: 'BS. Mẫu', diagnosis: 'Tăng huyết áp', hack: '<script>',
          medications: [{ name: 'Amlodipin 5mg', quantity: '30 viên', usage: 'Sáng 1 viên', extra: 1 }, { name: '  ', quantity: '5' }, 'rác', null],
        },
      };
    };
    const scanned = await scanDocument({ patientId: fielder, hospitalId, buffer: JPEG, autocrop: false }, { ocr: fieldsOcr, storage });
    expect(seen[0].autocrop).toBe(false);
    expect(scanned.cropped).toBe(true);
    const f = toPublicDoc(scanned.doc).fields;
    expect(f).toEqual({
      docType: 'prescription', date: '10/10/2026', facility: 'PK An Bình', doctor: 'BS. Mẫu', diagnosis: 'Tăng huyết áp',
      medications: [{ name: 'Amlodipin 5mg', quantity: '30 viên', usage: 'Sáng 1 viên' }],
    });

    // bệnh nhân sửa: loại giấy lạ → "other", cắt độ dài, bỏ dòng thuốc trống, tối đa 30 thuốc
    const saved = await saveDocument(fielder, scanned.doc._id, {
      title: 'Đơn', text: 'x',
      fields: { docType: 'virus', facility: 'F'.repeat(500), medications: Array.from({ length: 50 }, (_, i) => ({ name: `Thuốc ${i}`, usage: 'U'.repeat(900) })) },
    });
    const g = toPublicDoc(saved).fields;
    expect(g.docType).toBe('other');
    expect(g.facility.length).toBe(200);
    expect(g.medications.length).toBe(30);
    expect(g.medications[0].usage.length).toBe(300);
    expect(g.date).toBe('');
    // lưu mà không gửi fields (bản giao diện cũ) thì giữ nguyên thông tin đang có
    const kept = await saveDocument(fielder, scanned.doc._id, { title: 'Đơn 2', text: 'y' });
    expect(toPublicDoc(kept).fields.medications.length).toBe(30);
    // giấy tờ cũ chưa có fields vẫn trả đủ khung rỗng cho giao diện
    expect(toPublicDoc({ _id: new mongoose.Types.ObjectId(), title: 'cũ', text: '' }).fields).toEqual({ docType: 'other', date: '', facility: '', doctor: '', diagnosis: '', medications: [] });
    for (const bad of [null, 'chuỗi', 5, []]) expect(cleanFields(bad).medications.length).toBe(0);
  });

  it('tên file trong kho là ngẫu nhiên, không trùng nhau dù quét cùng lúc (không ghi đè ảnh của người khác)', async () => {
    const [a, b] = await Promise.all([
      scanDocument({ patientId: other, hospitalId, buffer: JPEG }, { ocr: okOcr, storage }),
      scanDocument({ patientId: other, hospitalId, buffer: JPEG }, { ocr: okOcr, storage }),
    ]);
    const names = [a, b].map((x) => storage.files.get(x.doc.fileId).fileName);
    expect(names[0] === names[1]).toBe(false);
    for (const n of names) expect(/^scan_[0-9a-f-]{36}\.jpg$/.test(n)).toBe(true);
  });

  it('file không phải ảnh bị từ chối (400), không gọi AI, không lưu gì, không tính vào hạn mức ngày', async () => {
    let called = 0;
    const before = storage.files.size;
    const usedBefore = (await ScanUsage.findOne({ patientId: me }).lean()).count;
    expect(await statusOf(() => scanDocument({ patientId: me, hospitalId, buffer: PDF }, { ocr: async () => { called += 1; return {}; }, storage }))).toBe(400);
    expect(called).toBe(0);
    expect(storage.files.size).toBe(before);
    expect((await ScanUsage.findOne({ patientId: me }).lean()).count).toBe(usedBefore);
  });

  it('AI nhận ảnh nhưng chưa đọc được chữ: vẫn lưu ảnh để bệnh nhân tự gõ nội dung', async () => {
    const { doc, ocrFailed } = await scanDocument({ patientId: me, hospitalId, buffer: JPEG }, { ocr: async () => ({ title: '', text: '', image: NORMALIZED, failed: true }), storage });
    expect(ocrFailed).toBe(true);
    expect(doc.text).toBe('');
    expect(doc.title.length).toBeGreaterThan(0);
    expect(doc.ocrStatus).toBe('failed');
  });

  it('AI service tắt hoặc trả ảnh hỏng: báo 503, KHÔNG lưu file gốc chưa chuẩn hoá; AI báo ảnh không hợp lệ → 400', async () => {
    const before = storage.files.size;
    const count = await ScannedDocument.countDocuments({ patientId: me });
    expect(await statusOf(() => scanDocument({ patientId: me, hospitalId, buffer: JPEG }, { ocr: async () => { throw new Error('ECONNREFUSED'); }, storage }))).toBe(503);
    expect(await statusOf(() => scanDocument({ patientId: me, hospitalId, buffer: JPEG }, { ocr: async () => ({ title: 'x', text: 'y', image: PDF, failed: false }), storage }))).toBe(503);
    expect(await statusOf(() => scanDocument({ patientId: me, hospitalId, buffer: JPEG }, { ocr: async () => { throw Object.assign(new Error('bad image'), { status: 400 }); }, storage }))).toBe(400);
    expect(storage.files.size).toBe(before);
    expect(await ScannedDocument.countDocuments({ patientId: me })).toBe(count);
  });

  it('lưu sau khi kiểm tra: cắt độ dài, đánh dấu đã xác nhận; người khác hoặc mã sai không sửa được', async () => {
    const [doc] = await listDocuments(me);
    expect(await statusOf(() => saveDocument(other, doc._id, { title: 'x', text: 'y' }))).toBe(404);
    expect(await statusOf(() => saveDocument(me, 'khong-phai-ma-hop-le', { title: 'x', text: 'y' }))).toBe(404);
    const saved = await saveDocument(me, doc._id, { title: `  ${'T'.repeat(MAX_TITLE + 50)}`, text: 'A'.repeat(MAX_TEXT + 500) });
    expect(saved.title.length).toBe(MAX_TITLE);
    expect(saved.text.length).toBe(MAX_TEXT);
    expect(saved.confirmedAt instanceof Date).toBe(true);
    const blank = await saveDocument(me, doc._id, { title: '   ', text: 'ok' });
    expect(blank.title.length).toBeGreaterThan(0); // tên trống → tên mặc định
  });

  it('danh sách chỉ của mình; chỉ giấy tờ đã kiểm tra mới được đem chia sẻ', async () => {
    expect((await listDocuments(me)).length).toBe(2);
    expect((await listDocuments(other)).length).toBe(2);
    expect((await listDocuments(heavy)).length).toBe(0);
    const shared = await listSharedDocuments(me);
    expect(shared.length).toBe(1);
    expect(shared[0].confirmedAt !== null).toBe(true);
  });

  it('link ảnh ngắn hạn: đúng chữ ký mới lấy được ảnh; token sửa, hết hạn hoặc mã lạ bị từ chối', async () => {
    const [doc] = await listSharedDocuments(me);
    const token = createImageToken(doc._id);
    expect(verifyImageToken(token).did).toBe(String(doc._id));
    const img = await getImage(verifyImageToken(token), { storage });
    expect((await readAll(img.stream)).equals(NORMALIZED)).toBe(true);
    expect(img.mimeType).toBe('image/jpeg');
    expect(await statusOf(async () => verifyImageToken(`${token}x`))).toBe(500); // jwt ném lỗi (không có status)
    expect(await statusOf(async () => verifyImageToken(createImageToken(doc._id, { expiresIn: '-1s' })))).toBe(500);
    expect(await statusOf(() => getImage({ did: String(new mongoose.Types.ObjectId()) }, { storage }))).toBe(404);
  });

  it('link ảnh cấp cho người xem QR mất hiệu lực NGAY khi bệnh nhân dừng chia sẻ; chia sẻ của người khác không dùng được', async () => {
    const [doc] = await listSharedDocuments(me);
    const share = await RecordShare.create({ patientId: me, qrTokenHash: `h-${doc._id}`, qrExpiresAt: new Date(Date.now() + 60000), sections: ['documents'] });
    const foreign = await RecordShare.create({ patientId: other, qrTokenHash: `h2-${doc._id}`, qrExpiresAt: new Date(Date.now() + 60000), sections: ['documents'] });
    const payload = verifyImageToken(createImageToken(doc._id, { shareId: share._id }));
    expect(payload.sid).toBe(String(share._id));
    expect((await getImage(payload, { storage })).mimeType).toBe('image/jpeg');
    expect(await statusOf(() => getImage(verifyImageToken(createImageToken(doc._id, { shareId: foreign._id })), { storage }))).toBe(404);
    await RecordShare.updateOne({ _id: share._id }, { $set: { revokedAt: new Date() } });
    expect(await statusOf(() => getImage(payload, { storage }))).toBe(404);
  });

  it('link ảnh của người xem QR chỉ dùng được cho giấy tờ nằm trong lượt chia sẻ đó', async () => {
    const [doc] = await listSharedDocuments(me);
    const mk = (extra) => RecordShare.create({ patientId: me, qrTokenHash: `h-${Math.random()}`, qrExpiresAt: new Date(Date.now() + 60000), ...extra });
    const viaShare = async (share) => statusOf(() => getImage(verifyImageToken(createImageToken(doc._id, { shareId: share._id })), { storage }));
    expect(await viaShare(await mk({ sections: ['documents'], documentIds: [doc._id] }))).toBe(200);
    expect(await viaShare(await mk({ sections: ['documents'], documentIds: [new mongoose.Types.ObjectId()] }))).toBe(404); // chia sẻ giấy tờ khác
    expect(await viaShare(await mk({ sections: ['vitals'] }))).toBe(404); // lượt chia sẻ không gồm giấy tờ
    expect(await viaShare(await mk({}))).toBe(404); // lượt chia sẻ cũ (không có nhóm) không gồm giấy tờ
  });

  it('không trả ảnh nếu file trong kho không thuộc đúng bệnh nhân hoặc không phải loại giấy tờ bệnh nhân tải lên', async () => {
    const [doc] = await listSharedDocuments(me);
    const real = storage.files.get(doc.fileId);
    storage.files.set(doc.fileId, { ...real, patientId: String(other) });
    expect(await statusOf(() => getImage({ did: String(doc._id) }, { storage }))).toBe(404);
    storage.files.set(doc.fileId, { ...real, category: 'pacs' });
    expect(await statusOf(() => getImage({ did: String(doc._id) }, { storage }))).toBe(404);
    storage.files.set(doc.fileId, real);
    expect((await getImage({ did: String(doc._id) }, { storage })).mimeType).toBe('image/jpeg');
  });

  it('xoá: chỉ chủ giấy tờ; xoá cả file ảnh trong kho', async () => {
    const [doc] = await listDocuments(me);
    expect(await statusOf(() => deleteDocument(other, doc._id, { storage }))).toBe(404);
    await deleteDocument(me, doc._id, { storage });
    expect(storage.files.has(doc.fileId)).toBe(false);
    expect((await listDocuments(me)).length).toBe(1);
  });

  it(`hạn mức ${MAX_SCANS_PER_DAY} lần quét mỗi ngày: hết lượt báo 429, xoá giấy tờ không được hoàn lượt (chặn vòng lặp quét-xoá tốn AI)`, async () => {
    const day = new Date('2026-10-13T03:00:00Z');
    for (let i = 0; i < MAX_SCANS_PER_DAY; i += 1) {
      const { doc } = await scanDocument({ patientId: heavy, hospitalId, buffer: JPEG }, { ocr: okOcr, storage, now: day });
      await deleteDocument(heavy, doc._id, { storage });
    }
    let aiCalls = 0;
    expect(await statusOf(() => scanDocument({ patientId: heavy, hospitalId, buffer: JPEG }, { ocr: async () => { aiCalls += 1; return okOcr(); }, storage, now: day }))).toBe(429);
    expect(aiCalls).toBe(0);
    // sang ngày khác thì quét lại được
    const next = await scanDocument({ patientId: heavy, hospitalId, buffer: JPEG }, { ocr: okOcr, storage, now: new Date('2026-10-14T03:00:00Z') });
    expect(next.ocrFailed).toBe(false);
  });

  it(`giới hạn ${MAX_DOCS} giấy tờ mỗi bệnh nhân, kể cả khi nhiều yêu cầu chen nhau trong lúc chờ AI`, async () => {
    const seed = (n) => ScannedDocument.insertMany(Array.from({ length: n }, (_, i) => ({ patientId: racer, title: `d${i}-${n}`, fileId: `x${i}-${n}`, mimeType: 'image/jpeg' })));
    await seed(MAX_DOCS - 1);
    const before = storage.files.size;
    // trong lúc chờ AI, 1 yêu cầu khác đã kịp tạo thêm giấy tờ → lần này phải bị huỷ và dọn file
    const racingOcr = async () => { await seed(1); return okOcr(); };
    expect(await statusOf(() => scanDocument({ patientId: racer, hospitalId, buffer: JPEG }, { ocr: racingOcr, storage }))).toBe(409);
    expect(await ScannedDocument.countDocuments({ patientId: racer })).toBe(MAX_DOCS);
    expect(storage.files.size).toBe(before);
    expect(await statusOf(() => scanDocument({ patientId: racer, hospitalId, buffer: JPEG }, { ocr: okOcr, storage }))).toBe(409);
  });
});
