/**
 * UC-REC-02 — Kiểm tra thẻ BHYT theo cấu trúc mã thẻ (QĐ 1351/QĐ-BHXH), dùng khi chưa kết nối cổng giám định BHXH.
 * Mã thẻ 15 ký tự: [2 chữ mã đối tượng][1 số mức hưởng][2 số mã tỉnh][10 số mã BHXH]
 */

// Mã đối tượng tham gia BHYT hợp lệ (2 ký tự đầu)
export const BHYT_OBJECT_CODES = [
  "DN", "HX", "CH", "NN", "TK", "HC", "XK", "HT", "TB", "NO", "CT", "XB", "TN", "CS", "XN", "MS",
  "QN", "CA", "CY", "HG", "TC", "CC", "CK", "CB", "KC", "HD", "TE", "BT", "HN", "DT", "DK", "XD",
  "TS", "TQ", "TA", "TY", "HS", "SV", "GB", "GD", "ND", "TH", "TV", "TL", "XV", "PV", "AK", "CN",
];

// Ký tự thứ 3 → tỷ lệ BHYT chi trả khi khám đúng tuyến
export const BHYT_LEVEL_RATE = { 1: 100, 2: 100, 3: 95, 4: 80, 5: 100 };

const normalizeName = (s) => String(s || "").normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

/** Phân tích mã thẻ → { ok, error, cardNumber, objectCode, benefitLevel, coverageRate } */
export const parseBhytCard = (raw) => {
  const cardNumber = String(raw || "").replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{13}$/.test(cardNumber)) {
    return { ok: false, error: "Mã thẻ BHYT không đúng định dạng: cần 15 ký tự gồm 2 chữ cái + 13 chữ số (VD: SV4484420058886)." };
  }
  const objectCode = cardNumber.slice(0, 2);
  if (!BHYT_OBJECT_CODES.includes(objectCode)) {
    return { ok: false, error: `Mã đối tượng "${objectCode}" không có trong danh mục của BHXH. Vui lòng kiểm tra lại 2 chữ cái đầu trên thẻ.` };
  }
  const benefitLevel = Number(cardNumber[2]);
  const coverageRate = BHYT_LEVEL_RATE[benefitLevel];
  if (!coverageRate) {
    return { ok: false, error: `Ký tự thứ 3 là mức hưởng, phải từ 1 đến 5 (thẻ đang ghi "${cardNumber[2]}").` };
  }
  return { ok: true, cardNumber, objectCode, benefitLevel, coverageRate };
};

/** So thông tin in trên thẻ với hồ sơ bệnh nhân → danh sách trường bị lệch */
export const compareHolder = (profile = {}, holder = {}) => {
  const mismatches = [];
  if (holder.name && profile.name && normalizeName(holder.name) !== normalizeName(profile.name)) mismatches.push("Họ tên");
  const holderYear = Number(String(holder.birthDate || "").slice(0, 4)) || null;
  if (holderYear && profile.birthYear && holderYear !== Number(profile.birthYear)) mismatches.push("Năm sinh");
  if (holder.gender && profile.gender && holder.gender !== profile.gender) mismatches.push("Giới tính");
  return mismatches;
};

/** Thẻ đã quá hạn sử dụng (so theo cuối ngày hết hạn) */
export const isCardExpired = (expiresAt) => {
  if (!expiresAt) return false;
  const end = new Date(expiresAt);
  end.setHours(23, 59, 59, 999);
  return end < new Date();
};

export const fmtDateVN = (d) => (d ? new Date(d).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—");

/** Ngày dạng YYYY-MM-DD có thật trên lịch (new Date() của JS tự "tràn" 2027-02-30 → 02/03 nên phải tự kiểm) */
export const isRealDate = (str) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(str || ""))) return false;
  const [y, m, d] = str.split("-").map(Number);
  if (m < 1 || m > 12) return false;
  return d >= 1 && d <= new Date(y, m, 0).getDate();
};
