// "Sức khỏe của tôi" — diễn giải chỉ số cho bệnh nhân bằng lời dễ hiểu, giọng bình tĩnh.
// Hàm thuần (không import react-native) để test bằng node. Ngưỡng theo mức thường dùng cho người lớn;
// chỉ để tham khảo, không thay lời khuyên của bác sĩ (màn hình luôn ghi rõ điều này).

const status = (level, label) => ({ level, label });

/** Huyết áp theo phân loại ACC/AHA 2017: bình thường <120/<80, hơi cao 120–129/<80, cao ≥130 hoặc ≥80. */
export const bpStatus = (bp) => {
  if (!bp || typeof bp.systolic !== 'number' || typeof bp.diastolic !== 'number') return null;
  const { systolic: s, diastolic: d } = bp;
  if (s >= 130 || d >= 80) return status('high', 'Cao hơn mức bình thường');
  if (s >= 120) return status('elevated', 'Hơi cao');
  return status('normal', 'Bình thường');
};

/** Mạch lúc nghỉ: 60–100 lần/phút. */
export const pulseStatus = (pulse) => {
  if (typeof pulse !== 'number') return null;
  if (pulse < 60) return status('low', 'Chậm hơn mức thường gặp');
  if (pulse > 100) return status('high', 'Nhanh hơn mức thường gặp');
  return status('normal', 'Bình thường');
};

/** SpO₂: ≥95% là bình thường. */
export const spo2Status = (spo2) => {
  if (typeof spo2 !== 'number') return null;
  if (spo2 < 95) return status('low', 'Thấp hơn mức bình thường');
  return status('normal', 'Bình thường');
};

/** Kết quả 1 chỉ số xét nghiệm so với khoảng tham chiếu (BE đã đánh dấu is_abnormal). */
export const labResultFlag = (r) => {
  if (!r?.is_abnormal) return status('normal', 'Trong giới hạn');
  if (r.abnormal_direction === 'LOW') return status('low', 'Thấp hơn tham chiếu');
  return status('high', 'Cao hơn tham chiếu');
};

/** "2 lần/ngày, trong 7 ngày" — rỗng nếu thiếu dữ liệu. */
export const drugSchedule = (drug = {}) => {
  const parts = [];
  if (drug.timesPerDay) parts.push(`${drug.timesPerDay} lần/ngày`);
  if (drug.durationDays) parts.push(`trong ${drug.durationDays} ngày`);
  return parts.join(', ');
};

/** UC-PAT-13: lần uống chưa đánh dấu và đã tới giờ (so giờ:phút theo đồng hồ máy). */
export const isReminderDue = (item, now = new Date()) => {
  if (!item || item.status !== 'pending' || !item.time) return false;
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return item.time <= hhmm;
};
