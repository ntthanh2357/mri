import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GENDER_OPTIONS,
  formatDobDigits,
  formatDobDisplay,
  formatDobSummary,
  parseDobInput,
  computeAgeFromDob,
  buildProfilePayload,
} from '../utils/profileFields.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FE_SRC = path.resolve(__dirname, '..');
const BE_SRC = path.resolve(__dirname, '../../../BE/src');

let passed = 0;
let failed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed++;
    console.log(`  ✔ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✘ ${name}: ${err?.stack || err?.message || err}`);
  }
};

test('formatDobDigits định dạng DD/MM/YYYY tự động khi nhập số', () => {
  assert.strictEqual(formatDobDigits('15081995'), '15/08/1995');
  assert.strictEqual(formatDobDigits('1508'), '15/08');
  assert.strictEqual(formatDobDigits('15/08/199599'), '15/08/1995');
});

test('parseDobInput kiểm tra lịch hợp lệ, năm nhuận, và từ chối ngày sai / tương lai', () => {
  const ok = parseDobInput('15/08/1995');
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.iso, '1995-08-15');
  assert.strictEqual(ok.display, '15/08/1995');
  assert.strictEqual(ok.birthYear, 1995);
  assert.ok(ok.age >= 25);

  assert.strictEqual(parseDobInput('29/02/2000').ok, true);
  assert.strictEqual(parseDobInput('29/02/2001').ok, false);
  assert.strictEqual(parseDobInput('31/04/1999').ok, false);
  assert.strictEqual(parseDobInput('01/01/2099').ok, false);
  assert.strictEqual(parseDobInput('15-08-1995').ok, false);
  assert.strictEqual(parseDobInput('').iso, null);
});

test('formatDobDisplay & formatDobSummary giữ đúng ngày theo UTC và hiển thị tuổi', () => {
  const iso = '1990-05-15T12:00:00.000Z';
  assert.strictEqual(formatDobDisplay(iso), '15/05/1990');
  const summary = formatDobSummary({ dob: iso });
  assert.match(summary, /^15\/05\/1990 \(\d+ tuổi\)$/);
  assert.match(formatDobSummary({ birthYear: 1988 }), /^Năm sinh 1988 \(\d+ tuổi\)$/);
  assert.strictEqual(formatDobSummary({}), 'Chưa cập nhật');
  assert.ok(computeAgeFromDob(iso) >= 30);
});

test('buildProfilePayload đóng gói đầy đủ giới tính, ngày sinh, SĐT, địa chỉ và chặn dữ liệu lỗi', () => {
  assert.deepStrictEqual(GENDER_OPTIONS, ['Nam', 'Nữ', 'Khác']);

  const emptyName = buildProfilePayload({ name: '   ', gender: 'Nam', dobText: '10/10/1990' });
  assert.strictEqual(emptyName.ok, false);

  const badGender = buildProfilePayload({ name: 'Nguyễn Văn A', gender: 'Invalid' });
  assert.strictEqual(badGender.ok, false);

  const badDob = buildProfilePayload({ name: 'Nguyễn Văn A', dobText: '31/02/1995' });
  assert.strictEqual(badDob.ok, false);

  const badPhone = buildProfilePayload({ name: 'Nguyễn Văn A', phone: '12345' });
  assert.strictEqual(badPhone.ok, false);

  const valid = buildProfilePayload({
    name: '  ĐD.CKI Lê Thị Hoa  ',
    gender: 'Nữ',
    dobText: '08/03/1989',
    phone: '0912345678',
    address: '  Hà Nội  ',
  });
  assert.strictEqual(valid.ok, true);
  assert.deepStrictEqual(valid.payload, {
    name: 'ĐD.CKI Lê Thị Hoa',
    gender: 'Nữ',
    dob: '1989-03-08',
    phone: '0912345678',
    address: 'Hà Nội',
  });
});

test('FE và BE hỗ trợ đầy đủ gender, dob, birthYear, age trong profile tài khoản', () => {
  const layout = fs.readFileSync(path.join(FE_SRC, 'components/ResponsiveLayout.js'), 'utf8');
  assert.match(layout, /<ProfileFormFields/);
  assert.match(layout, /label: 'Giới tính'/);
  assert.match(layout, /label: 'Ngày tháng năm sinh'/);

  const home = fs.readFileSync(path.join(FE_SRC, 'screens/HomeScreen.js'), 'utf8');
  assert.match(home, /<ProfileFormFields/);
  assert.match(home, /setEditGender/);
  assert.match(home, /setEditDob/);

  const userModel = fs.readFileSync(path.join(BE_SRC, 'modules/auth/models/user.model.js'), 'utf8');
  assert.match(userModel, /dob:\s*\{\s*type:\s*Date/);

  const authCtrl = fs.readFileSync(path.join(BE_SRC, 'modules/auth/auth.controller.js'), 'utf8');
  assert.match(authCtrl, /ALLOWED_GENDERS/);
  assert.match(authCtrl, /parseProfileDob/);
  assert.match(authCtrl, /user\.profile\.dob = parsedDob/);
  assert.match(authCtrl, /user\.profile\.phoneLast4/);
});

console.log(`\nSUMMARY: ${passed}/${passed + failed} PROFILE FIELD TESTS ${failed ? 'FAILED' : 'PASSED'}`);
if (failed) process.exit(1);

