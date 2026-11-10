/**
 * Chuẩn hóa phần đánh giá thần kinh / chăm sóc của phiếu chăm sóc điều dưỡng (UC-NUR-04) — hàm thuần.
 * Nguyên tắc: KHÔNG tự điền giá trị "bình thường" cho thứ điều dưỡng chưa đánh giá.
 * Trước đây thiếu thành phần GCS thì lấy mức tối đa (4/5/6 → 15 "Tỉnh táo"), thiếu đồng tử thì 2.5mm,
 * nên phiếu có thể ghi bệnh nhân tỉnh táo trong khi diễn biến ghi "lơ mơ".
 * Trả về { error } (400) hoặc { value: { careLevel, glasgow, pupils, surgicalDrainage, fluidInfusions } }.
 */
const blank = (v) => v === undefined || v === null || String(v).trim() === "";
const num = (v) => (blank(v) ? null : Number(v));
const REFLEXES = ["+", "chậm", "-"];

export const classifyGlasgow = (total) => {
  if (total <= 8) return "Hôn mê sâu / Nguy kịch (Cảnh báo)";
  if (total <= 12) return "Hôn mê vừa";
  if (total <= 14) return "Hôn mê nhẹ / Lú lẫn";
  return "Tỉnh táo / Tri giác tốt";
};

export const normalizeCareAssessment = ({ careLevel, glasgow, pupils, surgicalDrainage, fluidInfusions } = {}) => {
  const value = {};

  // Cấp chăm sóc: không gửi → mặc định cấp 3 như trước; gửi thì phải là 1, 2 hoặc 3
  if (blank(careLevel)) value.careLevel = 3;
  else {
    const lv = Number(careLevel);
    if (![1, 2, 3].includes(lv)) return { error: "Cấp chăm sóc phải là 1, 2 hoặc 3." };
    value.careLevel = lv;
  }

  // Glasgow: không đánh giá → bỏ trống; đã đánh giá → đủ 3 thành phần, đúng khoảng
  if (glasgow && typeof glasgow === "object") {
    const parts = { eye: num(glasgow.eye), verbal: num(glasgow.verbal), motor: num(glasgow.motor) };
    const given = Object.values(parts).filter((x) => x !== null);
    if (given.length > 0) {
      const ok = Number.isInteger(parts.eye) && parts.eye >= 1 && parts.eye <= 4
        && Number.isInteger(parts.verbal) && parts.verbal >= 1 && parts.verbal <= 5
        && Number.isInteger(parts.motor) && parts.motor >= 1 && parts.motor <= 6;
      if (!ok) return { error: "Thang điểm Glasgow cần đủ 3 thành phần: mở mắt 1–4, lời nói 1–5, vận động 1–6." };
      const totalScore = parts.eye + parts.verbal + parts.motor;
      value.glasgow = { ...parts, totalScore, classification: classifyGlasgow(totalScore) };
    }
  }

  // Đồng tử: cần kích thước cả 2 bên (mm); chỉ có phản xạ mặc định "+" thì coi như chưa đánh giá
  if (pupils && typeof pupils === "object") {
    const left = num(pupils.leftSize);
    const right = num(pupils.rightSize);
    const shape = blank(pupils.shape) ? "" : String(pupils.shape).trim();
    if (left !== null || right !== null || shape) {
      const sizeOk = (x) => Number.isFinite(x) && x >= 1 && x <= 9;
      if (!sizeOk(left) || !sizeOk(right)) return { error: "Nhập kích thước đồng tử cả hai bên (1–9 mm)." };
      for (const r of [pupils.leftLightReflex, pupils.rightLightReflex]) {
        if (!blank(r) && !REFLEXES.includes(String(r))) return { error: "Phản xạ ánh sáng của đồng tử phải là +, chậm hoặc -." };
      }
      value.pupils = {
        leftSize: left,
        rightSize: right,
        ...(blank(pupils.leftLightReflex) ? {} : { leftLightReflex: String(pupils.leftLightReflex) }),
        ...(blank(pupils.rightLightReflex) ? {} : { rightLightReflex: String(pupils.rightLightReflex) }),
        ...(shape ? { shape } : {}),
        ...(blank(pupils.notes) ? {} : { notes: String(pupils.notes) }),
      };
    }
  }

  // Dẫn lưu: có vị trí thì phải có thể tích đo được
  if (surgicalDrainage && typeof surgicalDrainage === "object" && !blank(surgicalDrainage.site)) {
    const vol = num(surgicalDrainage.volume);
    if (!(Number.isFinite(vol) && vol >= 0)) return { error: "Nhập thể tích dịch dẫn lưu (ml)." };
    value.surgicalDrainage = {
      site: String(surgicalDrainage.site).trim(),
      volume: vol,
      ...(blank(surgicalDrainage.color) ? {} : { color: String(surgicalDrainage.color) }),
      ...(blank(surgicalDrainage.condition) ? {} : { condition: String(surgicalDrainage.condition) }),
      ...(blank(surgicalDrainage.notes) ? {} : { notes: String(surgicalDrainage.notes) }),
    };
  }

  // Truyền dịch: dòng có tên dịch thì phải có thể tích (ml)
  if (Array.isArray(fluidInfusions)) {
    const rows = [];
    for (const f of fluidInfusions) {
      if (!f || blank(f.fluidName)) continue;
      const vol = num(f.volume);
      if (!(Number.isFinite(vol) && vol > 0)) return { error: `Nhập thể tích (ml) cho dịch truyền ${String(f.fluidName).trim()}.` };
      const { volume: _v, ...rest } = f;
      rows.push({ ...rest, fluidName: String(f.fluidName).trim(), volume: vol });
    }
    value.fluidInfusions = rows;
  }

  return { value };
};
