// Vòng 3: form "Bệnh án Ung thư Não" không gửi giá trị cứng sai danh mục, chỉ gửi trường đã nhập;
// màn EMR, phụ lục, huy hiệu chữ ký không còn chứng thư/lý do mặc định giả.
// Chạy: node src/tests/fe_medical_record_payload.test.mjs
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMedicalRecordPayload } from '../utils/medicalRecordPayload.js';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');
let passed = 0;
let failed = 0;
const test = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ✔ ${name}`); } catch (e) { failed += 1; console.log(`  ✖ ${name}\n    ${e.message}`); }
};

test('form trống chỉ gửi mã bệnh nhân, không gửi hình thức vào viện/khoa/BHYT/trạng thái', () => {
  assert.deepStrictEqual(buildMedicalRecordPayload({ hanhChinh: { hoTen: '', tuoi: '', gioiTinh: '' } }, 'BN1'), { patientId: 'BN1' });
});

test('chỉ gửi trường đã nhập; giới tính ngoài danh mục và tuổi không phải số bị bỏ', () => {
  const p = buildMedicalRecordPayload({
    hanhChinh: { hoTen: '  Trần Thị B ', tuoi: '45', gioiTinh: 'nữ giới' },
    chanDoan: { xacDinh: 'U màng não' },
    huongDieuTri: { chuyenKhoa: '' },
  }, 'BN2');
  assert.deepStrictEqual(p, { patientId: 'BN2', patientName: 'Trần Thị B', age: 45, diagnosis: 'U màng não' });
  assert.strictEqual(buildMedicalRecordPayload({ hanhChinh: { tuoi: '45 tuổi', gioiTinh: 'Nữ' } }, 'BN3').age, undefined);
  assert.strictEqual(buildMedicalRecordPayload({ hanhChinh: { tuoi: '0', gioiTinh: 'Nữ' } }, 'BN3').age, 0);
  assert.strictEqual(buildMedicalRecordPayload({ hanhChinh: { gioiTinh: 'Nữ' } }, 'BN3').gender, 'Nữ');
});

test('mã nguồn không còn giá trị cứng/giả: Tự đến, BHYT, CA mặc định, lý do phụ lục tự điền', () => {
  const hook = read('controllers/useMedicalRecordForm.js');
  for (const banned of ["'Tự đến'", "'BHYT'", "'Thần kinh'", "status: 'Đang điều trị'"]) assert.ok(!hook.includes(banned), banned);
  assert.ok(hook.includes('Chưa lưu lên hệ thống'), 'phải báo đúng khi lưu server lỗi');
  const emr = read('screens/EMRDashboardScreen.jsx');
  assert.ok(!emr.includes("|| 'Bổ sung thông tin lâm sàng theo Thông tư 13/2025/TT-BYT'"), 'lý do phụ lục tự điền');
  // ký và phụ lục: BE trả { status: "success" } (không có success: true)
  for (const fn of ['handleSignRecord', 'handleCreateAddendum']) {
    const body = emr.slice(emr.indexOf(`const ${fn} = async`), emr.indexOf(`const ${fn} = async`) + 2500);
    assert.ok(body.includes("res.status === 'success'"), `${fn} phải nhận phản hồi { status: "success" }`);
  }
  assert.ok(!read('components/DigitalSignatureBadge.js').includes("|| 'VNPT-CA'"), 'CA mặc định');
});

console.log(`\nSUMMARY: ${passed}/${passed + failed} MEDICAL RECORD PAYLOAD TESTS PASSED${failed ? ` (${failed} failed)` : ' (100%)'}`);
process.exit(failed ? 1 : 0);
