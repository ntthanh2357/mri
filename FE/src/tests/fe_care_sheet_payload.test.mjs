// Vòng crawler bấm nút: không bịa số đo/đánh giá lâm sàng, không gửi tên người dùng ra dịch vụ ngoài, nút chỉ hiện khi BE cho phép.
// Chạy: node src/tests/fe_care_sheet_payload.test.mjs
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { normalizeCareAssessment as feNorm, buildCareAssessment } from '../utils/careSheetPayload.js';
import { localAvatarUri } from '../utils/localAvatar.js';
import { can } from '../constants/clinicalPermissions.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..');
const ROOT = path.resolve(SRC, '..', '..');
const be = await import(pathToFileURL(path.join(ROOT, 'BE', 'src', 'utils', 'careSheetAssessment.util.js')).href);
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');
let passed = 0;
let failed = 0;
const test = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ✔ ${name}`); } catch (e) { failed += 1; console.log(`  ✖ ${name}\n    ${e.message}`); }
};

test('quy tắc phiếu chăm sóc FE trùng BE trên nhiều tổ hợp (GCS, đồng tử, dẫn lưu, truyền dịch, cấp chăm sóc)', () => {
  const V = ['', undefined, '0', '1', '3', '4', '5', '6', '7', 'x', '2.5'];
  let n = 0;
  for (const eye of V) for (const verbal of ['', '5', '2', '9']) for (const motor of ['', '6', '1']) {
    for (const pupils of [undefined, {}, { leftSize: '3' }, { leftSize: '3', rightSize: '4', leftLightReflex: '+' }, { shape: 'Méo' }, { leftSize: '3', rightSize: '3', leftLightReflex: 'sai' }]) {
      for (const careLevel of ['', '1', '3', '4']) {
        const input = { careLevel, glasgow: { eye, verbal, motor }, pupils, surgicalDrainage: n % 3 === 0 ? { site: 'EVD', volume: n % 2 ? '' : '20' } : undefined, fluidInfusions: n % 5 === 0 ? [{ fluidName: 'NaCl 0.9%', volume: n % 2 ? '' : '500' }, { fluidName: '' }] : undefined };
        assert.deepStrictEqual(feNorm(input), be.normalizeCareAssessment(input), JSON.stringify(input));
        n += 1;
      }
    }
  }
  assert.ok(n > 3000, String(n));
});

test('không tự điền mức "bình thường": GCS thiếu thành phần, đồng tử một bên, dẫn lưu không thể tích bị từ chối', () => {
  assert.match(buildCareAssessment({ careLevel: '2', gcsEye: '1' }).error, /Glasgow/);
  assert.match(buildCareAssessment({ careLevel: '2', pupilLeftSize: '3' }).error, /đồng tử/);
  assert.match(buildCareAssessment({ careLevel: '2', drainageSite: 'EVD' }).error, /dẫn lưu/);
  assert.match(buildCareAssessment({ careLevel: '2', fluidInfusions: [{ fluidName: 'Mannitol 20%', volume: '' }] }).error, /Mannitol/);
  assert.match(buildCareAssessment({ careLevel: '' }).error, /cấp chăm sóc/);
  const ok = buildCareAssessment({ careLevel: '1', pupilLeftReflex: '+', pupilRightReflex: '+' });
  assert.strictEqual(ok.error, undefined);
  assert.strictEqual(ok.value.glasgow, undefined, 'không đánh giá GCS thì không gửi GCS');
  assert.strictEqual(ok.value.pupils, undefined, 'chỉ có phản xạ mặc định "+" thì không gửi đồng tử');
  const full = buildCareAssessment({ careLevel: '1', gcsEye: '1', gcsVerbal: '2', gcsMotor: '3' }).value.glasgow;
  assert.deepStrictEqual([full.totalScore, full.classification], [6, 'Hôn mê sâu / Nguy kịch (Cảnh báo)']);
});

test('form phiếu chăm sóc/khám bệnh không còn giá trị bịa (GCS 4/5/6, đồng tử 2.5, nhịp thở 18, đơn giá, dịch vụ chọn sẵn)', () => {
  const nurse = read('screens/NursePatientDetailScreen.js');
  const emr = read('screens/EMRDashboardScreen.jsx');
  for (const [name, src] of [['NursePatientDetail', nurse], ['EMRDashboard', emr]]) {
    assert.doesNotMatch(src, /\|\|\s*4,\s*\n?\s*verbal|parseInt\(gcsEye\)\s*\|\|\s*4|csGcsEyeNum \|\| 4/, `${name}: GCS mặc định`);
    assert.doesNotMatch(src, /\|\|\s*2\.5/, `${name}: đồng tử 2.5`);
    assert.match(src, /buildCareAssessment\(/, `${name}: dùng quy tắc chung`);
  }
  assert.doesNotMatch(nurse, /examBreath \? parseInt\(examBreath\) : 18/);
  assert.match(nurse, /!examSpo2 \|\| !examBreath/);
  assert.doesNotMatch(nurse, /1500000|250000 : 150000/);
  assert.doesNotMatch(nurse, /useState\(\["Chụp MRI sọ não"\]\)|setOrderServices\(\["Chụp MRI/);
  assert.doesNotMatch(nurse, /"Bác sĩ điều trị"|"Điều dưỡng y tá"|"Điều dưỡng trực"|Khám và đánh giá u não chuyên sâu|Khám sức khỏe tổng quát/);
  assert.match(nurse, /<PatientSafetyStrip patientId=\{safetyPatientId\} role=\{localUser\?\.role\} \/>/);
  const detail = read('screens/PatientDetailScreen.js');
  assert.doesNotMatch(detail, /systolic \|\| 120|diastolic \|\| 80|v\.pulse \|\| 70/, 'biểu đồ không vẽ số đo giả');
});

test('ảnh đại diện tạo trên máy, không gửi tên/email ra ui-avatars.com', () => {
  for (const f of ['components/AdminUsersView.jsx', 'components/AdminUsersView.native.jsx']) assert.doesNotMatch(read(f), /ui-avatars\.com/, f);
  const uri = localAvatarUri('Bệnh nhân Tuấn Thành (U Màng Não)');
  assert.match(uri, /^data:image\/svg\+xml/);
  assert.match(decodeURIComponent(uri), />TT</);
  assert.doesNotMatch(decodeURIComponent(localAvatarUri('<script>')), /<script>/);
});

test('nút chỉ hiện khi BE cho phép: khóa tài khoản quản trị, lịch trực của vệ sinh, sàng lọc của lễ tân', () => {
  const users = read('components/AdminUsersView.jsx');
  assert.match(users, /const canModerate = \(targetRole\) => !\['admin', 'system_admin'\]\.includes\(targetRole\);/);
  assert.match(users, /\{!canModerate\(user\.role\) \? null : user\.status === 'Active'/);
  assert.match(read('components/staff/StaffHome.js'), /\{role !== 'cleaner' \? \(/);
  assert.strictEqual(can('receptionist', 'preScreeningRead'), false);
  assert.strictEqual(can('nurse', 'preScreeningRead'), true);
  assert.match(read('components/staff/PatientSafetyStrip.js'), /\{showPreScreening \? <PreScreeningStrip/);
  // Chi tiết bệnh nhân: KTV xét nghiệm không tải/không thấy tab phim, giấy ra viện, chuyển tuyến (trước đây 403)
  const pd = read('screens/PatientDetailScreen.js');
  for (const k of ['imaging', 'discharge', 'transfer']) assert.match(pd, new RegExp(`if \\(canTab\\(myRole, '${k}'\\)\\) try \\{`), k);
  assert.match(pd, /\]\.filter\(\(t\) => !currentUser\?\.role \|\| canTab\(currentUser\.role, t\.key\)\)\}/);
  assert.strictEqual(can('lab_technician', 'dischargeRead') || can('lab_technician', 'transferFormRead') || can('lab_technician', 'imagingStaffRead'), false);
});

test('thông tin hỗ trợ: không còn hotline mẫu 1800 1234, không còn kênh "Chat trực tiếp" chưa có', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'tests' ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]));
  for (const f of walk(SRC).filter((x) => /\.(js|jsx)$/.test(x))) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /1800 1234/, f);
  assert.doesNotMatch(read('screens/SupportScreen.js'), /Chat trực tiếp/);
  // Giờ hỗ trợ một nguồn (constants/supportContact.js), không hứa trực 24/7
  for (const f of walk(SRC).filter((x) => /\.(js|jsx)$/.test(x) && !x.endsWith('supportContact.js'))) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /24\/7/, f);
  for (const f of ['screens/SupportScreen.js', 'screens/LandingScreen.js', 'components/landing/LandingSections.js']) assert.match(read(f), /constants\/supportContact/, f);
  // Menu quản trị nền tảng không còn Báo cáo tài chính (số liệu từng viện)
  const layout = read('components/ResponsiveLayout.js');
  const adminMenu = layout.slice(layout.indexOf("case 'admin':"), layout.indexOf('];', layout.indexOf("case 'admin':")));
  assert.doesNotMatch(adminMenu, /route: 'Financials'/);
});

test('điều dưỡng: menu gọn, không phân công bác sĩ/điều dưỡng, có nút điều chỉnh sàng lọc trong bệnh án', () => {
  const layout = read('components/ResponsiveLayout.js');
  const nurseMenu = layout.slice(layout.indexOf("case 'nurse':"), layout.indexOf('];', layout.indexOf("case 'nurse':")));
  for (const excluded of ['NurseReception', 'DoctorWorkQueue', 'TaskBoard', 'EmergencyHistory', 'ScanRecordQr']) {
    assert.doesNotMatch(nurseMenu, new RegExp(`route: '${excluded}'`), excluded);
  }
  assert.match(nurseMenu, /label: 'Gọi đo sinh hiệu', route: 'NurseTriage'/);
  assert.match(nurseMenu, /label: 'Nhập sinh hiệu', route: 'EMRDashboard', params: \{ tab: 'nurseQueue' \}/);

  const reception = read('screens/NurseReceptionScreen.js');
  assert.match(reception, /isNurseRole = user\?\.role === 'nurse'/);
  assert.match(reception, /\.filter\(\(t\) => !isNurseRole \|\| t\.key === 'myQueue'\)/);
  assert.match(reception, /\{activeTab === 'createVisit' && !isNurseRole && \(/);
  assert.match(reception, /\{!isNurseRole && \([\s\S]*Phân công bác sĩ[\s\S]*Phân công điều dưỡng/);

  const safetyStrip = read('components/staff/PatientSafetyStrip.js');
  assert.match(safetyStrip, /const canEdit = role === 'nurse'/);
  assert.match(safetyStrip, /Điều chỉnh sàng lọc/);
  assert.match(safetyStrip, /Sàng lọc ngay/);
  assert.match(safetyStrip, /<PreScreeningModal/);
});

console.log(`\nSUMMARY: ${passed}/${passed + failed} CARE SHEET & CLICK-AUDIT TESTS ${failed ? 'FAILED' : 'PASSED'}`);
if (failed) process.exit(1);
