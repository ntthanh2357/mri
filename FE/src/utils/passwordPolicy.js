/**
 * Bản sao quy tắc BE/src/utils/passwordPolicy.util.js: 8–128 ký tự, có cả chữ và số.
 * Test src/tests/fe_password_policy.test.mjs đối chiếu hai bản.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_RULE_MESSAGE = `Mật khẩu phải có ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} ký tự, gồm cả chữ và số.`;

export const passwordPolicyError = (password) => {
  if (typeof password !== 'string') return PASSWORD_RULE_MESSAGE;
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) return PASSWORD_RULE_MESSAGE;
  if (!/\p{L}/u.test(password) || !/\p{Nd}/u.test(password)) return PASSWORD_RULE_MESSAGE;
  return null;
};
