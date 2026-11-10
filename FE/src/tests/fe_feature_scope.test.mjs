// Phạm vi đồ án (góp ý hội đồng): BHYT, giường bệnh, phân hệ Dược ẩn trên giao diện; bật lại bằng EXPO_PUBLIC_ENABLE_OUT_OF_SCOPE=true.
// Chạy: node src/tests/fe_feature_scope.test.mjs (tự chạy lại chính nó ở chế độ bật trong tiến trình con)
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ON = String(process.env.EXPO_PUBLIC_ENABLE_OUT_OF_SCOPE || '').toLowerCase() === 'true';
const { isFeatureEnabled, isRouteInScope, filterMenuInScope } = await import('../constants/featureScope.js');
const { getFaqsForRole } = await import('../constants/supportFaqs.js');
const { buildStaffTasks } = await import('../utils/staffTasks.js');

let passed = 0;
let failed = 0;
const test = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ✔ [${ON ? 'bật' : 'tắt'}] ${name}`); } catch (e) { failed += 1; console.log(`  ✖ [${ON ? 'bật' : 'tắt'}] ${name}\n    ${e.message}`); }
};
const faqText = (role) => getFaqsForRole(role).flatMap((g) => [g.category, ...g.items.map((i) => i.q)]).join(' | ');
const menu = [
  { label: 'Tổng quan', route: 'Home' },
  { label: 'Hàng đợi Khoa Dược', route: 'PharmacyQueue' },
  { label: 'Hậu kiểm dược', route: 'PharmacyOversight' },
  { label: 'Danh mục thuốc', route: 'DrugManagement', params: { tab: 'list' } },
  { label: 'Bệnh án điện tử', route: 'EMRDashboard', params: { tab: 'records' } },
  { label: 'Sơ đồ giường bệnh', route: 'EMRDashboard', params: { tab: 'beds' } },
  { label: 'Thu ngân', route: 'NurseReception', params: { tab: 'billing' } },
];

if (!ON) {
  test('mặc định cả 3 phần ngoài phạm vi đều tắt', () => {
    assert.deepStrictEqual(['bhyt', 'beds', 'pharmacy'].map(isFeatureEnabled), [false, false, false]);
  });
  test('menu bỏ màn hình Dược và tab giường, giữ các mục còn lại', () => {
    assert.deepStrictEqual(filterMenuInScope(menu).map((m) => m.label), ['Tổng quan', 'Bệnh án điện tử', 'Thu ngân']);
    assert.strictEqual(isRouteInScope('EMRDashboard', { tab: 'transfers' }), true);
    assert.strictEqual(isRouteInScope('DoctorWorkQueue', { tab: 'mriQueue' }), true);
  });
  test('FAQ không còn câu hỏi BHYT, giường, kho thuốc; nhóm được đổi tên', () => {
    assert.ok(!/BHYT|giường/i.test(faqText('receptionist')), faqText('receptionist'));
    assert.ok(!/giường/i.test(faqText('nurse')));
    assert.ok(!/kho thuốc|hết hạn/i.test(faqText('hospital_admin')));
    assert.ok(getFaqsForRole('receptionist').some((g) => g.category === 'Thu ngân'));
    assert.ok(getFaqsForRole('receptionist').every((g) => g.items.length > 0));
  });
  test('dược sĩ không còn việc cần làm của Khoa Dược', () => {
    assert.deepStrictEqual(buildStaffTasks('pharmacist', { prescriptions: [{ dispenseStatus: 'READY' }] }), []);
  });
  test('vai trò trong phạm vi vẫn có việc cần làm', () => {
    assert.ok(buildStaffTasks('receptionist', { visits: [{ status: 'đang chờ' }] }).length > 0);
  });
} else {
  test('bật lại: đủ menu Dược và tab giường', () => {
    assert.strictEqual(filterMenuInScope(menu).length, menu.length);
  });
  test('bật lại: FAQ BHYT và giường hiện trở lại', () => {
    assert.ok(/BHYT/.test(faqText('receptionist')));
    assert.ok(/giường/i.test(faqText('nurse')));
  });
  test('bật lại: dược sĩ có việc cần làm từ hàng đợi Dược', () => {
    assert.ok(buildStaffTasks('pharmacist', { prescriptions: [{ dispenseStatus: 'READY' }] }).length > 0);
  });
}

if (!ON) {
  const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, EXPO_PUBLIC_ENABLE_OUT_OF_SCOPE: 'true' }, encoding: 'utf8' });
  process.stdout.write(child.stdout || '');
  process.stderr.write(child.stderr || '');
  const m = /SUMMARY_ON (\d+) (\d+)/.exec(child.stdout || '');
  if (!m) { failed += 1; console.log('  ✖ không chạy được chế độ bật lại'); } else { passed += Number(m[1]); failed += Number(m[2]); }
  console.log(`\nSUMMARY: ${passed}/${passed + failed} FEATURE SCOPE TESTS PASSED${failed ? ` (${failed} failed)` : ' (100%)'}`);
  process.exit(failed ? 1 : 0);
} else {
  console.log(`SUMMARY_ON ${passed} ${failed}`);
  process.exit(0);
}
