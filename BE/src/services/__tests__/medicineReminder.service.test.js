import mongoose from 'mongoose';
import { scheduleFor, slotOfTime, normalizeReminderTimes, saveReminderTimes, getReminderTimes } from '../medicineReminder.service.js';
import { MedicineReminder } from '../../models/medicineReminder.model.js';
import { PatientProfile } from '../../models/patientProfile.model.js';
import { tenantStorage } from '../../middlewares/tenant.middleware.js';

const PREFS = { morning: '07:00', noon: '11:30', afternoon: '16:00', evening: '21:30' };

describe('Giờ nhắc uống thuốc theo khung Sáng/Trưa/Chiều/Tối — hàm thuần (UC-PAT-13)', () => {
  it('chưa cài giờ riêng: giữ đúng giờ cố định cũ theo số lần/ngày', () => {
    expect(scheduleFor(1, null).map((s) => s.time).join()).toBe('08:00');
    expect(scheduleFor(2, null).map((s) => s.time).join()).toBe('08:00,20:00');
    expect(scheduleFor(3, null).map((s) => s.time).join()).toBe('08:00,13:00,20:00');
    expect(scheduleFor(4, null).map((s) => s.time).join()).toBe('08:00,12:00,17:00,21:00');
  });

  it('đã cài giờ riêng: 2 lần/ngày = sáng + tối, 3 lần = sáng + trưa + tối', () => {
    expect(scheduleFor(2, PREFS).map((s) => `${s.slot}@${s.time}`).join()).toBe('morning@07:00,evening@21:30');
    expect(scheduleFor(3, PREFS).map((s) => s.slot).join()).toBe('morning,noon,evening');
    expect(scheduleFor(9, PREFS).length).toBe(4);
  });

  it('suy ra khung giờ cho lịch nhắc cũ chưa có khung', () => {
    expect(slotOfTime('08:00')).toBe('morning');
    expect(slotOfTime('13:00')).toBe('noon');
    expect(slotOfTime('17:00')).toBe('afternoon');
    expect(slotOfTime('21:00')).toBe('evening');
  });

  it('kiểm tra giờ: đúng dạng HH:MM và tăng dần Sáng < Trưa < Chiều < Tối', () => {
    expect(normalizeReminderTimes({ morning: '7:05', noon: '11:30', afternoon: '16:00', evening: '21:30' }).times.morning).toBe('07:05');
    expect(Boolean(normalizeReminderTimes({ ...PREFS, noon: '25:00' }).error)).toBe(true);
    expect(Boolean(normalizeReminderTimes({ ...PREFS, afternoon: '11:00' }).error)).toBe(true);
    expect(Boolean(normalizeReminderTimes({ morning: '07:00' }).error)).toBe(true);
  });
});

describe('Giờ nhắc uống thuốc — đổi lịch nhắc trên DB (UC-PAT-13)', () => {
  const hospitalId = new mongoose.Types.ObjectId();
  const patientId = new mongoose.Types.ObjectId();
  const prescriptionId = new mongoose.Types.ObjectId();
  const day = (offset) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset); return d; };

  beforeAll(async () => {
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/neuroscan_test_logic';
    if (mongoose.connection.readyState === 0) await mongoose.connect(mongoUri);
    const base = { hospitalId, patientId, prescriptionId, drugName: 'Thuốc A' };
    await MedicineReminder.insertMany([
      { ...base, date: day(1), time: '08:00' },                            // tương lai, chưa có khung → suy ra sáng
      { ...base, date: day(1), time: '20:00', slot: 'evening' },           // tương lai, có khung
      { ...base, date: day(1), time: '13:00', status: 'done' },            // đã uống → giữ nguyên
      { ...base, date: day(-2), time: '08:00' },                           // quá khứ → giữ nguyên
    ]);
  });

  afterAll(async () => {
    await MedicineReminder.deleteMany({ hospitalId });
    await PatientProfile.deleteMany({ userId: patientId });
  });

  it('lưu giờ mới và dời các lần nhắc sắp tới chưa uống; không đụng lần đã uống hoặc ngày đã qua', async () => {
    // Chạy trong phiên bệnh nhân như request thật (tenancyPlugin chèn $or patientId/userId)
    const asPatient = (fn) => tenantStorage.run({ role: 'patient', userId: String(patientId) }, fn);
    const updated = await asPatient(() => saveReminderTimes(patientId, PREFS, hospitalId));
    expect(updated).toBe(2);
    const all = await MedicineReminder.find({ hospitalId }).lean();
    const times = all.map((r) => `${r.status}|${r.date < new Date() ? 'past' : 'future'}|${r.time}`).sort().join(',');
    expect(times).toBe('done|future|13:00,pending|future|07:00,pending|future|21:30,pending|past|08:00');
    expect((await asPatient(() => getReminderTimes(patientId))).evening).toBe('21:30');
  });
});
