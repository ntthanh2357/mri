import mongoose from 'mongoose';
import {
  MRI_SCREENING_QUESTIONS, normalizeScreening, screeningLevel, mriPreparation, getMriPrep, saveMriScreening,
} from '../mriPrep.service.js';
import { Visit } from '../../models/visit.model.js';
import { ConsentForm } from '../../models/consentForm.model.js';

const statusOf = async (fn) => { try { await fn(); return 200; } catch (e) { return e.status || 500; } };
const allNo = () => Object.fromEntries(MRI_SCREENING_QUESTIONS.map((q) => [q.key, 'no']));
const NOW = new Date('2026-10-15T09:00:00+07:00');
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600 * 1000);

describe('Chuẩn bị chụp MRI: hướng dẫn + phiếu sàng lọc an toàn bệnh nhân tự khai', () => {
  it('bộ câu hỏi có đủ các chống chỉ định chính của MRI, đánh dấu câu nguy hiểm', () => {
    const keys = MRI_SCREENING_QUESTIONS.map((q) => q.key);
    for (const k of ['pacemaker', 'aneurysmClip', 'cochlearImplant', 'metalFragments', 'implants', 'pregnant', 'claustrophobia']) expect(keys.includes(k)).toBe(true);
    const danger = MRI_SCREENING_QUESTIONS.filter((q) => q.danger).map((q) => q.key);
    expect(danger.includes('pacemaker') && danger.includes('metalFragments') && !danger.includes('claustrophobia')).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('kiểm tra câu trả lời: phải trả lời đủ, chỉ nhận có / không / không rõ, ghi chú cắt gọn', () => {
    const ok = normalizeScreening({ answers: { ...allNo(), implants: 'yes' }, details: '  Nẹp vít xương đùi   năm 2020 ' });
    expect(ok.answers.implants).toBe('yes');
    expect(ok.details).toBe('Nẹp vít xương đùi năm 2020');
    expect(normalizeScreening({ answers: allNo(), details: 'x'.repeat(2000) }).details.length).toBe(500);
    const bad = [
      undefined, {}, { answers: 'no' }, { answers: { pacemaker: 'no' } }, // thiếu câu
      { answers: { ...allNo(), pacemaker: 'có' } }, { answers: { ...allNo(), pacemaker: { $ne: 1 } } },
      { answers: { ...allNo(), hack: 'no' } }, { answers: allNo(), details: { a: 1 } },
    ];
    for (const b of bad) {
      let err; try { normalizeScreening(b); } catch (e) { err = e; }
      expect(err?.status).toBe(400);
    }
  });

  it('mức cảnh báo: câu nguy hiểm trả lời "có" hoặc "không rõ" → nguy hiểm; câu khác "có" → cần lưu ý; còn lại → an toàn', () => {
    expect(screeningLevel(allNo())).toBe('clear');
    expect(screeningLevel({ ...allNo(), claustrophobia: 'yes' })).toBe('attention');
    expect(screeningLevel({ ...allNo(), implants: 'unsure' })).toBe('attention');
    expect(screeningLevel({ ...allNo(), pacemaker: 'yes' })).toBe('danger');
    expect(screeningLevel({ ...allNo(), metalFragments: 'unsure' })).toBe('danger');
  });

  it('hướng dẫn chuẩn bị: mẫu chung + phần riêng khi có tiêm thuốc + ghi chú của bác sĩ', () => {
    const plain = mriPreparation({ mriOrder: { region: 'Sọ não' } });
    const joined = plain.items.join(' ');
    expect(joined.includes('kim loại') && joined.includes('30 phút')).toBe(true);
    expect(joined.includes('Nhịn ăn')).toBe(false);
    expect(plain.doctorNote).toBe('');
    const contrast = mriPreparation({ mriOrder: { withContrast: true, instructions: '  Mang theo phim cũ  ' } });
    expect(contrast.items.join(' ').includes('Nhịn ăn')).toBe(true);
    expect(contrast.items.join(' ').includes('phiếu đồng thuận')).toBe(true);
    expect(contrast.doctorNote).toBe('Mang theo phim cũ');
  });

  describe('lưu trữ', () => {
    const hospitalId = new mongoose.Types.ObjectId();
    const me = new mongoose.Types.ObjectId('6f0000000000000000000c01');
    const other = new mongoose.Types.ObjectId('6f0000000000000000000c02');
    const cleanup = async () => {
      await Visit.collection.deleteMany({ patientId: { $in: [me, other] } });
      await ConsentForm.collection.deleteMany({ patientId: { $in: [me, other] } });
    };
    const add = async (doc) => (await Visit.collection.insertOne({ hospitalId, isDeleted: false, createdAt: hoursAgo(2), updatedAt: hoursAgo(1), ...doc })).insertedId;

    beforeAll(async () => {
      const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/neuroscan_test_logic';
      if (mongoose.connection.readyState === 0) await mongoose.connect(mongoUri);
      await cleanup();
    });
    afterAll(cleanup);

    it('chưa có chỉ định chụp → không có gì để chuẩn bị', async () => {
      await add({ patientId: me, status: 'đang khám' });
      expect(await getMriPrep(me, NOW)).toBe(null);
    });

    it('có chỉ định chụp: trả hướng dẫn, bộ câu hỏi, trạng thái phiếu cản quang; khai xong lưu vào lượt khám', async () => {
      await Visit.collection.deleteMany({ patientId: me });
      const id = await add({ patientId: me, status: 'chờ chụp', mriOrder: { region: 'Sọ não', withContrast: true, orderedAt: hoursAgo(1), instructions: 'Mang phim cũ' } });
      const prep = await getMriPrep(me, NOW);
      expect(prep.visitId).toBe(String(id));
      expect(prep.region).toBe('Sọ não');
      expect(prep.questions.length).toBe(MRI_SCREENING_QUESTIONS.length);
      expect(prep.screening).toBe(null);
      expect(prep.locked).toBe(false);
      expect(prep.consentPending).toBe(true);
      expect(prep.preparation.doctorNote).toBe('Mang phim cũ');

      const saved = await saveMriScreening(me, String(id), { answers: { ...allNo(), metalFragments: 'unsure' }, details: 'Từng làm thợ hàn' }, NOW);
      expect(saved.level).toBe('danger');
      const raw = await Visit.collection.findOne({ _id: id });
      expect(raw.patientMriScreening.answers.metalFragments).toBe('unsure');
      expect(raw.patientMriScreening.level).toBe('danger');
      expect(new Date(raw.patientMriScreening.declaredAt).getTime()).toBe(NOW.getTime());
      expect(raw.mriSafetyChecklist?.isScreened || false).toBe(false); // KTV vẫn phải tự kiểm tra và xác nhận
      expect((await getMriPrep(me, NOW)).screening.details).toBe('Từng làm thợ hàn');
    });

    it('chỉ chủ lượt khám mới khai được; mã sai → 404; KTV đã kiểm tra hoặc đã bắt đầu chụp → khoá (409)', async () => {
      const id = String((await Visit.collection.findOne({ patientId: me, status: 'chờ chụp' }))._id);
      const body = { answers: allNo() };
      expect(await statusOf(() => saveMriScreening(other, id, body, NOW))).toBe(404);
      expect(await statusOf(() => saveMriScreening(me, 'khong-phai-ma', body, NOW))).toBe(404);
      expect(await statusOf(() => saveMriScreening(me, { $ne: null }, body, NOW))).toBe(404);
      const noOrder = String(await add({ patientId: me, status: 'đang khám' }));
      expect(await statusOf(() => saveMriScreening(me, noOrder, body, NOW))).toBe(409);

      await Visit.collection.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $set: { 'mriSafetyChecklist.isScreened': true } });
      expect(await statusOf(() => saveMriScreening(me, id, body, NOW))).toBe(409);
      expect((await getMriPrep(me, NOW)).locked).toBe(true);
      const scanning = String(await add({ patientId: me, status: 'đang chụp', createdAt: hoursAgo(0.5), mriOrder: { orderedAt: hoursAgo(1) } }));
      expect(await statusOf(() => saveMriScreening(me, scanning, body, NOW))).toBe(409);
      // KTV xác nhận an toàn là lượt khám tự sang "đang chụp": màn chuẩn bị vẫn hiện lượt đó, ở dạng khoá
      const shown = await getMriPrep(me, NOW);
      expect(shown.visitId).toBe(scanning);
      expect(shown.locked).toBe(true);
    });
  });
});
