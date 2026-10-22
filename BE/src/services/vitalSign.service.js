import { VitalSign } from "../models/vitalSign.model.js";

/**
 * UC-PAT-12 — Gộp sinh hiệu về một nguồn (VitalSign) để bệnh nhân xem biểu đồ diễn biến.
 * Số đo điều dưỡng nhập ở lượt khám (visit.vitals: huyết áp dạng chuỗi "120/80") được chép sang;
 * mỗi lượt khám giữ đúng 1 bản ghi (visit_id), sửa số đo thì cập nhật bản ghi đó.
 */

const num = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v));

/** Thân nhiệt hợp lý 30–45 °C; ngoài khoảng (nhập nhầm) → null để không làm méo biểu đồ. */
export const normalizeTemperature = (t) => {
  const n = num(t);
  return Number.isFinite(n) && n >= 30 && n <= 45 ? n : null;
};

/** visit.vitals → dữ liệu VitalSign; null nếu thiếu chỉ số bắt buộc (mạch, huyết áp, SpO₂). */
export const vitalFromVisit = (vitals) => {
  if (!vitals) return null;
  const m = String(vitals.bloodPressure || "").match(/^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/);
  const pulse = num(vitals.pulse);
  const spo2 = num(vitals.spo2);
  if (!m || !Number.isFinite(pulse) || !Number.isFinite(spo2)) return null;
  return {
    pulse,
    blood_pressure: { systolic: Number(m[1]), diastolic: Number(m[2]) },
    spo2,
    temperature: normalizeTemperature(vitals.temperature),
  };
};

/** Chép sinh hiệu của lượt khám sang VitalSign (1 bản ghi/lượt khám). Trả bản ghi hoặc null. */
export const syncVisitVitals = async (visit) => {
  const data = vitalFromVisit(visit?.vitals);
  if (!data || !visit.patientId) return null;
  const patientId = visit.patientId._id || visit.patientId;

  let row = await VitalSign.findOne({ hospitalId: visit.hospitalId, visit_id: visit._id });
  if (!row) {
    // Kế thừa cân nặng/chiều cao gần nhất để vẫn có BMI
    const latest = await VitalSign.findOne({ hospitalId: visit.hospitalId, patient_id: patientId }).sort({ recorded_at: -1 }).lean();
    row = new VitalSign({
      hospitalId: visit.hospitalId,
      patient_id: patientId,
      visit_id: visit._id,
      weight: latest?.weight,
      height: latest?.height,
      bmi: latest?.bmi,
      recorded_at: visit.vitals?.measuredAt || visit.createdAt || new Date(), // số đo cũ: lấy ngày của lượt khám
    });
  }
  Object.assign(row, data);
  await row.save();
  return row;
};
