import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV tiêu chuẩn cho GCM
const PREFIX = "enc:v1:";

const getEncryptionKey = () => {
  const key = process.env.FIELD_ENCRYPTION_KEY;
  if (!key) {
    // 32-byte key dự phòng phát triển
    return crypto.createHash("sha256").update("neuroscan_field_encryption_master_key_2026").digest();
  }
  return crypto.createHash("sha256").update(key).digest();
};

/**
 * Mã hóa AES-256-GCM cho các trường dữ liệu y tế nhạy cảm đặc biệt
 * Đáp ứng: HIPAA §164.312(a)(2)(iv) Encryption at Rest
 */
export const encryptField = (plainText) => {
  if (plainText === null || plainText === undefined || plainText === "") {
    return plainText;
  }
  if (typeof plainText === "string" && plainText.startsWith(PREFIX)) {
    return plainText; // Đã được mã hóa trước đó
  }

  const textToEncrypt = typeof plainText === "string" ? plainText : JSON.stringify(plainText);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(textToEncrypt, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");
  return `${PREFIX}${iv.toString("hex")}:${authTag}:${encrypted}`;
};

/**
 * Giải mã AES-256-GCM
 */
export const decryptField = (cipherText) => {
  if (!cipherText || typeof cipherText !== "string" || !cipherText.startsWith(PREFIX)) {
    return cipherText; // Trả về nguyên văn nếu không phải chuỗi mã hóa
  }

  try {
    const parts = cipherText.slice(PREFIX.length).split(":");
    if (parts.length !== 3) return cipherText;

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const key = getEncryptionKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    console.warn("Lỗi giải mã trường dữ liệu:", err.message);
    return "[DỮ LIỆU ĐƯỢC MÃ HÓA KHÔNG THỂ GIẢI MÃ]";
  }
};
