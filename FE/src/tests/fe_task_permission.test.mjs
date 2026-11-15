// Nút đổi trạng thái bước công việc chỉ hiện cho người BE cho phép.
// Đối chiếu FE/src/utils/taskPermission.js với BE/src/utils/taskPermission.util.js trên toàn bộ tổ hợp,
// và kiểm tra màn TaskBoard / danh sách bệnh nhân dùng đúng quyền. Chạy: node src/tests/fe_task_permission.test.mjs
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canUpdateTask as feCan } from '../utils/taskPermission.js';
import { can } from '../constants/clinicalPermissions.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const be = await import(pathToFileURL(path.join(ROOT, 'BE', 'src', 'utils', 'taskPermission.util.js')).href);
let passed = 0;
let failed = 0;
const test = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ✔ ${name}`); } catch (e) { failed += 1; console.log(`  ✖ ${name}\n    ${e.message}`); }
};

const ROLES = ['admin', 'system_admin', 'hospital_admin', 'department_head', 'doctor', 'radiologist', 'nurse', 'technician', 'lab_technician', 'pharmacist', 'receptionist', 'patient'];
const STEP_ROLES = ['doctor', 'technician', 'receptionist', 'nurse', 'auto', 'radiologist'];
const ME = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const ASSIGN = [undefined, null, ME, OTHER, { _id: ME, profile: { name: 'Tôi' } }, { _id: OTHER, profile: { name: 'Người khác' } }];

test('FE và BE cho cùng kết quả trên mọi vai trò × loại bước × người được giao', () => {
  let n = 0;
  for (const role of ROLES) for (const roleRequired of STEP_ROLES) for (const assignedToUserId of ASSIGN) {
    for (const user of [{ role, id: ME }, { role, _id: ME }]) {
      const task = { roleRequired, assignedToUserId, title: 'Bước' };
      assert.strictEqual(feCan(task, user), be.canUpdateTask(task, user), JSON.stringify({ role, roleRequired, assignedToUserId, user }));
      n += 1;
    }
  }
  assert.ok(n > 800);
});

test('bước giao cho bác sĩ khác: bác sĩ không có nút (lỗi crawler: bấm "Bắt đầu" bị 403)', () => {
  const task = { roleRequired: 'doctor', assignedToUserId: { _id: OTHER } };
  assert.strictEqual(feCan(task, { role: 'doctor', _id: ME }), false);
  assert.strictEqual(feCan({ roleRequired: 'doctor', assignedToUserId: { _id: ME } }, { role: 'doctor', _id: ME }), true);
  assert.strictEqual(feCan({ roleRequired: 'auto' }, { role: 'doctor', _id: ME }), false);
  assert.strictEqual(be.taskUpdateDenial(task, { role: 'doctor', id: ME }), 'assigned_other');
  assert.match(be.taskDenialMessage({ title: 'Đọc phim' }, 'assigned_other'), /giao cho người khác/);
  assert.doesNotMatch(be.taskDenialMessage({ title: 'X', roleRequired: 'doctor' }, 'role'), /vai trò doctor/);
});

test('TaskBoard chỉ hiện nút khi canUpdateTask; danh sách bệnh nhân chặn nút phim theo quyền', () => {
  const tb = fs.readFileSync(path.join(HERE, '..', 'screens', 'TaskBoardScreen.js'), 'utf8');
  assert.match(tb, /canUpdateTask\(task, me\) \?/);
  const btn = tb.indexOf('label="Bắt đầu"');
  assert.ok(btn > tb.indexOf('canUpdateTask(task, me) ?'), 'nút Bắt đầu phải nằm trong nhánh được phép');
  const pl = fs.readFileSync(path.join(HERE, '..', 'screens', 'DoctorPatientListScreen.js'), 'utf8');
  assert.strictEqual((pl.match(/\{canReadFilms \? \(/g) || []).length, 2);
  assert.strictEqual((pl.match(/\{canCreateFilm \? \(/g) || []).length, 2);
  assert.match(pl, /can\(user\?\.role, 'imagingStaffRead'\)/);
  assert.match(pl, /can\(user\?\.role, 'imagingCreate'\)/);
});

test('bảng hàng chờ: nút xếp lịch MRI cấp cứu chỉ hiện cho vai trò BE cho phép (điều dưỡng bị 403)', () => {
  assert.strictEqual(can('nurse', 'mriEmergencySchedule'), false);
  assert.strictEqual(can('receptionist', 'mriEmergencySchedule'), true);
  const qb = fs.readFileSync(path.join(HERE, '..', 'components', 'reception', 'ReceptionQueueBoard.js'), 'utf8');
  assert.match(qb, /const canScheduleMri = can\(role, 'mriEmergencySchedule'\);/);
  assert.ok(qb.indexOf("'Xếp lịch chụp MRI'") > qb.indexOf('{canScheduleMri && !needsMriOrder(v) ? ('), 'nút phải nằm trong nhánh được phép');
  assert.ok(qb.includes('!v.mriOrder?.orderedAt'),'lễ tân chỉ xếp lịch ca đã có chỉ định MRI (BE trả 403)');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
