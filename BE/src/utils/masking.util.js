/**
 * NeuroScan AI - Personal Identifiable Information (PII) Data Masking Utility
 * Tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân trong y tế.
 */

/**
 * Làm mờ số điện thoại (giữ 3 số đầu và 3 số cuối, che các số ở giữa)
 * Ví dụ: "0981234567" -> "098****567"
 */
export const maskPhone = (phone) => {
  if (!phone || typeof phone !== "string") return phone;
  const clean = phone.trim();
  if (clean.length < 7) return "***";
  return `${clean.slice(0, 3)}****${clean.slice(-3)}`;
};

/**
 * Làm mờ số Căn cước công dân / CMND (giữ 3 số đầu và 3 số cuối)
 * Ví dụ: "001098765432" -> "001******432"
 */
export const maskIdCard = (idCard) => {
  if (!idCard || typeof idCard !== "string") return idCard;
  const clean = idCard.trim();
  if (clean.length < 6) return "******";
  return `${clean.slice(0, 3)}******${clean.slice(-3)}`;
};

/**
 * Làm mờ số thẻ Bảo hiểm Y tế (BHYT - 15 ký tự)
 * Ví dụ: "GD4912345678901" -> "GD491******8901"
 */
export const maskBhyt = (bhyt) => {
  if (!bhyt || typeof bhyt !== "string") return bhyt;
  const clean = bhyt.trim();
  if (clean.length < 8) return "********";
  return `${clean.slice(0, 5)}******${clean.slice(-4)}`;
};

/**
 * Làm mờ địa chỉ email
 * Ví dụ: "doctor.tran@hospital.com" -> "doc***@hospital.com"
 */
export const maskEmail = (email) => {
  if (!email || typeof email !== "string" || !email.includes("@")) return email;
  const [user, domain] = email.split("@");
  const visible = user.slice(0, Math.min(3, user.length));
  return `${visible}***@${domain}`;
};
