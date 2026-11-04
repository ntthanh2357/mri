// "Sức khỏe của tôi" — diễn giải chỉ số cho bệnh nhân bằng lời dễ hiểu, giọng bình tĩnh.
// Hàm thuần (không import react-native) để test bằng node. Ngưỡng theo mức thường dùng cho người lớn,
// hỗ trợ phân tầng theo độ tuổi và giới tính khi truyền patientContext;
// chỉ để tham khảo, không thay lời khuyên của bác sĩ (màn hình luôn ghi rõ điều này).

import { getVitalThresholds } from './vitalSignsSafety.js';

const status = (level, label) => ({ level, label });

/** Huyết áp theo phân loại ACC/AHA 2017: bình thường <120/<80, hơi cao 120–129/<80, cao ≥130 hoặc ≥80; có phân tầng độ tuổi/giới tính nếu có context. */
export const bpStatus = (bp, patientContext) => {
  if (!bp || typeof bp.systolic !== 'number' || typeof bp.diastolic !== 'number') return null;
  const { systolic: s, diastolic: d } = bp;

  if (patientContext && (patientContext.age !== undefined || patientContext.gender !== undefined || patientContext.birthYear !== undefined)) {
    const { thresholds } = getVitalThresholds(patientContext);
    if (s > thresholds.SYSTOLIC.MAX || d > thresholds.DIASTOLIC.MAX) return status('high', 'Cao hơn mức bình thường');
    if (s < thresholds.SYSTOLIC.MIN || d < thresholds.DIASTOLIC.MIN) return status('low', 'Thấp hơn mức bình thường');
    return status('normal', 'Bình thường');
  }

  if (s >= 130 || d >= 80) return status('high', 'Cao hơn mức bình thường');
  if (s >= 120) return status('elevated', 'Hơi cao');
  return status('normal', 'Bình thường');
};

/** Mạch lúc nghỉ: 60–100 lần/phút (người lớn) hoặc theo khoảng tham chiếu tuổi. */
export const pulseStatus = (pulse, patientContext) => {
  if (typeof pulse !== 'number') return null;

  if (patientContext && (patientContext.age !== undefined || patientContext.gender !== undefined || patientContext.birthYear !== undefined)) {
    const { thresholds } = getVitalThresholds(patientContext);
    if (pulse < thresholds.PULSE.MIN) return status('low', 'Chậm hơn mức thường gặp');
    if (pulse > thresholds.PULSE.MAX) return status('high', 'Nhanh hơn mức thường gặp');
    return status('normal', 'Bình thường');
  }

  if (pulse < 60) return status('low', 'Chậm hơn mức thường gặp');
  if (pulse > 100) return status('high', 'Nhanh hơn mức thường gặp');
  return status('normal', 'Bình thường');
};

/** SpO₂: ≥95% là bình thường (người cao tuổi ≥94%). */
export const spo2Status = (spo2, patientContext) => {
  if (typeof spo2 !== 'number') return null;

  if (patientContext && (patientContext.age !== undefined || patientContext.gender !== undefined || patientContext.birthYear !== undefined)) {
    const { thresholds } = getVitalThresholds(patientContext);
    if (spo2 < thresholds.SPO2.MIN) return status('low', 'Thấp hơn mức bình thường');
    return status('normal', 'Bình thường');
  }

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

/** Thân nhiệt (°C): 35–37.4 bình thường, 37.5–37.9 hơi cao, ≥38 sốt, <35 thấp. */
export const temperatureStatus = (t, patientContext) => {
  if (typeof t !== 'number') return null;

  if (patientContext && (patientContext.age !== undefined || patientContext.gender !== undefined || patientContext.birthYear !== undefined)) {
    const { thresholds } = getVitalThresholds(patientContext);
    if (t > thresholds.TEMPERATURE.MAX) return status('high', t >= 38 ? 'Sốt' : 'Hơi cao');
    if (t < thresholds.TEMPERATURE.MIN) return status('low', 'Thấp hơn mức bình thường');
    return status('normal', 'Bình thường');
  }

  if (t >= 38) return status('high', 'Sốt');
  if (t >= 37.5) return status('elevated', 'Hơi cao');
  if (t < 35) return status('low', 'Thấp hơn mức bình thường');
  return status('normal', 'Bình thường');
};

// ── UC-PAT-12: biểu đồ diễn biến sinh hiệu ──
// band = vùng bình thường để tô nền tham chiếu; lines = các đường vẽ (huyết áp có 2 đường)
export const VITAL_METRICS = [
  { key: 'bp', label: 'Huyết áp', unit: 'mmHg', band: { min: 80, max: 120 }, lines: ['Tâm thu', 'Tâm trương'], pick: (v) => [v.blood_pressure?.systolic, v.blood_pressure?.diastolic] },
  { key: 'pulse', label: 'Mạch', unit: 'lần/phút', band: { min: 60, max: 100 }, lines: ['Mạch'], pick: (v) => [v.pulse] },
  { key: 'spo2', label: 'SpO₂', unit: '%', band: { min: 95, max: 100 }, lines: ['SpO₂'], pick: (v) => [v.spo2] },
  { key: 'temperature', label: 'Thân nhiệt', unit: '°C', band: { min: 36, max: 37.4 }, lines: ['Thân nhiệt'], pick: (v) => [v.temperature] },
];

/** Tạo danh sách metric với vùng tham chiếu band thích ứng theo độ tuổi và giới tính của bệnh nhân */
export const getVitalMetricsForPatient = (patientContext) => {
  const { thresholds } = getVitalThresholds(patientContext);
  return [
    { key: 'bp', label: 'Huyết áp', unit: 'mmHg', band: { min: thresholds.SYSTOLIC.MIN, max: thresholds.SYSTOLIC.MAX }, lines: ['Tâm thu', 'Tâm trương'], pick: (v) => [v.blood_pressure?.systolic, v.blood_pressure?.diastolic] },
    { key: 'pulse', label: 'Mạch', unit: 'lần/phút', band: { min: thresholds.PULSE.MIN, max: thresholds.PULSE.MAX }, lines: ['Mạch'], pick: (v) => [v.pulse] },
    { key: 'spo2', label: 'SpO₂', unit: '%', band: { min: thresholds.SPO2.MIN, max: thresholds.SPO2.MAX }, lines: ['SpO₂'], pick: (v) => [v.spo2] },
    { key: 'temperature', label: 'Thân nhiệt', unit: '°C', band: { min: thresholds.TEMPERATURE.MIN, max: thresholds.TEMPERATURE.MAX }, lines: ['Thân nhiệt'], pick: (v) => [v.temperature] },
  ];
};

/** Chuỗi điểm cũ → mới của 1 chỉ số, bỏ lần đo thiếu chỉ số đó, lấy tối đa `limit` lần gần nhất. */
export const vitalSeries = (items, metricKey, limit = 12) => {
  const metric = VITAL_METRICS.find((m) => m.key === metricKey);
  if (!metric) return [];
  return [...(items || [])]
    .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at))
    .map((v) => ({ date: new Date(v.recorded_at), values: metric.pick(v) }))
    .filter((p) => p.values.every((x) => typeof x === 'number' && Number.isFinite(x)))
    .slice(-limit);
};

/** Khoảng trục tung bao cả dữ liệu lẫn vùng bình thường, chừa lề 10%. */
export const chartRange = (points, band) => {
  const all = points.flatMap((p) => p.values).concat(band ? [band.min, band.max] : []);
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (max - min < 1) { min -= 1; max += 1; }
  const pad = (max - min) * 0.1;
  return { min: min - pad, max: max + pad };
};
