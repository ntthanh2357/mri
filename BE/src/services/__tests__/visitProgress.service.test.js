import mongoose from 'mongoose';
import { toVisitProgress, findCurrentVisit, getVisitProgress, PATIENT_STEPS } from '../visitProgress.service.js';
import { Visit } from '../../models/visit.model.js';
import { User } from '../../models/user.model.js';
import { ConsentForm } from '../../models/consentForm.model.js';
import { CONTRAST_PROCEDURE } from '../contrastConsent.service.js';

const NOW = new Date('2026-10-15T09:00:00+07:00');
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600 * 1000);
const stateOf = (p) => Object.fromEntries(p.steps.map((s) => [s.key, s.state]));

describe('Theo dõi lượt khám của bệnh nhân (UC-PAT-05)', () => {
  it('6 bước dễ hiểu theo đúng thứ tự', () => {
    expect(PATIENT_STEPS.map((s) => s.label)).toEqual(['Tiếp đón', 'Chờ khám', 'Khám bệnh', 'Chụp MRI', 'Chờ kết quả', 'Hoàn tất']);
  });

  it('mới tiếp đón: bước "Chờ khám" đang diễn ra; chưa đo sinh hiệu thì nhắc sẽ được đo', () => {
    const p = toVisitProgress({ _id: 'v1', status: 'đang chờ', createdAt: hoursAgo(1) });
    expect(stateOf(p)).toEqual({ checkin: 'done', waiting: 'current', exam: 'todo', imaging: 'todo', result: 'todo', done: 'todo' });
    expect(p.message.includes('đo sinh hiệu')).toBe(true);
    expect(p.steps[0].at.getTime()).toBe(hoursAgo(1).getTime());
    const measured = toVisitProgress({ _id: 'v1', status: 'đang chờ', createdAt: hoursAgo(1), vitals: { bloodPressure: '120/80', measuredAt: hoursAgo(0.5) } });
    expect(measured.message.includes('Đã đo sinh hiệu')).toBe(true);
  });

  it('khám bệnh: ghi tên bác sĩ, nhưng không khẳng định bác sĩ ĐANG khám (đo sinh hiệu xong là hệ thống tự chuyển sang bước này)', () => {
    const p = toVisitProgress({ _id: 'v1', status: 'đang khám', createdAt: hoursAgo(1), vitals: { measuredAt: hoursAgo(0.5) }, doctorId: { profile: { name: 'BS Nguyễn Gia Huy' } } });
    expect(stateOf(p).exam).toBe('current');
    expect(p.message.includes('BS Nguyễn Gia Huy')).toBe(true);
    expect(p.message.includes('Đã đo sinh hiệu')).toBe(true);
    expect(p.message.includes('đang khám cho bạn')).toBe(false);
    expect(p.steps.find((s) => s.key === 'waiting').at.getTime()).toBe(hoursAgo(0.5).getTime()); // giờ đo sinh hiệu
    expect(p.doctorName).toBe('BS Nguyễn Gia Huy');
  });

  it('mọi trạng thái chụp đều thuộc bước "Chụp MRI"; có tiêm cản quang thì báo kèm', () => {
    for (const status of ['chờ chụp', 'đang chụp', 'chờ chụp lại', 'chờ chụp sau phẫu thuật']) {
      expect(stateOf(toVisitProgress({ status, createdAt: hoursAgo(2), mriOrder: { region: 'Sọ não', orderedAt: hoursAgo(1) } })).imaging).toBe('current');
    }
    const p = toVisitProgress({ status: 'chờ chụp', createdAt: hoursAgo(2), mriOrder: { region: 'Sọ não', withContrast: true, orderedAt: hoursAgo(1) } });
    expect(p.mri).toEqual({ ordered: true, region: 'Sọ não', withContrast: true, screening: null, screened: false });
    const declared = toVisitProgress({ status: 'chờ chụp', createdAt: hoursAgo(2), mriOrder: { orderedAt: hoursAgo(1) }, patientMriScreening: { level: 'attention', declaredAt: hoursAgo(0.5) }, mriSafetyChecklist: { isScreened: true } });
    expect(declared.mri.screening).toBe('attention');
    expect(declared.mri.screened).toBe(true);
    expect(p.message.includes('Sọ não')).toBe(true);
    expect(p.steps.find((s) => s.key === 'imaging').at.getTime()).toBe(hoursAgo(1).getTime());
  });

  it('chờ kết quả: lời lẽ bình tĩnh, không lộ trạng thái kỹ thuật nội bộ (lỗi AI, AI...)', () => {
    for (const status of ['chờ kết quả AI', 'lỗi AI', 'chờ bác sĩ đọc', 'chờ hội chẩn']) {
      const p = toVisitProgress({ status, createdAt: hoursAgo(5), mriOrder: { orderedAt: hoursAgo(4) } });
      expect(stateOf(p).result).toBe('current');
      expect(stateOf(p).imaging).toBe('done');
      const json = JSON.stringify(p);
      expect(json.includes('lỗi') || json.includes('AI') || json.includes(status)).toBe(false);
    }
  });

  it('hoàn tất không có chụp MRI: 2 bước chụp và chờ kết quả ghi là "không cần"', () => {
    const p = toVisitProgress({ status: 'hoàn tất', createdAt: hoursAgo(3), updatedAt: hoursAgo(1) });
    expect(stateOf(p)).toEqual({ checkin: 'done', waiting: 'done', exam: 'done', imaging: 'skipped', result: 'skipped', done: 'current' });
    expect(p.finished).toBe(true);
    const withMri = toVisitProgress({ status: 'đã đóng', createdAt: hoursAgo(3), mriOrder: { orderedAt: hoursAgo(2) } });
    expect(stateOf(withMri).imaging).toBe('done');
  });

  it('chuyển nhập viện / hẹn tái khám: lượt khám xong, kèm hướng dẫn tiếp theo', () => {
    expect(toVisitProgress({ status: 'chờ nhập viện', createdAt: hoursAgo(3) }).message.includes('nhập viện')).toBe(true);
    expect(toVisitProgress({ status: 'tái khám định kỳ', createdAt: hoursAgo(3) }).message.includes('tái khám')).toBe(true);
  });

  it('đã huỷ hoặc vắng mặt: báo huỷ, không có bước đang diễn ra', () => {
    for (const status of ['đã hủy', 'no_show']) {
      const p = toVisitProgress({ status, createdAt: hoursAgo(2) });
      expect(p.cancelled).toBe(true);
      expect(p.steps.some((s) => s.state === 'current')).toBe(false);
    }
  });

  it('trạng thái lạ (dữ liệu cũ) không làm hỏng: coi như đang chờ khám', () => {
    expect(stateOf(toVisitProgress({ status: 'gì đó', createdAt: hoursAgo(1) })).waiting).toBe('current');
  });

  describe('chọn lượt khám để hiện', () => {
    const hospitalId = new mongoose.Types.ObjectId();
    const me = new mongoose.Types.ObjectId('6f0000000000000000000b01');
    const other = new mongoose.Types.ObjectId('6f0000000000000000000b02');
    const cleanup = async () => {
      await Visit.collection.deleteMany({ patientId: { $in: [me, other] } });
      await User.collection.deleteMany({ _id: { $in: [me, other] } });
      await ConsentForm.collection.deleteMany({ patientId: { $in: [me, other] } });
    };
    const add = (doc) => Visit.collection.insertOne({ hospitalId, isDeleted: false, ...doc });

    beforeAll(async () => {
      const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/neuroscan_test_logic';
      if (mongoose.connection.readyState === 0) await mongoose.connect(mongoUri);
      await cleanup();
    });
    afterAll(cleanup);

    it('không có lượt khám nào → null', async () => {
      expect(await findCurrentVisit(me, NOW)).toBe(null);
    });

    it('lượt chưa xong quá 3 ngày, lượt xong từ hôm trước, lượt đã xoá: không hiện', async () => {
      await add({ patientId: me, status: 'đang chờ', createdAt: hoursAgo(80), updatedAt: hoursAgo(80) });
      await add({ patientId: me, status: 'hoàn tất', createdAt: hoursAgo(30), updatedAt: hoursAgo(28) });
      await add({ patientId: me, status: 'đang khám', createdAt: hoursAgo(1), updatedAt: hoursAgo(1), isDeleted: true });
      expect(await findCurrentVisit(me, NOW)).toBe(null);
    });

    it('chờ kết quả vẫn hiện tới 14 ngày; lượt mới nhất được ưu tiên; không lẫn lượt của người khác', async () => {
      await add({ patientId: me, status: 'chờ bác sĩ đọc', createdAt: hoursAgo(24 * 10), updatedAt: hoursAgo(24 * 9), mriOrder: { orderedAt: hoursAgo(24 * 10) } });
      expect((await findCurrentVisit(me, NOW)).status).toBe('chờ bác sĩ đọc');
      await add({ patientId: other, status: 'đang khám', createdAt: hoursAgo(0.5), updatedAt: hoursAgo(0.5) });
      expect((await findCurrentVisit(me, NOW)).status).toBe('chờ bác sĩ đọc');
      await add({ patientId: me, status: 'đang chờ', createdAt: hoursAgo(1), updatedAt: hoursAgo(1) });
      expect((await findCurrentVisit(me, NOW)).status).toBe('đang chờ');
    });

    it('lượt xong trong hôm nay vẫn hiện (để bệnh nhân biết đã hoàn tất)', async () => {
      await Visit.collection.deleteMany({ patientId: me });
      await add({ patientId: me, status: 'hoàn tất', createdAt: hoursAgo(4), updatedAt: hoursAgo(1) });
      expect((await findCurrentVisit(me, NOW)).status).toBe('hoàn tất');
    });

    it('API: chỉ trả bản đã quy đổi; báo còn phiếu cản quang chưa ký', async () => {
      await Visit.collection.deleteMany({ patientId: me });
      const { insertedId } = await add({ patientId: me, status: 'chờ chụp', createdAt: hoursAgo(2), updatedAt: hoursAgo(1), mriOrder: { region: 'Sọ não', withContrast: true, orderedAt: hoursAgo(1) }, mriSafetyChecklist: { notes: 'ghi chú nội bộ' } });
      const p = await getVisitProgress(me, NOW);
      expect(p.visitId).toBe(String(insertedId));
      expect(p.mri.consentPending).toBe(true);
      expect(JSON.stringify(p).includes('ghi chú nội bộ')).toBe(false);
      expect('status' in p).toBe(false); // không trả tên trạng thái nội bộ
      await ConsentForm.collection.insertOne({ visitId: insertedId, hospitalId, patientId: me, procedureName: CONTRAST_PROCEDURE, patientSigned: true });
      expect((await getVisitProgress(me, NOW)).mri.consentPending).toBe(false);
      expect((await getVisitProgress(other, NOW)).visitId === String(insertedId)).toBe(false); // người khác chỉ thấy lượt của họ
      expect(await getVisitProgress(new mongoose.Types.ObjectId(), NOW)).toBe(null);
    });
  });
});
