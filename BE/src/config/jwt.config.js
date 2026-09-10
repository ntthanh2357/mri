import crypto from "crypto";

/**
 * NeuroScan AI - Secure JWT & Cryptography Configuration
 * Áp dụng nguyên lý Fail-Fast: Ở môi trường Production, nếu thiếu biến JWT_SECRET
 * hoặc JWT_REFRESH_SECRET sẽ ném ngoại lệ dừng hệ thống ngay lập tức thay vì âm thầm dùng fallback.
 */

export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL BẢO MẬT: Biến môi trường JWT_SECRET chưa được cấu hình cho môi trường Production!");
    }
    return "neuroscan_dev_fallback_secret_key_not_for_prod_2026";
  }
  return secret;
};

export const getRefreshSecret = () => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL BẢO MẬT: Biến môi trường JWT_REFRESH_SECRET chưa được cấu hình cho môi trường Production!");
    }
    return "neuroscan_dev_fallback_refresh_key_not_for_prod_2026";
  }
  return secret;
};

/**
 * Sinh mã OTP 6 chữ số mật mã học an toàn (CSPRNG - Cryptographically Secure Pseudo-Random Number Generator)
 * Sử dụng crypto.randomInt thay thế hoàn toàn cho Math.random() vốn dễ bị dự đoán chuỗi hạt giống.
 */
export const generateSecureOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};
