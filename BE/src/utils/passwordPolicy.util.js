/**
 * Quy tắc mật khẩu do người dùng tự đặt (đăng ký, đổi, đặt lại, quản trị tạo tài khoản):
 * 8–128 ký tự, có ít nhất 1 chữ cái và 1 chữ số. Trước đây BE không kiểm tra (FE chỉ ≥ 6 ở màn đăng ký).
 * Mật khẩu tạm do hệ thống sinh ngẫu nhiên không đi qua đây.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_RULE_MESSAGE = `Mật khẩu phải có ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} ký tự, gồm cả chữ và số.`;

/** null nếu hợp lệ; ngược lại là thông báo lỗi */
export const passwordPolicyError = (password) => {
  if (typeof password !== "string") return PASSWORD_RULE_MESSAGE;
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) return PASSWORD_RULE_MESSAGE;
  if (!/\p{L}/u.test(password) || !/\p{Nd}/u.test(password)) return PASSWORD_RULE_MESSAGE;
  return null;
};
