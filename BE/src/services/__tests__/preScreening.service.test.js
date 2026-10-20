import { evaluatePreScreening, sanitizePreScreening } from '../preScreening.service.js';

describe('Unit Tests: Sàng lọc dị ứng & chống chỉ định (UC-NUR-03)', () => {
  const clean = { asthma: { answer: 'no' }, renalFailure: { answer: 'no' }, contrastReaction: { answer: 'no' } };

  test('1. Không có tiền sử nào → nguy cơ none, không có cảnh báo', () => {
    const r = evaluatePreScreening(clean);
    expect(r.riskLevel).toBe('none');
    expect(r.flags.length).toBe(0);
  });

  test('2. Hen phế quản → caution', () => {
    const r = evaluatePreScreening({ ...clean, asthma: { answer: 'yes' } });
    expect(r.riskLevel).toBe('caution');
    expect(r.flags.length).toBe(1);
  });

  test('3. Suy thận hoặc từng phản ứng cản quang → high', () => {
    expect(evaluatePreScreening({ ...clean, renalFailure: { answer: 'yes' } }).riskLevel).toBe('high');
    expect(evaluatePreScreening({ ...clean, contrastReaction: { answer: 'yes' } }).riskLevel).toBe('high');
  });

  test('4. Câu trả lời "chưa rõ" và dị ứng khác → caution; high luôn thắng caution', () => {
    expect(evaluatePreScreening({ ...clean, renalFailure: { answer: 'unknown' } }).riskLevel).toBe('caution');
    expect(evaluatePreScreening({ ...clean, otherAllergies: 'Penicillin' }).riskLevel).toBe('caution');
    expect(evaluatePreScreening({ ...clean, asthma: { answer: 'yes' }, contrastReaction: { answer: 'yes' } }).riskLevel).toBe('high');
  });

  test('5. sanitize: chặn giá trị lạ, cắt khoảng trắng, đặt unknown khi thiếu', () => {
    const s = sanitizePreScreening({ asthma: { answer: 'maybe', note: '  hen nhẹ  ' }, otherAllergies: '  tôm ' });
    expect(s.asthma.answer).toBe('unknown');
    expect(s.asthma.note).toBe('hen nhẹ');
    expect(s.renalFailure.answer).toBe('unknown');
    expect(s.otherAllergies).toBe('tôm');
  });
});
