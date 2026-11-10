// Hợp đồng FE ↔ BE: danh sách vai trò ở constants/clinicalPermissions.js phải khớp checkRole của route BE
// (bỏ admin/system_admin vì module lâm sàng chặn tài khoản nền tảng). Chạy: node src/tests/fe_clinical_permissions.test.mjs
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PERMS, can } from '../constants/clinicalPermissions.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const be = (rel) => fs.readFileSync(path.join(ROOT, 'BE', 'src', rel), 'utf8');
const PLATFORM = new Set(['admin', 'system_admin']);
let passed = 0;
let failed = 0;
const test = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ✔ ${name}`); } catch (e) { failed += 1; console.log(`  ✖ ${name}\n    ${e.message}`); }
};

// Lấy mảng vai trò: literal ["a","b"] hoặc tên hằng (const X = [...]) kể cả [...Y, "z"]
const resolveRoles = (src, expr) => {
  expr = expr.trim();
  if (expr.startsWith('[')) {
    const out = new Set();
    for (const m of expr.matchAll(/\.\.\.([A-Z_]+)/g)) resolveRoles(src, m[1]).forEach((r) => out.add(r));
    for (const m of expr.matchAll(/["']([a-z_]+)["']/g)) out.add(m[1]);
    return out;
  }
  const m = src.match(new RegExp(`const ${expr} = (\\[[\\s\\S]*?\\]);`));
  if (!m) throw new Error(`không tìm thấy hằng ${expr}`);
  return resolveRoles(src, m[1]);
};
// Vai trò của route có handler `handler` (dòng định nghĩa route chứa "handler)")
const rolesOf = (rel, handler) => {
  const src = be(rel);
  const line = src.split('\n').find((l) => new RegExp(`\\b${handler}\\)`).test(l) && /(checkRole|checkSelfOrRoles)\(/.test(l));
  if (!line) throw new Error(`${rel}: không thấy route của ${handler}`);
  const arg = line.match(/(?:checkRole|checkSelfOrRoles)\((\[[^\]]*\]|[A-Z_]+)\)/);
  if (!arg) throw new Error(`${rel}: không đọc được vai trò của ${handler}`);
  return new Set([...resolveRoles(src, arg[1])].filter((r) => !PLATFORM.has(r)));
};
const same = (perm, beRoles) => assert.deepStrictEqual([...new Set(PERMS[perm])].sort(), [...beRoles].sort(), perm);

test('bệnh án: đọc, tạo, ký, phụ lục khớp emr.routes.js', () => {
  const src = be('modules/emr/emr.routes.js');
  same('emrRead', new Set([...resolveRoles(src, 'EMR_READ_ROLES')].filter((r) => !PLATFORM.has(r))));
  same('emrCreate', rolesOf('modules/emr/emr.routes.js', 'createRecord'));
  same('emrSign', rolesOf('modules/emr/emr.routes.js', 'signMedicalRecord'));
  same('emrAddendum', rolesOf('modules/emr/emr.routes.js', 'createRecordAddendum'));
});

test('phiếu chăm sóc, hội chẩn, cam đoan, lịch sử sửa đổi khớp emr.routes.js', () => {
  same('careRead', rolesOf('modules/emr/emr.routes.js', 'getCareSheets'));
  same('careCreate', rolesOf('modules/emr/emr.routes.js', 'createCareSheet'));
  same('consultRead', rolesOf('modules/emr/emr.routes.js', 'getConsultations'));
  same('consentRead', rolesOf('modules/emr/emr.routes.js', 'getConsents'));
  same('versionsRead', rolesOf('modules/emr/emr.routes.js', 'getRecordVersions'));
});

test('chuyển viện, kê đơn, phim, quét mã, thu tiền khớp route BE', () => {
  same('transfersRead', rolesOf('routes/transfer.routes.js', 'getTransfers'));
  same('transferCancel', rolesOf('routes/transfer.routes.js', 'deleteTransfer'));
  same('transferSendEmail', rolesOf('routes/transfer.routes.js', 'sendTransferEmail'));
  same('prescriptionCreate', rolesOf('routes/patient.routes.js', 'addPatientPrescription'));
  same('imagingStaffRead', new Set(resolveRoles(be('modules/imaging/imaging.routes.js'), 'IMAGING_STAFF_READ_ROLES')));
  same('shareRedeemStaff', rolesOf('routes/sharedRecord.routes.js', 'ctrl.redeemAsStaff'.split('.')[1]));
  same('invoicePay', rolesOf('modules/billing/invoice.routes.js', 'payInvoice'));
});

test('danh sách vai trò của controller chuyển viện khớp route (không chặn nhầm trưởng khoa/CĐHA)', () => {
  const src = be('controllers/transfer.controller.js');
  const fn = src.slice(src.indexOf('export const getTransfers'), src.indexOf('export const getTransferById'));
  const arr = fn.match(/if \(!(\[[^\]]*\])\.includes\(req\.user\?\.role\)\)/);
  assert.ok(arr, 'không thấy danh sách vai trò trong getTransfers');
  assert.deepStrictEqual([...resolveRoles(src, arr[1])].sort(), [...PERMS.transfersRead].sort());
});

test('tài khoản nền tảng không có quyền lâm sàng nào; can() an toàn với vai trò rỗng', () => {
  for (const perm of Object.keys(PERMS)) {
    assert.strictEqual(can('admin', perm), false, perm);
    assert.strictEqual(can('system_admin', perm), false, perm);
  }
  assert.strictEqual(can(undefined, 'emrRead'), false);
  assert.strictEqual(can('doctor', 'khong-ton-tai'), false);
});

test('module lâm sàng BE có chốt chặn tài khoản nền tảng', () => {
  for (const rel of ['routes/patient.routes.js', 'routes/visit.routes.js', 'routes/transfer.routes.js', 'routes/contrastConsent.routes.js',
    'routes/peerReview.routes.js', 'routes/assignment.routes.js', 'modules/imaging/imaging.routes.js', 'modules/pharmacy/drug.routes.js']) {
    assert.ok(be(rel).includes('denyPlatformAdmin'), rel);
  }
  assert.ok(!/userRole === "admin" \|\| userRole === "system_admin"\) \{\s*return patient;/.test(be('utils/tenancy.util.js')), 'checkPatientTenancy còn cho admin xem bệnh nhân');
});

console.log(`\nSUMMARY: ${passed}/${passed + failed} CLINICAL PERMISSION TESTS PASSED${failed ? ` (${failed} failed)` : ' (100%)'}`);
process.exit(failed ? 1 : 0);
