import mongoose from 'mongoose';
import {
  pickNextTicket, ticketStats, AVG_SERVE_MINUTES, normalizeQueueSettings,
  takeTicket, getMyTicket, cancelMyTicket, callNext, markArrived, markMissed, markServed,
} from '../queueTicket.service.js';
import { QueueTicket } from '../../models/queueTicket.model.js';
import { QueueCounter } from '../../models/queueCounter.model.js';
import { tenantStorage } from '../../middlewares/tenant.middleware.js';

const t = (number, status, extra = {}) => ({ _id: `t${number}`, number, status, ...extra });

describe('Số thứ tự tiếp đón — hàm thuần (UC-PAT-03)', () => {
  it('gọi số tiếp theo theo thứ tự; số đã gọi/vắng/xong bị bỏ qua', () => {
    const list = [t(1, 'served'), t(2, 'missed'), t(3, 'waiting'), t(4, 'waiting')];
    expect(pickNextTicket(list, 2).number).toBe(3);
    expect(pickNextTicket([t(1, 'served')], 1)).toBeNull();
  });

  it('người lỡ lượt quay lại (lễ tân bấm "Đã tới") được chèn lên gọi ngay tiếp theo', () => {
    const list = [t(2, 'arrived', { arrivedAt: new Date(2026, 9, 6, 9, 0) }), t(5, 'waiting'), t(1, 'arrived', { arrivedAt: new Date(2026, 9, 6, 9, 5) })];
    expect(pickNextTicket(list, 4).number).toBe(2); // tới trước được gọi trước
  });

  it('ước tính: số người phía trước và giờ dự kiến (không còn khung tới muộn — tới muộn thì được chèn lên)', () => {
    const now = new Date(2026, 9, 6, 8, 0);
    const list = [t(3, 'called'), t(4, 'waiting'), t(5, 'missed'), t(6, 'waiting'), t(7, 'waiting'), t(2, 'arrived')];
    const s = ticketStats(list, 3, t(7, 'waiting'), now);
    expect(s.current).toBe(3);
    expect(s.ahead).toBe(3); // 4, 6 + người lỡ lượt số 2 được chèn lên
    expect(s.estimatedAt.getTime()).toBe(now.getTime() + 3 * AVG_SERVE_MINUTES * 60000);
    expect('lateUntil' in s).toBe(false);
    // Bệnh viện chỉnh 6 phút/người
    expect(ticketStats(list, 3, t(7, 'waiting'), now, 6).estimatedAt.getTime()).toBe(now.getTime() + 3 * 6 * 60000);
    expect(ticketStats(list, 3, t(5, 'missed'), now).ahead).toBeNull();
  });

  it('"số đang gọi" là số vừa gọi gần nhất — kể cả khi gọi lại người lỡ lượt có số nhỏ hơn', () => {
    const list = [t(2, 'served'), t(1, 'called', { calledAt: new Date(2026, 9, 6, 9, 10) }), t(3, 'waiting')];
    expect(ticketStats(list, 2, null).current).toBe(1);
    expect(ticketStats([t(2, 'served')], 2, null).current).toBe(2);
  });
});

describe('Cài đặt số phút tiếp nhận mỗi người (UC-PAT-03)', () => {
  it('nhận số nguyên 1–60 phút, từ chối giá trị khác', () => {
    expect(normalizeQueueSettings({ avgServeMinutes: '7' }).settings.avgServeMinutes).toBe(7);
    expect(Boolean(normalizeQueueSettings({ avgServeMinutes: 0 }).error)).toBe(true);
    expect(Boolean(normalizeQueueSettings({ avgServeMinutes: 61 }).error)).toBe(true);
    expect(Boolean(normalizeQueueSettings({ avgServeMinutes: 'abc' }).error)).toBe(true);
    expect(Boolean(normalizeQueueSettings({ avgServeMinutes: 7.5 }).error)).toBe(true);
  });
});

describe('Số thứ tự tiếp đón — trên DB (UC-PAT-03)', () => {
  const hospitalId = new mongoose.Types.ObjectId();
  const [p1, p2, p3] = [1, 2, 3].map(() => new mongoose.Types.ObjectId());
  const asPatient = (id, fn) => tenantStorage.run({ role: 'patient', userId: String(id), hospitalId: String(hospitalId) }, fn);
  const asStaff = (fn) => tenantStorage.run({ role: 'receptionist', userId: 'staff', hospitalId: String(hospitalId) }, fn);

  beforeAll(async () => {
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/neuroscan_test_logic';
    if (mongoose.connection.readyState === 0) await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await QueueTicket.deleteMany({ hospitalId });
    await QueueCounter.deleteMany({ hospitalId });
  });

  it('cấp số tăng dần; lấy lại khi đang có số thì trả về số cũ', async () => {
    const a = await asPatient(p1, () => takeTicket(p1, hospitalId));
    const b = await asPatient(p2, () => takeTicket(p2, hospitalId));
    const again = await asPatient(p1, () => takeTicket(p1, hospitalId));
    expect(a.number).toBe(1);
    expect(b.number).toBe(2);
    expect(again.number).toBe(1);
  });

  it('lễ tân gọi số 1 → vắng; gọi tiếp số 2; số 1 tới muộn → được gọi ngay sau đó', async () => {
    await asPatient(p3, () => takeTicket(p3, hospitalId)); // số 3
    const first = await asStaff(() => callNext(hospitalId));
    expect(first.number).toBe(1);
    await asStaff(() => markMissed(hospitalId, first._id));
    const mine = await asPatient(p1, () => getMyTicket(p1, hospitalId));
    expect(mine.ticket.status).toBe('missed');
    const second = await asStaff(() => callNext(hospitalId));
    expect(second.number).toBe(2);
    await asStaff(() => markServed(hospitalId, second._id));
    await asStaff(() => markArrived(hospitalId, first._id));
    const third = await asStaff(() => callNext(hospitalId));
    expect(third.number).toBe(1); // chèn lên trước số 3
    const next = await asStaff(() => callNext(hospitalId));
    expect(next.number).toBe(3);
  });

  it('bệnh nhân huỷ số của mình; không thấy số của người khác', async () => {
    const other = await asPatient(p2, () => getMyTicket(p2, hospitalId));
    expect(other.ticket.number).toBe(2);
    const p4 = new mongoose.Types.ObjectId();
    await asPatient(p4, () => takeTicket(p4, hospitalId));
    const cancelled = await asPatient(p4, () => cancelMyTicket(p4, hospitalId));
    expect(cancelled.status).toBe('cancelled');
    const fresh = await asPatient(p4, () => takeTicket(p4, hospitalId));
    expect(fresh.number).toBe(5); // huỷ xong lấy lại thì nhận số mới
  });
});
