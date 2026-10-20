// UC-NUR-03 — Sàng lọc sơ bộ dị ứng & chống chỉ định trước khám / trước chỉ định cản quang.
// Hàm thuần (không phụ thuộc DB) để test được. Bản FE tương ứng: FE/src/utils/preScreening.js

export const SCREEN_ANSWERS = ["no", "yes", "unknown"];

const cleanAnswer = (v) => (SCREEN_ANSWERS.includes(v) ? v : "unknown");
const cleanText = (v, max = 500) => String(v ?? "").trim().slice(0, max);

/** Chuẩn hóa dữ liệu điều dưỡng gửi lên (chặn giá trị lạ, cắt độ dài). */
export const sanitizePreScreening = (body = {}) => {
  const item = (x = {}) => ({ answer: cleanAnswer(x.answer), note: cleanText(x.note, 300) });
  return {
    asthma: item(body.asthma),
    renalFailure: item(body.renalFailure),
    contrastReaction: item(body.contrastReaction),
    otherAllergies: cleanText(body.otherAllergies, 300),
    notes: cleanText(body.notes, 800),
  };
};

/**
 * Đánh giá mức nguy cơ để bác sĩ thấy ngay:
 *  - high: từng phản ứng thuốc cản quang, hoặc suy thận (nguy cơ bệnh lý xơ hóa hệ thống do thận với Gadolinium)
 *  - caution: hen phế quản, dị ứng khác, hoặc có câu trả lời "chưa rõ"
 */
export const evaluatePreScreening = (data = {}) => {
  const flags = [];
  let level = 0; // 0 none, 1 caution, 2 high
  const raise = (n) => { if (n > level) level = n; };

  const c = data.contrastReaction?.answer;
  if (c === "yes") { flags.push("Từng phản ứng với thuốc cản quang — cân nhắc không dùng hoặc chuẩn bị dự phòng"); raise(2); }
  else if (c === "unknown") { flags.push("Chưa rõ tiền sử phản ứng thuốc cản quang — hỏi lại trước khi chỉ định"); raise(1); }

  const r = data.renalFailure?.answer;
  if (r === "yes") { flags.push("Có suy thận — cần kiểm tra eGFR trước khi tiêm thuốc cản quang"); raise(2); }
  else if (r === "unknown") { flags.push("Chưa rõ tiền sử suy thận — nên xét nghiệm creatinine/eGFR"); raise(1); }

  const a = data.asthma?.answer;
  if (a === "yes") { flags.push("Có hen phế quản — nguy cơ phản ứng dị ứng với cản quang cao hơn"); raise(1); }
  else if (a === "unknown") { flags.push("Chưa rõ tiền sử hen phế quản"); raise(1); }

  if (String(data.otherAllergies || "").trim()) { flags.push(`Dị ứng khác: ${String(data.otherAllergies).trim()}`); raise(1); }

  return { riskLevel: ["none", "caution", "high"][level], flags };
};
