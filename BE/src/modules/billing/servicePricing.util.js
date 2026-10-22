/**
 * Bảng giá dịch vụ của bệnh viện → dòng hóa đơn.
 * Giá luôn tính ở máy chủ theo hospital.pricing để điều dưỡng/lễ tân không sửa được số tiền.
 */
const has = (s, ...keys) => keys.some((k) => s.includes(k));

export const priceService = (name, pricing = {}) => {
  const s = String(name || "").toLowerCase();
  if (has(s, "mri", "cộng hưởng từ")) return { amount: pricing.mriFee ?? 1500000, type: "mri" };
  if (has(s, "phân tích ai", " ai ", "ai chẩn đoán") || /^ai\b/.test(s)) return { amount: pricing.aiFee ?? 200000, type: "ai" };
  if (has(s, "khám")) return { amount: pricing.examFee ?? 150000, type: "exam" };
  if (has(s, "xét nghiệm")) return { amount: pricing.labFee ?? 150000, type: "other" };
  if (has(s, "siêu âm")) return { amount: pricing.ultrasoundFee ?? 250000, type: "other" };
  if (has(s, "x-quang", "xquang", "x quang")) return { amount: pricing.xrayFee ?? 150000, type: "other" };
  return { amount: pricing.serviceFee ?? 150000, type: "other" };
};

/** Phiếu chỉ định → danh sách dòng hóa đơn (luôn có phí khám nếu chỉ định chưa gồm dịch vụ khám) */
export const buildServiceItems = (services = [], pricing = {}) => {
  const items = services.map((svc) => ({ description: svc, ...priceService(svc, pricing) }));
  if (!items.some((i) => i.type === "exam")) {
    items.unshift({ description: "Khám chuyên khoa thần kinh", amount: pricing.examFee ?? 150000, type: "exam" });
  }
  return items;
};

/** Lượt khám đã có đủ sinh hiệu chính chưa */
export const hasVitals = (visit) => {
  const v = visit?.vitals || {};
  return v.pulse != null && !!v.bloodPressure && v.temperature != null && v.spo2 != null;
};
