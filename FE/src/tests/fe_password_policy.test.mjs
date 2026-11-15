// Quy tắc mật khẩu FE trùng BE (≥ 8 ký tự, có chữ và số) và các form đặt mật khẩu dùng chung quy tắc.
// Chạy: node src/tests/fe_password_policy.test.mjs
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { passwordPolicyError as feRule } from '../utils/passwordPolicy.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..');
const ROOT = path.resolve(SRC, '..', '..');
const be = await import(pathToFileURL(path.join(ROOT, 'BE', 'src', 'utils', 'passwordPolicy.util.js')).href);
let passed = 0;
let failed = 0;
const test = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ✔ ${name}`); } catch (e) { failed += 1; console.log(`  ✖ ${name}\n    ${e.message}`); }
};

const CASES = ['', 'abc123', 'abcdefgh', '12345678', 'abcd1234', 'Mậtkhẩu1', 'Benhnhan2026', ' a1      ', 'x'.repeat(127) + '1', 'x'.repeat(128) + '1', '١٢٣٤٥٦٧a', null, undefined, 12345678, {}];

test('FE và BE cho cùng kết quả trên mọi trường hợp', () => {
  for (const c of CASES) assert.strictEqual(feRule(c), be.passwordPolicyError(c), JSON.stringify(c));
});

test('mật khẩu yếu bị từ chối, mật khẩu đủ mạnh qua', () => {
  for (const bad of ['abc123', 'abcdefgh', '12345678', '']) assert.ok(feRule(bad), bad);
  for (const ok of ['abcd1234', 'Mậtkhẩu1', 'Benhnhan2026']) assert.strictEqual(feRule(ok), null, ok);
});

test('các form đặt mật khẩu dùng chung quy tắc (không còn "ít nhất 6 ký tự")', () => {
  const files = ['screens/RegisterScreen.js', 'components/ForgotPasswordModal.js', 'screens/ActivateAccountScreen.js', 'screens/LoginScreen.js', 'components/AdminUsersView.jsx'];
  for (const f of files) {
    const src = fs.readFileSync(path.join(SRC, f), 'utf8');
    assert.match(src, /passwordPolicyError\(/, f);
    assert.doesNotMatch(src, /length < 6/, f);
  }
});

console.log(`\nSUMMARY: ${passed}/${passed + failed} PASSWORD POLICY TESTS ${failed ? 'FAILED' : 'PASSED'}`);
if (failed) process.exit(1);
