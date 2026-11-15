import {
  evaluateVitalSigns,
  checkVitalSigns,
  parseBloodPressure,
  resolvePatientAge,
  getVitalThresholds,
  normalizeGender,
  VITAL_THRESHOLDS
} from '../vitalsSafety.service.js';

describe('Unit Tests: Vitals Safety Evaluation (UC-NUR-02) - Phân tầng Độ tuổi & Giới tính', () => {
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
    expect(result.patientContext.ageGroup).toBe('ADULT');
  });

  test('2. Cảnh báo Mạch bất thường: < 60 bpm (nhịp chậm) hoặc > 100 bpm (nhịp nhanh) ở người lớn', () => {
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

  test('6. Cảnh báo Nhịp thở bất thường (< 12 hoặc > 20 lần/phút) ở người lớn', () => {
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

  test('9. Phân tầng Nhi khoa: Trẻ sơ sinh (Newborn) & Trẻ nhũ nhi (Infant)', () => {
    // Trẻ sơ sinh 15 ngày tuổi (ageMonths: 0.5)
    // Mạch 130 bpm, nhịp thở 40 lần/phút là bình thường (người lớn sẽ bị báo động sai)
    const newbornVitals = evaluateVitalSigns(
      { pulse: 130, bloodPressure: '75/45', temperature: 36.8, spo2: 97, respiratoryRate: 40 },
      { ageMonths: 0.5 }
    );
    expect(newbornVitals.isAbnormal).toBe(false);
    expect(newbornVitals.patientContext.ageGroup).toBe('NEWBORN');
    expect(newbornVitals.patientContext.ageGroupLabel).toContain('Trẻ sơ sinh');

    // Trẻ sơ sinh mạch 80 bpm là nhịp chậm nguy hiểm (ở người lớn 80 là bình thường)
    const newbornLowPulse = evaluateVitalSigns(
      { pulse: 80 },
      { ageMonths: 0.5 }
    );
    expect(newbornLowPulse.isAbnormal).toBe(true);
    expect(newbornLowPulse.flags.pulse).toBe(true);
    expect(newbornLowPulse.alerts[0].message).toContain('Nhịp tim chậm');

    // Trẻ nhũ nhi 6 tháng tuổi (age: 0.5)
    const infantVitals = evaluateVitalSigns(
      { pulse: 110, bloodPressure: '85/55', temperature: 36.9, spo2: 98, respiratoryRate: 30 },
      { age: 0.5 }
    );
    expect(infantVitals.isAbnormal).toBe(false);
    expect(infantVitals.patientContext.ageGroup).toBe('INFANT');
  });

  test('10. Phân tầng Trẻ nhỏ (Toddler 3 tuổi) & Trẻ em (Child 9 tuổi)', () => {
    // Bé 3 tuổi: mạch 115 bpm, nhịp thở 24 lần/phút là bình thường sinh lý
    const toddler = evaluateVitalSigns(
      { pulse: 115, bloodPressure: '95/60', temperature: 36.7, spo2: 99, respiratoryRate: 24 },
      { age: 3 }
    );
    expect(toddler.isAbnormal).toBe(false);
    expect(toddler.patientContext.ageGroup).toBe('TODDLER');

    // Bé 9 tuổi: nhịp thở 32 lần/phút là thở nhanh bất thường (>25)
    const childFastBreath = evaluateVitalSigns(
      { respiratoryRate: 32 },
      { age: 9 }
    );
    expect(childFastBreath.isAbnormal).toBe(true);
    expect(childFastBreath.flags.respiratoryRate).toBe(true);
    expect(childFastBreath.patientContext.ageGroup).toBe('CHILD');
  });

  test('11. Phân tầng Người cao tuổi (Elderly ≥ 65 tuổi)', () => {
    // Cụ ông 72 tuổi: huyết áp 142/85 mmHg, mạch 58 bpm, SpO2 94% nằm trong ngưỡng dung nạp sinh lý
    const elderlyOk = evaluateVitalSigns(
      { pulse: 58, bloodPressure: '142/85', temperature: 36.4, spo2: 94, respiratoryRate: 18 },
      { age: 72, gender: 'Nam' }
    );
    expect(elderlyOk.isAbnormal).toBe(false);
    expect(elderlyOk.patientContext.ageGroup).toBe('ELDERLY');
    expect(elderlyOk.patientContext.gender).toBe('Nam');

    // Huyết áp 155/95 mmHg ở người cao tuổi vẫn phải báo động tăng huyết áp
    const elderlyHighBP = evaluateVitalSigns(
      { systolic: 155, diastolic: 95 },
      { age: 72 }
    );
    expect(elderlyHighBP.isAbnormal).toBe(true);
    expect(elderlyHighBP.flags.systolic).toBe(true);
    expect(elderlyHighBP.flags.diastolic).toBe(true);
  });

  test('12. Phân tầng Giới tính ở Người lớn (Adult Male vs Female)', () => {
    // Phụ nữ trẻ 25 tuổi: huyết áp 88/58 mmHg là bình thường sinh lý (ngưỡng nữ: 85–135 / 55–85)
    const youngWoman = evaluateVitalSigns(
      { bloodPressure: '88/58' },
      { age: 25, gender: 'Nữ' }
    );
    expect(youngWoman.isAbnormal).toBe(false);
    expect(youngWoman.patientContext.gender).toBe('Nữ');

    // Nam thanh niên 25 tuổi: huyết áp 88/58 mmHg bị cảnh báo tụt huyết áp (ngưỡng nam: 90–140 / 60–90)
    const youngMan = evaluateVitalSigns(
      { bloodPressure: '88/58' },
      { age: 25, gender: 'Nam' }
    );
    expect(youngMan.isAbnormal).toBe(true);
    expect(youngMan.flags.systolic).toBe(true);
    expect(youngMan.flags.diastolic).toBe(true);
  });

  test('13. resolvePatientAge tính đúng từ các định dạng dữ liệu khác nhau', () => {
    expect(resolvePatientAge({ age: 30 })).toBe(30);
    expect(resolvePatientAge({ patientAge: 45 })).toBe(45);
    expect(resolvePatientAge({ ageMonths: 6 })).toBe(0.5);

    const currentYear = new Date().getFullYear();
    expect(resolvePatientAge({ birthYear: currentYear - 50 })).toBe(50);

    const dobString = `${currentYear - 20}-01-01`;
    expect(resolvePatientAge({ dateOfBirth: dobString })).toBeGreaterThanOrEqual(19);

    expect(resolvePatientAge({})).toBe(null);
    expect(resolvePatientAge(null)).toBe(null);
  });

  test('14. Tương thích ngược toàn diện: fallback về ngưỡng người lớn khi không truyền tuổi/giới tính', () => {
    const defaultResult = evaluateVitalSigns({ pulse: 80, bloodPressure: '120/80', temperature: 37.0, spo2: 98, respiratoryRate: 16 });
    expect(defaultResult.isAbnormal).toBe(false);
    expect(defaultResult.patientContext.ageGroup).toBe('ADULT');
    expect(defaultResult.patientContext.gender).toBe('Khác/Không rõ');
    expect(defaultResult.thresholdsUsed.PULSE.MIN).toBe(60);
    expect(defaultResult.thresholdsUsed.PULSE.MAX).toBe(100);
  });
});
