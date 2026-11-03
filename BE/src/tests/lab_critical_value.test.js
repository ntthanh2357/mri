import { evaluateLabValue, formatReferenceRange } from '../modules/laboratory/labResult.util.js';

describe('Đánh giá kết quả xét nghiệm & critical value (P2-7)', () => {
  const glucose = {
    name: 'Glucose',
    unit: 'mmol/L',
    reference_range: {
      male: { min: 3.9, max: 6.4 },
      female: { min: 3.5, max: 5.5 },
    },
    critical_low: 2.5,
    critical_high: 25,
  };

  it('trong khoảng tham chiếu thì không bất thường, không nguy kịch', () => {
    const r = evaluateLabValue({ value: 5.2, gender: 'Nam', biomarker: glucose });
    expect(r.is_abnormal).toBe(false);
    expect(r.is_critical).toBe(false);
    expect(r.reference_range_display).toBe('3.9 - 6.4');
  });

  it('dùng đúng khoảng tham chiếu theo giới tính', () => {
    const nam = evaluateLabValue({ value: 6.0, gender: 'Nam', biomarker: glucose });
    const nu = evaluateLabValue({ value: 6.0, gender: 'Nữ', biomarker: glucose });
    expect(nam.is_abnormal).toBe(false);
    expect(nu.is_abnormal).toBe(true);
    expect(nu.abnormal_direction).toBe('HIGH');
    expect(nu.reference_range_display).toBe('3.5 - 5.5');
  });

  it('vượt ngưỡng nguy kịch cao → critical, báo đúng hướng và ngưỡng', () => {
    const r = evaluateLabValue({ value: 30, gender: 'Nam', biomarker: glucose });
    expect(r.is_critical).toBe(true);
    expect(r.is_abnormal).toBe(true);
    expect(r.abnormal_direction).toBe('HIGH');
    expect(r.critical_note).toContain('25');
  });

  it('xuống dưới ngưỡng nguy kịch thấp → critical LOW', () => {
    const r = evaluateLabValue({ value: 2.1, gender: 'Nam', biomarker: glucose });
    expect(r.is_critical).toBe(true);
    expect(r.abnormal_direction).toBe('LOW');
    expect(r.critical_note).toContain('2.5');
  });

  it('biomarker chưa cấu hình ngưỡng critical thì không tự cảnh báo', () => {
    const noCritical = { ...glucose, critical_low: null, critical_high: null };
    const r = evaluateLabValue({ value: 40, gender: 'Nam', biomarker: noCritical });
    expect(r.is_critical).toBe(false);
    expect(r.is_abnormal).toBe(true);
  });

  it('không có biomarker trong danh mục vẫn trả kết quả an toàn', () => {
    const r = evaluateLabValue({ value: 10, gender: 'Nam', biomarker: null });
    expect(r.is_critical).toBe(false);
    expect(r.is_abnormal).toBe(false);
  });

  it('format khoảng tham chiếu một phía', () => {
    expect(formatReferenceRange({ min: null, max: 37 })).toBe('<= 37');
    expect(formatReferenceRange({ min: 100, max: null })).toBe('>= 100');
    expect(formatReferenceRange(null)).toBe('');
  });
});
