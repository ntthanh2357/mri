// IT1-05: giấy tờ y tế không được điền dữ liệu giả. Chạy: node src/tests/fe_paper_fields.test.mjs
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAPER_BLANK, SHORT_BLANK, orBlank, orDash, dayMonthYear, dateTimeOrBlank, dateOr } from '../utils/paperFields.js';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;
const test = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ✔ ${name}`); } catch (e) { failed += 1; console.log(`  ✖ ${name}\n    ${e.message}`); }
};

test('thiếu dữ liệu → dòng chấm để điền tay; có dữ liệu → giữ nguyên', () => {
  for (const v of [undefined, null, '', '   ', 'N/A']) assert.strictEqual(orBlank(v), PAPER_BLANK);
  assert.strictEqual(orBlank(undefined, SHORT_BLANK), SHORT_BLANK);
  assert.strictEqual(orBlank('Nữ'), 'Nữ');
  assert.strictEqual(orBlank(0), 0);
  assert.strictEqual(orDash(null), '—');
});

test('ngày tháng không tự lấy "hôm nay" khi thiếu dữ liệu', () => {
  assert.ok(!/\d/.test(dayMonthYear(null)), dayMonthYear(null));
  assert.ok(!/\d/.test(dateTimeOrBlank(undefined)), dateTimeOrBlank(undefined));
  assert.ok(!/\d/.test(dayMonthYear('không phải ngày')));
  assert.strictEqual(dayMonthYear('2026-03-12T10:00:00+07:00'), '12 tháng 3 năm 2026');
  assert.strictEqual(dateOr(null, 'chưa ghi ngày'), 'chưa ghi ngày');
});

// Mẫu giấy & màn hình thông tin có in hồ sơ người bệnh: chặn các giá trị giả từng xuất hiện (IT1-05)
const PAPERS = [
  'components/patientDetail/DischargeTransferTab.jsx',
  'components/patientDetail/PrescriptionTab.jsx',
  'components/patientDetail/LabOrdersTab.jsx',
  'screens/EMRDashboardScreen.jsx',
  'screens/ImagingResultScreen.js',
  'screens/NursePatientDetailScreen.js',
];
const BANNED = [
  [/GD4797921800244/, 'số thẻ BHYT cứng'],
  [/Liên Chiểu/, 'địa chỉ mặc định'],
  [/>\s*Kinh\s*</, 'dân tộc cứng'],
  [/>\s*Kỹ sư\s*</, 'nghề nghiệp cứng'],
  [/SỞ Y TẾ (TP |HÀ NỘI|ĐÀ NẴNG)/, 'tên Sở Y tế cứng'],
  [/BỆNH VIỆN CHUYÊN KHOA UNG THƯ NÃO NEUROSCAN|Bệnh viện Chuyên Khoa Ung Thư Não NeuroScan/, 'tên cơ sở cứng'],
  [/gender \|\| 'Nam'/, 'giới tính mặc định'],
  [/birthYear\) : '30'/, 'tuổi mặc định'],
  [/whoGrade \|\| 'IV'/, 'độ ác tính WHO mặc định'],
  [/location \|\| 'Bán cầu não'/, 'vị trí u mặc định'],
  [/confidence \|\| 0\.\d+/, 'độ tin cậy AI mặc định'],
  [/patientStatus \|\| 'Ổn định'/, 'tình trạng người bệnh mặc định'],
  [/treatment \|\| 'Chưa can thiệp phẫu thuật'/, 'phương pháp điều trị mặc định'],
  [/transportation \|\| 'Xe cấp cứu'/, 'phương tiện mặc định'],
  [/status \|\| 'SAFE'/, 'kết luận an toàn mặc định'],
  [/'(08:30|16:00) ngày|>(08:30|16:00) ngày/, 'giờ vào/ra viện cứng'],
  [/(dateIn|dateOut|recorded_at|transferTime|createdAt) \|\| Date\.now\(\)/, 'ngày lấy "hôm nay" khi thiếu dữ liệu'],
  [/High-grade Glioma\) vượt quá khả năng/, 'chẩn đoán mẫu tự điền'],
  [/setTransferPatientStatus\('Tỉnh táo/, 'tình trạng người bệnh tự điền'],
];
test('các mẫu giấy không còn dữ liệu giả', () => {
  const hits = [];
  for (const rel of PAPERS) {
    const text = fs.readFileSync(path.join(SRC, rel), 'utf8');
    for (const [re, label] of BANNED) if (re.test(text)) hits.push(`${rel}: ${label}`);
  }
  assert.deepStrictEqual(hits, []);
});

console.log(`\nSUMMARY: ${passed}/${passed + failed} PAPER FIELD TESTS PASSED${failed ? ` (${failed} failed)` : ' (100%)'}`);
process.exit(failed ? 1 : 0);
