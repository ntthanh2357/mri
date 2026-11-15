import fs from "fs";
import crypto from "crypto";
import { encryptBuffer, decryptBuffer } from "./cryptoStorage.util.js";

/**
 * Bản sao lưu dạng phong bì mã hóa AES-256-GCM (khóa FILE_ENCRYPTION_KEY) — dùng cho sao lưu theo viện
 * (admin) và cron sao lưu toàn DB. Trước đây hai luồng này ghi JSON bản rõ (lượt khám, người dùng, hóa đơn).
 * Phần `meta` (không chứa dữ liệu bệnh nhân) để đối chiếu viện khi tải / khôi phục mà không cần giải mã.
 */
export const BACKUP_FORMAT = "neuroscan-encrypted-backup-v1";

export const writeEncryptedBackup = (filePath, payload, meta = {}) => {
  const plain = Buffer.from(JSON.stringify(payload), "utf8");
  const { encryptedBuffer, ivHex, authTagHex } = encryptBuffer(plain);
  const envelope = {
    format: BACKUP_FORMAT,
    meta: { ...meta, createdAt: new Date().toISOString() },
    algorithm: "aes-256-gcm",
    iv: ivHex,
    authTag: authTagHex,
    sha256: crypto.createHash("sha256").update(plain).digest("hex"),
    data: encryptedBuffer.toString("base64"),
  };
  fs.writeFileSync(filePath, JSON.stringify(envelope), "utf8");
  return envelope;
};

/** Đọc phong bì (không giải mã) — dùng kiểm tra viện trước khi cho tải */
export const readBackupEnvelope = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

/** Giải mã và kiểm tra toàn vẹn; tệp bản rõ đời cũ (không có format) trả nguyên nội dung */
export const readEncryptedBackup = (filePath) => {
  const envelope = readBackupEnvelope(filePath);
  if (envelope?.format !== BACKUP_FORMAT) return { meta: null, payload: envelope, legacyPlaintext: true };
  const plain = decryptBuffer(Buffer.from(envelope.data, "base64"), envelope.iv, envelope.authTag);
  if (crypto.createHash("sha256").update(plain).digest("hex") !== envelope.sha256) {
    throw new Error("Tệp sao lưu không toàn vẹn (sai mã băm).");
  }
  return { meta: envelope.meta, payload: JSON.parse(plain.toString("utf8")), legacyPlaintext: false };
};
