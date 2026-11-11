import crypto from "crypto";
import { getJwtSecret } from "../config/jwt.config.js";

/**
 * Mã OTP tài khoản (kích hoạt, quên mật khẩu, đăng nhập SĐT, 2FA) lưu dạng HMAC-SHA256, không lưu mã gốc.
 * Trước đây lưu chữ thường và GET /admin/users trả ra mã đang hiệu lực của mọi tài khoản → chiếm tài khoản.
 * HMAC có khóa máy chủ: lộ DB cũng không dò ngược được 1 triệu mã 6 số. Gắn userId + mục đích để mã của
 * luồng này không dùng được cho luồng khác.
 */
const otpSecret = () => process.env.OTP_HASH_SECRET || getJwtSecret();

export const hashAccountOtp = (userId, otp, purpose = "account") =>
  crypto.createHmac("sha256", otpSecret()).update(`${purpose}|${String(userId)}|${String(otp ?? "")}`).digest("hex");

/** so khớp an toàn thời gian; stored rỗng → false */
export const accountOtpMatches = (stored, userId, otp, purpose = "account") => {
  if (!stored || otp === undefined || otp === null || String(otp) === "") return false;
  const expected = Buffer.from(hashAccountOtp(userId, otp, purpose), "hex");
  const actual = Buffer.from(String(stored), "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

/** trường OTP ẩn (select: false) — các luồng so mã phải lấy kèm */
export const OTP_SECRET_FIELDS = "+otpCode +otp2FACode";
