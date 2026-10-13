import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../../config/jwt.config.js';
import { createShare, listShares, revokeShare, redeemQr, resolveViewer, staffViewerOf, signedInUserId, hashToken, QR_TTL_MS, MAX_VIEWERS } from '../recordShare.service.js';
import { User } from '../../models/user.model.js';
import { SHARE_SECTIONS, LEGACY_SHARE_SECTIONS } from '../sharedRecord.service.js';
import { RecordShare } from '../../models/recordShare.model.js';
import { ScannedDocument } from '../../models/scannedDocument.model.js';

const statusOf = async (fn) => { try { await fn(); return 200; } catch (e) { return e.status || 500; } };

describe('Chia sẻ bệnh án qua QR — mã QR 5 phút & phiên xem (UC-PAT-09)', () => {
  const hospitalId = new mongoose.Types.ObjectId();
  const me = new mongoose.Types.ObjectId();
  const other = new mongoose.Types.ObjectId();
  const t0 = new Date('2026-10-12T08:00:00Z');
  let share, qrToken;

  beforeAll(async () => {
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/neuroscan_test_logic';
    if (mongoose.connection.readyState === 0) await mongoose.connect(mongoUri);
    ({ share, qrToken } = await createShare(me, hospitalId, t0));
  });

  afterAll(async () => {
    await RecordShare.deleteMany({ patientId: { $in: [me, other] } });
    await ScannedDocument.deleteMany({ patientId: { $in: [me, other] } });
  });

  it('tạo mã QR sống 5 phút; DB chỉ lưu mã băm, không lưu mã gốc', async () => {
    expect(qrToken.length).toBeGreaterThan(30);
    expect(QR_TTL_MS).toBe(5 * 60 * 1000);
    const doc = await RecordShare.findById(share._id).lean();
    expect(doc.qrTokenHash).toBe(hashToken(qrToken));
    expect(JSON.stringify(doc).includes(qrToken)).toBe(false);
    expect(new Date(doc.qrExpiresAt).getTime()).toBe(t0.getTime() + QR_TTL_MS);
  });

  it('trong 5 phút nhiều người quét đều vào được, mỗi người 1 phiên xem riêng', async () => {
    const a = await redeemQr(qrToken, { now: new Date(t0.getTime() + 60 * 1000), userAgent: 'BS A' });
    const b = await redeemQr(qrToken, { now: new Date(t0.getTime() + 4 * 60 * 1000), userAgent: 'BS B' });
    expect(a.viewerToken === b.viewerToken).toBe(false);
    const doc = await RecordShare.findById(share._id).lean();
    expect(doc.sessions.length).toBe(2);
    expect(JSON.stringify(doc).includes(a.viewerToken)).toBe(false);
  });

  it('quá 5 phút thì không quét vào được nữa; mã sai cũng bị từ chối', async () => {
    expect(await statusOf(() => redeemQr(qrToken, { now: new Date(t0.getTime() + QR_TTL_MS + 1000) }))).toBe(410);
    expect(await statusOf(() => redeemQr('ma-sai', { now: t0 }))).toBe(404);
  });

  it('đã vào được thì xem mãi (không hết hạn), mỗi lần xem được ghi nhận', async () => {
    const { viewerToken } = await redeemQr(qrToken, { now: new Date(t0.getTime() + 2 * 60 * 1000) });
    const later = new Date(t0.getTime() + 90 * 24 * 3600 * 1000); // 90 ngày sau
    const res = await resolveViewer(viewerToken, { now: later });
    expect(String(res.patientId)).toBe(String(me));
    await resolveViewer(viewerToken, { now: later });
    const doc = await RecordShare.findById(share._id).lean();
    const s = doc.sessions.find((x) => x.viewerTokenHash === hashToken(viewerToken));
    expect(s.viewCount).toBe(2);
  });

  it('danh sách chia sẻ của bệnh nhân hiện số người đang xem; người khác không thấy', async () => {
    const mine = await listShares(me, t0);
    expect(mine.length).toBe(1);
    expect(mine[0].viewerCount).toBe(3);
    expect((await listShares(other, t0)).length).toBe(0);
  });

  it('chỉ chủ bệnh án thu hồi được; thu hồi xong mọi phiên xem và mã QR đều hết hiệu lực', async () => {
    const { viewerToken } = await redeemQr(qrToken, { now: new Date(t0.getTime() + 3 * 60 * 1000) });
    expect(await statusOf(() => revokeShare(other, share._id))).toBe(404);
    await revokeShare(me, share._id);
    expect(await statusOf(() => resolveViewer(viewerToken, { now: t0 }))).toBe(410);
    expect(await statusOf(() => redeemQr(qrToken, { now: t0 }))).toBe(410);
    expect((await listShares(me, t0)).length).toBe(0);
  });

  it('bệnh nhân chọn nhóm chia sẻ: lưu đúng nhóm, người xem nhận đúng nhóm, danh sách hiện nhóm', async () => {
    const { share: s2, qrToken: q2 } = await createShare(me, hospitalId, t0, ['vitals', 'imaging', 'imaging']);
    const { viewerToken } = await redeemQr(q2, { now: t0 });
    const res = await resolveViewer(viewerToken, { now: t0 });
    expect(res.sections).toEqual(['imaging', 'vitals']); // bỏ trùng, theo thứ tự chuẩn
    const listed = (await listShares(me, t0)).find((x) => String(x._id) === String(s2._id));
    expect(listed.sections).toEqual(['imaging', 'vitals']);
  });

  it('nhóm rỗng hoặc không hợp lệ bị từ chối (400)', async () => {
    expect(await statusOf(() => createShare(me, hospitalId, t0, []))).toBe(400);
    expect(await statusOf(() => createShare(me, hospitalId, t0, ['imaging', 'cccd']))).toBe(400);
    expect(await statusOf(() => createShare(me, hospitalId, t0, 'imaging'))).toBe(400);
  });

  it('giấy tờ tự quét chỉ được chia sẻ khi chọn rõ ràng: không gửi nhóm (giao diện cũ) hay lượt chia sẻ cũ đều chỉ gồm 8 nhóm gốc', async () => {
    const { share: s3, qrToken: q3 } = await createShare(me, hospitalId, t0);
    expect(s3.sections).toEqual(LEGACY_SHARE_SECTIONS);
    expect(SHARE_SECTIONS.includes('documents')).toBe(true);
    await RecordShare.updateOne({ _id: s3._id }, { $unset: { sections: 1 } }); // giả lập bản ghi tạo trước khi có tính năng
    const { viewerToken } = await redeemQr(q3, { now: t0 });
    const legacy = (await resolveViewer(viewerToken, { now: t0 })).sections;
    expect(legacy).toEqual(LEGACY_SHARE_SECTIONS);
    expect(legacy.includes('documents')).toBe(false);
  });

  it('chọn từng giấy tờ: lượt chia sẻ chốt đúng các giấy tờ đã chọn; giấy tờ nháp, của người khác hoặc mã sai bị từ chối', async () => {
    const doc = (patientId, title, confirmed) => ({ patientId, title, fileId: `f-${title}`, mimeType: 'image/jpeg', confirmedAt: confirmed ? new Date() : null });
    const [d1, d2, draft, foreign] = await ScannedDocument.create([doc(me, 'd1', true), doc(me, 'd2', true), doc(me, 'nhap', false), doc(other, 'o1', true)]);
    const ids = (list) => list.map(String).sort();

    const one = await createShare(me, hospitalId, t0, ['documents', 'vitals'], [String(d2._id)]);
    expect(one.share.sections).toEqual(['vitals', 'documents']);
    expect(ids(one.share.documentIds)).toEqual([String(d2._id)]);
    const { viewerToken } = await redeemQr(one.qrToken, { now: t0 });
    expect(ids((await resolveViewer(viewerToken, { now: t0 })).documentIds)).toEqual([String(d2._id)]);
    expect((await listShares(me, t0)).find((x) => String(x._id) === String(one.share._id)).documentCount).toBe(1);

    // không gửi danh sách → chốt tất cả giấy tờ ĐÃ KIỂM TRA tại thời điểm tạo (không gồm bản nháp)
    const all = await createShare(me, hospitalId, t0, ['documents']);
    expect(ids(all.share.documentIds)).toEqual(ids([d1._id, d2._id]));

    for (const bad of [[String(draft._id)], [String(foreign._id)], ['khong-phai-ma'], 'd1']) {
      expect(await statusOf(() => createShare(me, hospitalId, t0, ['documents'], bad))).toBe(400);
    }
    // nhóm khác không cần danh sách giấy tờ
    expect((await createShare(me, hospitalId, t0, ['vitals'], [String(d1._id)])).share.documentIds).toBe(undefined);
  });

  it('nhóm giấy tờ không có giấy tờ nào thì tự bỏ khỏi lượt chia sẻ; không còn nhóm nào → 400', async () => {
    const s = await createShare(me, hospitalId, t0, ['documents', 'labs'], []);
    expect(s.share.sections).toEqual(['labs']);
    expect(await statusOf(() => createShare(me, hospitalId, t0, ['documents'], []))).toBe(400);
    expect(await statusOf(() => createShare(other, hospitalId, t0, ['documents']))).toBe(200); // other có 1 giấy tờ đã kiểm tra
    const lonely = new mongoose.Types.ObjectId(); // bệnh nhân chưa quét giấy tờ nào
    expect(await statusOf(() => createShare(lonely, hospitalId, t0, ['documents']))).toBe(400);
    expect((await createShare(lonely, hospitalId, t0, ['documents', 'visits'])).share.sections).toEqual(['visits']);
    await RecordShare.deleteMany({ patientId: lonely });
  });

  it('nhân viên quét mã trong app: bệnh nhân thấy tên và vai trò người đã mở; người quét bằng camera thường vẫn ẩn danh', async () => {
    const staffId = new mongoose.Types.ObjectId();
    const s = await createShare(me, hospitalId, t0, ['vitals']);
    const viewer = { userId: staffId, name: `  BS. Nguyễn   Văn A ${'x'.repeat(300)}`, role: 'doctor' };
    const a = await redeemQr(s.qrToken, { now: t0, userAgent: 'Chrome', viewer });
    const anon = await redeemQr(s.qrToken, { now: t0, userAgent: 'Safari' }); // ẩn danh
    // Vé của nhân viên chỉ dùng được khi đang đăng nhập đúng tài khoản đó: vé nằm lại trong lịch sử trình duyệt
    // của máy dùng chung cũng không mở được bệnh án, và không bị tính lượt xem cho nhân viên
    const later = new Date(t0.getTime() + 60000);
    expect(await statusOf(() => resolveViewer(a.viewerToken, { now: later }))).toBe(403);
    expect(await statusOf(() => resolveViewer(a.viewerToken, { now: later, userId: String(new mongoose.Types.ObjectId()) }))).toBe(403);
    await resolveViewer(a.viewerToken, { now: later, userId: String(staffId) });
    // vé ẩn danh (quét bằng camera thường) không cần đăng nhập, kể cả khi người xem tình cờ đang đăng nhập
    await resolveViewer(anon.viewerToken, { now: later });
    await resolveViewer(anon.viewerToken, { now: later, userId: String(staffId) });

    const doc = await RecordShare.findById(s.share._id).lean();
    expect(String(doc.sessions[0].viewerUserId)).toBe(String(staffId));
    expect(doc.sessions[1].viewerUserId).toBe(null);

    const row = (await listShares(me, t0)).find((x) => String(x._id) === String(s.share._id));
    expect(row.viewerCount).toBe(2);
    expect(row.viewers.length).toBe(1); // chỉ người có danh tính
    expect(row.viewers[0].name.startsWith('BS. Nguyễn Văn A')).toBe(true);
    expect(row.viewers[0].name.length).toBe(120); // cắt độ dài, gộp khoảng trắng
    expect(row.viewers[0].role).toBe('doctor');
    expect(row.viewers[0].viewCount).toBe(1);
    // không lộ mã người dùng nội bộ hay token ra danh sách của bệnh nhân
    const json = JSON.stringify(row);
    expect(json.includes(String(staffId)) || json.includes('viewerTokenHash')).toBe(false);
  });

  it('tên nhân viên lấy thẳng từ hồ sơ trong DB (không phụ thuộc thông tin đăng nhập đang đệm, vốn có lúc thiếu hồ sơ)', async () => {
    const staffId = new mongoose.Types.ObjectId();
    await User.collection.insertOne({ _id: staffId, role: 'nurse', email: `nv-${staffId}@test.local`, profile: { name: 'ĐD. Lê Thị Hoa' } });
    expect(await staffViewerOf({ id: String(staffId), role: 'nurse', profile: {} })).toEqual({ userId: String(staffId), name: 'ĐD. Lê Thị Hoa', role: 'nurse' });
    const ghost = String(new mongoose.Types.ObjectId()); // không tìm thấy hồ sơ → tên chung, vẫn ghi nhận vai trò
    expect((await staffViewerOf({ id: ghost, role: 'doctor' })).name).toBe('Nhân viên y tế');
    await User.collection.deleteOne({ _id: staffId });
  });

  it('nhận biết tài khoản đang đăng nhập từ header (không bắt buộc): token giả, hết hiệu lực, tài khoản bị khoá đều coi như chưa đăng nhập', async () => {
    const id = new mongoose.Types.ObjectId();
    await User.collection.insertOne({ _id: id, role: 'doctor', email: `bs-${id}@test.local`, tokenVersion: 3, isLocked: false });
    const bearer = (payload, secret = getJwtSecret(), opts = {}) => `Bearer ${jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '5m', ...opts })}`;
    expect(await signedInUserId(bearer({ id: String(id), tokenVersion: 3 }))).toBe(String(id));
    expect(await signedInUserId(bearer({ id: String(id), tokenVersion: 2 }))).toBe(null); // đã "đăng xuất mọi thiết bị"
    expect(await signedInUserId(bearer({ id: String(id), tokenVersion: 3 }, 'khoa-gia-mao'))).toBe(null);
    expect(await signedInUserId(bearer({ id: String(id), tokenVersion: 3 }, getJwtSecret(), { expiresIn: '-1s' }))).toBe(null);
    for (const none of [undefined, null, '', 'Basic abc', { a: 1 }, 'Bearer khong-phai-jwt']) expect(await signedInUserId(none)).toBe(null);
    await User.collection.updateOne({ _id: id }, { $set: { isLocked: true } });
    expect(await signedInUserId(bearer({ id: String(id), tokenVersion: 3 }))).toBe(null);
    await User.collection.deleteOne({ _id: id });
  });

  it('dữ liệu sai kiểu (object thay cho chuỗi) trả 400, không làm sập thành lỗi 500', async () => {
    const weird = { toString: 1 };
    expect(await statusOf(() => createShare(me, hospitalId, t0, [weird]))).toBe(400);
    expect(await statusOf(() => createShare(me, hospitalId, t0, ['documents'], [weird]))).toBe(400);
    expect(await statusOf(() => redeemQr(weird, { now: t0 }))).toBe(404);
    expect(await statusOf(() => resolveViewer(weird, { now: t0 }))).toBe(404);
  });

  it(`một mã QR đổi tối đa ${MAX_VIEWERS} vé xem (chặn bơm phiên xem làm phình bản ghi trong 5 phút mã còn sống)`, async () => {
    const s = await createShare(me, hospitalId, t0, ['vitals']);
    const filler = Array.from({ length: MAX_VIEWERS }, (_, i) => ({ viewerTokenHash: `fill-${i}-${s.share._id}`, createdAt: t0 }));
    await RecordShare.updateOne({ _id: s.share._id }, { $set: { sessions: filler } });
    expect(await statusOf(() => redeemQr(s.qrToken, { now: t0 }))).toBe(429);
  });
});
