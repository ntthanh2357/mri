import {
  evaluateVitalSigns,
  checkVitalSigns,
  parseBloodPressure,
  VITAL_THRESHOLDS
} from '../vitalsSafety.service.js';

describe('Unit Tests: Vitals Safety Evaluation (UC-NUR-02)', () => {
  test('1. Chỉ số sinh tồn hoàn toàn bình thường (không có cảnh báo đỏ)', () => {
    const normalVitals = {
      pulse: 75,
      bloodPressure: '120/80',
      temperature: 36.8,
      spo2: 98,
      respiratoryRate: 16
    };

    const result = evaluateVitalSigns(normalVitals);
    expect(result.isAbnormal).toBe(false);
    expect(result.alerts.length).toBe(0);
    expect(result.flags.pulse).toBe(false);
    expect(result.flags.bloodPressure).toBe(false);
    expect(result.flags.temperature).toBe(false);
    expect(result.flags.spo2).toBe(false);
    expect(result.flags.respiratoryRate).toBe(false);
  });

  test('2. Cảnh báo Mạch bất thường: < 60 bpm (nhịp chậm) hoặc > 100 bpm (nhịp nhanh)', () => {
    // Mạch chậm
    const lowPulse = evaluateVitalSigns({ pulse: 50, bloodPressure: '120/80', temperature: 37.0, spo2: 98, respiratoryRate: 16 });
    expect(lowPulse.isAbnormal).toBe(true);
    expect(lowPulse.flags.pulse).toBe(true);
    expect(lowPulse.alerts.some(a => a.key === 'pulse')).toBe(true);

    // Mạch nhanh
    const highPulse = evaluateVitalSigns({ pulse: 125, bloodPressure: '120/80', temperature: 37.0, spo2: 98, respiratoryRate: 16 });
    expect(highPulse.isAbnormal).toBe(true);
    expect(highPulse.flags.pulse).toBe(true);
  });

  test('3. Cảnh báo Huyết áp tâm thu/tâm trương bất thường: tụt huyết áp hoặc tăng huyết áp', () => {
    // Tụt huyết áp: 80/50 mmHg
    const lowBP = evaluateVitalSigns({ bloodPressure: '80/50' });
    expect(lowBP.isAbnormal).toBe(true);
    expect(lowBP.flags.bloodPressure).toBe(true);
    expect(lowBP.flags.systolic).toBe(true);
    expect(lowBP.flags.diastolic).toBe(true);

    // Tăng huyết áp: 160/95 mmHg
    const highBP = evaluateVitalSigns({ systolic: 160, diastolic: 95 });
    expect(highBP.isAbnormal).toBe(true);
    expect(highBP.flags.systolic).toBe(true);
    expect(highBP.flags.diastolic).toBe(true);
  });

  test('4. Cảnh báo Thân nhiệt bất thường: hạ thân nhiệt (<36.0°C) hoặc sốt (>37.5°C)', () => {
    const hypothermia = evaluateVitalSigns({ temperature: 35.2 });
    expect(hypothermia.isAbnormal).toBe(true);
    expect(hypothermia.flags.temperature).toBe(true);

    const fever = evaluateVitalSigns({ temperature: 38.8 });
    expect(fever.isAbnormal).toBe(true);
    expect(fever.flags.temperature).toBe(true);
  });

  test('5. Cảnh báo SpO2 tụt thấp nguy hiểm (< 95%)', () => {
    const lowSpo2 = evaluateVitalSigns({ spo2: 91 });
    expect(lowSpo2.isAbnormal).toBe(true);
    expect(lowSpo2.flags.spo2).toBe(true);
    expect(lowSpo2.alerts[0].severity).toBe('danger');
  });

  test('6. Cảnh báo Nhịp thở bất thường (< 12 hoặc > 20 lần/phút)', () => {
    const slowBreath = evaluateVitalSigns({ respiratoryRate: 8 });
    expect(slowBreath.isAbnormal).toBe(true);
    expect(slowBreath.flags.respiratoryRate).toBe(true);

    const fastBreath = evaluateVitalSigns({ breath: 28 });
    expect(fastBreath.isAbnormal).toBe(true);
    expect(fastBreath.flags.respiratoryRate).toBe(true);
  });

  test('7. Trường hợp thực tế từ UI (tất cả các chỉ số là 1)', () => {
    const allOnes = evaluateVitalSigns({
      pulse: 1,
      bloodPressure: '1',
      temperature: 1,
      spo2: 1,
      respiratoryRate: 1
    });

    expect(allOnes.isAbnormal).toBe(true);
    expect(allOnes.flags.pulse).toBe(true);
    expect(allOnes.flags.temperature).toBe(true);
    expect(allOnes.flags.spo2).toBe(true);
    expect(allOnes.flags.respiratoryRate).toBe(true);
    expect(allOnes.alerts.length).toBeGreaterThanOrEqual(4);
  });

  test('8. parseBloodPressure xử lý các định dạng linh hoạt', () => {
    expect(parseBloodPressure('120/80')).toEqual({ systolic: 120, diastolic: 80 });
    expect(parseBloodPressure('', 130, 85)).toEqual({ systolic: 130, diastolic: 85 });
    expect(parseBloodPressure({ systolic: 140, diastolic: 90 })).toEqual({ systolic: 140, diastolic: 90 });
  });
});
