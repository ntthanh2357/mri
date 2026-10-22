import mongoose from 'mongoose';
import { vitalFromVisit, normalizeTemperature, syncVisitVitals } from '../vitalSign.service.js';
import { VitalSign } from '../../models/vitalSign.model.js';

describe('Đồng bộ sinh hiệu lượt khám sang VitalSign — hàm thuần (UC-PAT-12)', () => {
  it('đọc huyết áp dạng chuỗi "120/80" (cho phép khoảng trắng) và giữ thân nhiệt', () => {
    const v = vitalFromVisit({ pulse: 82, bloodPressure: '128 / 84', spo2: 97, temperature: 37.2 });
    expect(v.blood_pressure.systolic).toBe(128);
    expect(v.blood_pressure.diastolic).toBe(84);
    expect(v.pulse).toBe(82);
    expect(v.spo2).toBe(97);
    expect(v.temperature).toBe(37.2);
  });

  it('thiếu chỉ số bắt buộc (mạch, huyết áp, SpO₂) thì không tạo bản ghi', () => {
    expect(vitalFromVisit({ pulse: 80, bloodPressure: '', spo2: 98 })).toBeNull();
    expect(vitalFromVisit({ pulse: null, bloodPressure: '120/80', spo2: 98 })).toBeNull();
    expect(vitalFromVisit({ pulse: 80, bloodPressure: '120/80' })).toBeNull();
    expect(vitalFromVisit(null)).toBeNull();
  });

  it('thân nhiệt ngoài khoảng hợp lý (nhập nhầm) thì bỏ qua, các chỉ số khác vẫn lưu', () => {
    expect(normalizeTemperature(37)).toBe(37);
    expect(normalizeTemperature('36.8')).toBe(36.8);
    expect(normalizeTemperature(370)).toBeNull();
    expect(normalizeTemperature(NaN)).toBeNull();
    expect(vitalFromVisit({ pulse: 80, bloodPressure: '120/80', spo2: 98, temperature: 0 }).temperature).toBeNull();
  });
});

describe('Đồng bộ sinh hiệu lượt khám — trên DB (UC-PAT-12)', () => {
  const hospitalId = new mongoose.Types.ObjectId();
  const patientId = new mongoose.Types.ObjectId();
  const visitId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/neuroscan_test_logic';
    if (mongoose.connection.readyState === 0) await mongoose.connect(mongoUri);
    // Lần đo trước có cân nặng/chiều cao → lần mới kế thừa để vẫn tính được BMI
    await VitalSign.create({ hospitalId, patient_id: patientId, pulse: 70, blood_pressure: { systolic: 118, diastolic: 76 }, spo2: 98, weight: 64, height: 168, recorded_at: new Date(Date.now() - 86400000) });
  });

  afterAll(async () => {
    await VitalSign.deleteMany({ hospitalId });
  });

  it('mỗi lượt khám chỉ 1 bản ghi: điều dưỡng sửa lại số đo thì cập nhật, không sinh thêm', async () => {
    const visit = { _id: visitId, hospitalId, patientId, vitals: { pulse: 90, bloodPressure: '135/88', spo2: 96, temperature: 38.1 } };
    const first = await syncVisitVitals(visit);
    expect(first.temperature).toBe(38.1);
    expect(first.weight).toBe(64);
    visit.vitals = { ...visit.vitals, pulse: 84, temperature: 37.6 };
    await syncVisitVitals(visit);
    const rows = await VitalSign.find({ hospitalId, visit_id: visitId }).lean();
    expect(rows.length).toBe(1);
    expect(rows[0].pulse).toBe(84);
    expect(rows[0].temperature).toBe(37.6);
  });

  it('số đo thiếu chỉ số bắt buộc thì không ghi gì', async () => {
    const res = await syncVisitVitals({ _id: new mongoose.Types.ObjectId(), hospitalId, patientId, vitals: { pulse: 80 } });
    expect(res).toBeNull();
  });
});
