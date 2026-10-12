import mongoose from 'mongoose';
import { createShare, listShares, revokeShare, redeemQr, resolveViewer, hashToken, QR_TTL_MS } from '../recordShare.service.js';
import { SHARE_SECTIONS } from '../sharedRecord.service.js';
import { RecordShare } from '../../models/recordShare.model.js';

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

  it('không gửi nhóm, hoặc lượt chia sẻ cũ chưa có trường nhóm → chia sẻ tất cả', async () => {
    const { share: s3, qrToken: q3 } = await createShare(me, hospitalId, t0);
    expect(s3.sections).toEqual(SHARE_SECTIONS);
    await RecordShare.updateOne({ _id: s3._id }, { $unset: { sections: 1 } }); // giả lập bản ghi tạo trước khi có tính năng
    const { viewerToken } = await redeemQr(q3, { now: t0 });
    expect((await resolveViewer(viewerToken, { now: t0 })).sections).toEqual(SHARE_SECTIONS);
  });
});
