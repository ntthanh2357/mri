import {
  encryptField,
  decryptField,
  hashField,
} from "../../services/fieldCrypto.service.js";

/** Chuẩn hoá số thẻ trước khi mã hoá/băm (bỏ khoảng trắng, viết hoa). */
export const normalizeBhytCardNumber = (raw) =>
  String(raw || "").replace(/\s/g, "").toUpperCase();

/**
 * [P1-9] Số thẻ BHYT không còn lưu plaintext:
 *  - cardNumber: bản mã AES-256-GCM
 *  - cardNumberHash: HMAC để tra cứu chính xác (IV ngẫu nhiên nên không thể so sánh bản mã)
 *  - cardLast4: 4 số cuối để hiển thị, không cần giải mã
 */
export const encryptBhytCardNumber = (raw) => {
  const plain = normalizeBhytCardNumber(raw);
  return {
    cardNumber: encryptField(plain),
    cardNumberHash: hashField(plain, "bhyt-card"),
    cardLast4: plain.slice(-4),
  };
};

/** Giải mã; dữ liệu cũ plaintext vẫn đọc được (tương thích trước migration). */
export const decryptBhytCardNumber = (cardNumber) => {
  if (!cardNumber) return "";
  try {
    return decryptField(cardNumber);
  } catch {
    return "";
  }
};

/** 4 số cuối của thẻ — ưu tiên trường lưu sẵn, fallback giải mã cho dữ liệu cũ. */
export const bhytCardLast4 = (doc = {}) => {
  if (doc.cardLast4) return doc.cardLast4;
  return decryptBhytCardNumber(doc.cardNumber).slice(-4);
};

/** Che số thẻ khi trả API: 3 ký tự đầu + dấu chấm + 4 số cuối. */
export const maskBhytCardNumber = (doc = {}) => {
  const plain = decryptBhytCardNumber(doc.cardNumber);
  if (!plain) return doc.cardLast4 ? `****${doc.cardLast4}` : "";
  const visibleTail = plain.slice(-4);
  return `${plain.slice(0, 3)}${"•".repeat(Math.max(0, plain.length - 7))}${visibleTail}`;
};

