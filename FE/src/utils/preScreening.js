// UC-NUR-03 — Sàng lọc sơ bộ dị ứng & chống chỉ định. Bản BE tương ứng: BE/src/services/preScreening.service.js
// Hàm thuần để xem trước mức nguy cơ ngay trên form, trước khi lưu.

export const SCREEN_QUESTIONS = [
  { key: 'asthma', title: 'Hen phế quản', hint: 'Bệnh nhân có tiền sử hen / khó thở khò khè?' },
  { key: 'renalFailure', title: 'Suy thận', hint: 'Có suy thận, đang lọc thận hoặc eGFR thấp?' },
  { key: 'contrastReaction', title: 'Phản ứng thuốc cản quang', hint: 'Từng nổi mẩn, khó thở, sốc khi tiêm thuốc cản quang?' },
];

export const ANSWER_LABEL = { no: 'Không', yes: 'Có', unknown: 'Chưa rõ' };

export const RISK_META = {
  none: { label: 'Không phát hiện nguy cơ', tone: 'success' },
  caution: { label: 'Cần lưu ý', tone: 'warning' },
  high: { label: 'Chống chỉ định / nguy cơ cao', tone: 'error' },
};

export const emptyScreening = () => ({
  asthma: { answer: 'no', note: '' },
  renalFailure: { answer: 'no', note: '' },
  contrastReaction: { answer: 'no', note: '' },
  otherAllergies: '',
  notes: '',
});

export const evaluatePreScreening = (data = {}) => {
  const flags = [];
  let level = 0;
  const raise = (n) => { if (n > level) level = n; };

  const c = data.contrastReaction?.answer;
  if (c === 'yes') { flags.push('Từng phản ứng với thuốc cản quang — cân nhắc không dùng hoặc chuẩn bị dự phòng'); raise(2); }
  else if (c === 'unknown') { flags.push('Chưa rõ tiền sử phản ứng thuốc cản quang — hỏi lại trước khi chỉ định'); raise(1); }

  const r = data.renalFailure?.answer;
  if (r === 'yes') { flags.push('Có suy thận — cần kiểm tra eGFR trước khi tiêm thuốc cản quang'); raise(2); }
  else if (r === 'unknown') { flags.push('Chưa rõ tiền sử suy thận — nên xét nghiệm creatinine/eGFR'); raise(1); }

  const a = data.asthma?.answer;
  if (a === 'yes') { flags.push('Có hen phế quản — nguy cơ phản ứng dị ứng với cản quang cao hơn'); raise(1); }
  else if (a === 'unknown') { flags.push('Chưa rõ tiền sử hen phế quản'); raise(1); }

  if (String(data.otherAllergies || '').trim()) { flags.push(`Dị ứng khác: ${String(data.otherAllergies).trim()}`); raise(1); }

  return { riskLevel: ['none', 'caution', 'high'][level], flags };
};

/** Biến dữ liệu đã lưu của lượt khám thành state form (hoặc form trống nếu chưa sàng lọc). */
export const screeningFromVisit = (visit) => {
  const s = visit?.preScreening;
  if (!s?.screened) return emptyScreening();
  return {
    asthma: { answer: s.asthma?.answer || 'no', note: s.asthma?.note || '' },
    renalFailure: { answer: s.renalFailure?.answer || 'no', note: s.renalFailure?.note || '' },
    contrastReaction: { answer: s.contrastReaction?.answer || 'no', note: s.contrastReaction?.note || '' },
    otherAllergies: s.otherAllergies || '',
    notes: s.notes || '',
  };
};
