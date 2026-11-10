// Audit FE (10/11/2026): F-01..F-12 và các mục LOW. Chạy: node src/tests/fe_audit_fixes.test.mjs
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenSharedRecord } from '../utils/shareCatalog.js';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');
let passed = 0;
let failed = 0;
const test = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ✔ ${name}`); } catch (e) { failed += 1; console.log(`  ✖ ${name}\n    ${e.message}`); }
};

test('F-01/F-02: PatientDetail có hàm quay lại; EMRModal nhận props kê đơn mà màn cha truyền', () => {
  assert.ok(/const handleBackNavigation = \(\) =>/.test(read('screens/PatientDetailScreen.js')));
  const emr = read('screens/EMRDashboardScreen.jsx');
  const sig = emr.match(/const EMRModal = \(\{([^}]*)\}\)/);
  assert.ok(sig && /onCreatePrescription/.test(sig[1]) && /availableDrugs/.test(sig[1]), 'EMRModal thiếu props kê đơn');
});

test('F-04: không còn nút/hàm giả lập điền dữ liệu lâm sàng bịa', () => {
  const emr = read('screens/EMRDashboardScreen.jsx');
  for (const s of ['Giả lập OCR', 'Simulated OCR', 'Lê Trần Gia Huy', "'PT-' + Math.floor", 'Đd. Lê Thị Hoa']) assert.ok(!emr.includes(s), s);
  const ktv = read('screens/CreateImagingResultScreen.js');
  for (const s of ['BN-26025699', '26025699', "'1995'", 'Đà Nẵng', 'U màng não thùy trán trái', 'Phát hiện khối u vùng thùy trán', 'Bs. Chẩn Đoán Hình Ảnh', 'Bác sĩ Gia Huy', 'Bác sĩ chỉ định', 'Theo dõi u não', 'Chụp MRI không thuốc']) assert.ok(!ktv.includes(s), s);
});

test('F-08/F-09: nút ký/phụ lục/thêm mới theo quyền; form bệnh án không mặc định Nam/BHYT; bỏ "(TT 46)"', () => {
  const emr = read('screens/EMRDashboardScreen.jsx');
  assert.ok(/canSign &&\s*<TouchableOpacity\s*style=\{styles\.signBtn\}/.test(emr), 'nút ký chưa theo quyền');
  assert.ok(/\{canAddendum && \(<TouchableOpacity/.test(emr), 'nút phụ lục chưa theo quyền');
  assert.ok(/\{canCreate && \(\s*<TouchableOpacity style=\{styles\.actionButton\} onPress=\{onNewRecord\}/.test(emr), 'nút thêm hồ sơ chưa theo quyền');
  assert.ok(!emr.includes('(TT 46)'));
  const form = emr.slice(emr.indexOf('const NewRecordForm'), emr.indexOf('const NewRecordForm') + 600);
  assert.ok(form.includes("gender: ''") && form.includes("paymentMethod: ''"), 'mặc định giới tính/thanh toán');
  assert.ok(emr.includes('fetchRecordDetails(record._id, record.patientId)'), 'tải chi tiết lần đầu phải truyền patientId');
});

test('F-04 (bổ sung): không tự điền kết quả xét nghiệm "bình thường", không sinh số giấy tờ/số phiếu ngẫu nhiên', () => {
  const pd = read('screens/PatientDetailScreen.js');
  for (const s of ['Tự động điền giá trị chuẩn', 'handleAutoFillNormalLab', '`GV-${Math.floor', '`BA-${Math.floor', '`CV-${Math.floor', 'Math.floor(1000 + Math.random() * 9000)}`;']) assert.ok(!pd.includes(s), s);
  assert.ok(!read('screens/NursePatientDetailScreen.js').includes('patientName.slice(0, 3).toUpperCase() + Math.floor'), 'số phiếu thu giả');
});

test('F-10: huyết áp dạng object hiển thị tâm thu/tâm trương, không ra [object Object]', () => {
  const items = flattenSharedRecord({ vitals: [{ recorded_at: '2026-11-01T08:00:00Z', blood_pressure: { systolic: 128, diastolic: 82 }, pulse: 76 }] });
  const text = JSON.stringify(items);
  assert.ok(!text.includes('[object Object]'), text.slice(0, 200));
  assert.ok(text.includes('huyết áp 128/82'), text.slice(0, 200));
});

test('F-05/F-07/F-11/F-12: menu, tab thu ngân, cách gọi AI', () => {
  const layout = read('components/ResponsiveLayout.js');
  const admin = layout.slice(layout.indexOf("case 'admin':"), layout.indexOf("case 'admin':") + 1500);
  assert.ok(!admin.includes("tab: 'transfers'") && !admin.includes("tab: 'beds'"), 'menu admin còn chuyển viện/giường');
  const lab = layout.slice(layout.indexOf("case 'lab_technician':"), layout.indexOf("case 'technician':"));
  assert.ok(!lab.includes('ScanRecordQr'), 'KTV xét nghiệm còn mục quét mã');
  assert.ok(!layout.includes('HỆ THỐNG CHẨN ĐOÁN'), 'logo còn "hệ thống chẩn đoán"');
  assert.ok(/t\.key !== 'billing' \|\| !user\?\.role \|\| can\(user\.role, 'invoicePay'\)/.test(read('screens/NurseReceptionScreen.js')), 'tab thu ngân chưa theo quyền');
  for (const rel of ['screens/RegisterScreen.js', 'screens/NursePatientDetailScreen.js', 'screens/WelcomeScreen.js', 'screens/ActivateAccountScreen.js',
    'components/InterHospitalTransferView.jsx', 'components/landing/LandingSections.js', 'screens/SystemAdminScreen.js']) {
    const t = read(rel);
    for (const s of ['chẩn đoán AI', 'AI chẩn đoán', 'HỆ THỐNG CHẨN ĐOÁN', 'AI hỗ trợ chẩn đoán', 'trợ lý chẩn đoán AI']) assert.ok(!t.includes(s), `${rel}: ${s}`);
  }
});

test('LOW: đăng xuất xóa bản nháp bệnh án; kho giấy tờ theo tài khoản; apiRequest dùng client chính; BHYT badge theo phạm vi', () => {
  const lo = read('utils/logout.js');
  assert.ok(lo.includes('await clearLocalClinicalData()') && lo.includes("'@neuroscan_medical_record_form'") && lo.includes("'emr_detail_'") && lo.includes("['user']"));
  assert.ok(/`\$\{VAULT_KEY\}_\$\{id\}`/.test(read('controllers/useDocumentVault.js')), 'kho giấy tờ chưa tách theo tài khoản');
  assert.ok(/return request\(path, options \|\| \{\}\);/.test(read('utils/apiClient.js')));
  assert.ok(/isFeatureEnabled\('bhyt'\) && \(v\.patientId\?\.profile\?\.hasBhyt/.test(read('screens/DoctorWorkQueueScreen.js')));
  assert.ok(!fs.existsSync(path.join(SRC, 'components/PatientsView.jsx')), 'code chết PatientsView');
});

console.log(`\nSUMMARY: ${passed}/${passed + failed} FE AUDIT FIX TESTS PASSED${failed ? ` (${failed} failed)` : ' (100%)'}`);
process.exit(failed ? 1 : 0);
