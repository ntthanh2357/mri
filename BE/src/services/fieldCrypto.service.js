import crypto from "crypto";

/**
 * Mã hoá trường dữ liệu nhạy cảm (UC-PAT-02: số CCCD, số thẻ BHYT) bằng AES-256-GCM.
 * Định dạng lưu: "v1:<iv base64>:<authTag base64>:<ciphertext base64>".
 * Khoá: biến môi trường FIELD_ENCRYPTION_KEY = 32 byte (base64 44 ký tự hoặc hex 64 ký tự).
 * Production thiếu khoá → dừng hệ thống (fail-fast, giống JWT_SECRET); dev → khoá dev + cảnh báo.
 */

const VERSION = "v1";
let cachedKey = null;
let warned = false;

const getKey = () => {
  if (cachedKey) return cachedKey;
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (raw) {
    const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
    if (key.length !== 32) throw new Error("FIELD_ENCRYPTION_KEY phải là khoá 32 byte (base64 44 ký tự hoặc hex 64 ký tự).");
    cachedKey = key;
    return key;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("FATAL BẢO MẬT: Thiếu biến môi trường FIELD_ENCRYPTION_KEY để mã hoá CCCD/BHYT.");
  }
  if (!warned) {
    console.warn("[fieldCrypto] Chưa có FIELD_ENCRYPTION_KEY — đang dùng khoá DEV, không dùng cho dữ liệu thật.");
    warned = true;
  }
  cachedKey = crypto.createHash("sha256").update("neuroscan-dev-field-encryption-key").digest();
  return cachedKey;
};

export const isEncrypted = (value) => typeof value === "string" && value.startsWith(`${VERSION}:`) && value.split(":").length === 4;

export const encryptField = (plain) => {
  if (plain === undefined || plain === null || plain === "") return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
};

/** Giải mã; dữ liệu cũ chưa mã hoá trả nguyên văn; bản mã bị sửa → ném lỗi (không trả dữ liệu sai). */
export const decryptField = (value) => {
  if (!value) return "";
  if (!isEncrypted(value)) return String(value);
  const [, ivB64, tagB64, ctB64] = value.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
};

/** Che giá trị, chỉ để lộ `visible` ký tự cuối: "079201001234" → "********1234". */
export const maskTail = (value, visible = 4) => {
  const s = String(value || "");
  if (!s) return "";
  if (s.length <= visible) return "*".repeat(s.length);
  return "*".repeat(s.length - visible) + s.slice(-visible);
};
