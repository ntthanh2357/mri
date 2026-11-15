import { encryptField } from "../services/fieldCrypto.service.js";
import { getEncryptionKey } from "../utils/cryptoStorage.util.js";

/**
 * Kiểm tra khóa mã hóa ngay lúc khởi động (production).
 * Trước đây thiếu FIELD_ENCRYPTION_KEY chỉ lộ ra khi có thao tác lưu CCCD/BHYT (lỗi 500 giữa ca làm việc);
 * docker-compose ép NODE_ENV=production nhưng không yêu cầu khóa này. Nay dừng ngay khi khởi động, nêu tên biến thiếu,
 * không in giá trị khóa.
 * Trả về danh sách lỗi (rỗng = đủ khóa). Ngoài production luôn trả rỗng (dev dùng khóa DEV kèm cảnh báo).
 */
export const checkRequiredSecrets = () => {
  if (process.env.NODE_ENV !== "production") return [];
  const problems = [];
  try {
    encryptField("startup-key-check");
  } catch (err) {
    problems.push(`FIELD_ENCRYPTION_KEY: ${err.message}`);
  }
  try {
    getEncryptionKey();
  } catch (err) {
    problems.push(`FILE_ENCRYPTION_KEY: ${err.message}`);
  }
  return problems;
};
