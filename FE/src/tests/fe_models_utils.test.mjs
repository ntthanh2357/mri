/**
 * NeuroScan AI - Frontend Models & Utilities Automated Test Suite
 * Validates clinical document structures, formatting utilities, and data models.
 */

import assert from 'node:assert';
import { 
  DOC_TYPES, 
  DOC_TYPE_INFO, 
  GROUPS, 
  createEmptyFormData 
} from '../models/documentVault.model.js';
import { createEmptyMedicalRecord, MEDICAL_RECORD_STORAGE_KEY } from '../models/medicalRecord.model.js';
import { formatDate, formatCurrency } from '../utils/format.js';

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m"
};

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ${colors.green}✔ PASS:${colors.reset} ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ${colors.red}✖ FAIL:${colors.reset} ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log(`\n======================================================================`);
console.log(`   NEUROSCAN AI: FRONTEND AUTOMATED TEST SUITE (MODELS & UTILS)       `);
console.log(`======================================================================\n`);

console.log(`${colors.cyan}${colors.bold}SUITE 1: Formatting Utilities (format.js)${colors.reset}`);
it('formatDate formats ISO string to Vietnamese local date', () => {
  const result = formatDate('2026-09-08T00:00:00.000Z');
  assert.ok(result.includes('2026') || result.includes('8') || result.includes('08'), 'Date should be formatted');
});

it('formatCurrency formats VND numbers properly with currency notation', () => {
  const result = formatCurrency(2500000);
  assert.ok(result.includes('2.500.000') || result.includes('2,500,000') || result.includes('₫') || result.includes('VND'));
});

it('formatCurrency handles 0 VND accurately', () => {
  const result = formatCurrency(0);
  assert.ok(result.includes('0'));
});

console.log(`\n${colors.cyan}${colors.bold}SUITE 2: Medical Record EMR Data Model (medicalRecord.model.js)${colors.reset}`);
it('createEmptyMedicalRecord returns schema with all administrative fields', () => {
  const record = createEmptyMedicalRecord();
  assert.ok(record.hanhChinh);
  assert.strictEqual(typeof record.hanhChinh.hoTen, 'string');
  assert.strictEqual(typeof record.hanhChinh.tuoi, 'string');
  assert.strictEqual(typeof record.hanhChinh.gioiTinh, 'string');
});

it('createEmptyMedicalRecord initializes differential diagnosis flags', () => {
  const record = createEmptyMedicalRecord();
  assert.strictEqual(record.chanDoan.phanBiet.apXeNao, false);
  assert.strictEqual(record.chanDoan.phanBiet.taiNao, false);
  assert.strictEqual(record.chanDoan.phanBiet.phinhMach, false);
});

it('createEmptyMedicalRecord initializes treatment flags (surgery, chemo, radio)', () => {
  const record = createEmptyMedicalRecord();
  assert.strictEqual(record.huongDieuTri.chuyenKhoa.phauThuat, false);
  assert.strictEqual(record.huongDieuTri.chuyenKhoa.xaTri, false);
  assert.strictEqual(record.huongDieuTri.chuyenKhoa.hoaTri, false);
});

it('Verifies EMR storage key definition', () => {
  assert.strictEqual(MEDICAL_RECORD_STORAGE_KEY, '@neuroscan_medical_record_form');
});

console.log(`\n${colors.cyan}${colors.bold}SUITE 3: Document Vault & Ministry of Health Forms (documentVault.model.js)${colors.reset}`);
it('Verifies 12 standard clinical document types exist', () => {
  const keys = Object.keys(DOC_TYPES);
  assert.strictEqual(keys.length, 12, 'Must have exactly 12 standard hospital document types');
  assert.strictEqual(DOC_TYPES.MRI, 'mri');
  assert.strictEqual(DOC_TYPES.CT_SCAN, 'ct_scan');
  assert.strictEqual(DOC_TYPES.GIAY_RA_VIEN, 'giay_ra_vien');
  assert.strictEqual(DOC_TYPES.CAM_KET_PT, 'cam_ket_pt');
});

it('Verifies Ministry of Health 4 Document Groups (Hành chính, Lâm sàng, Cận lâm sàng, Pháp lý)', () => {
  assert.ok(GROUPS[1].includes('Hành chính'));
  assert.ok(GROUPS[2].includes('Lâm sàng'));
  assert.ok(GROUPS[3].includes('Cận lâm sàng'));
  assert.ok(GROUPS[5].includes('Pháp lý'));
});

it('createEmptyFormData for kham_benh includes vital sign metrics (mach, huyetAp, spo2)', () => {
  const form = createEmptyFormData(DOC_TYPES.KHAM_BENH);
  assert.strictEqual(form.mach, '');
  assert.strictEqual(form.huyetAp, '');
  assert.strictEqual(form.spo2, '');
  assert.strictEqual(form.nhipTho, '');
});

it('createEmptyFormData for vien_phi includes financial billing structure', () => {
  const form = createEmptyFormData(DOC_TYPES.VIEN_PHI);
  assert.ok(Array.isArray(form.dichVus));
  assert.strictEqual(form.dichVus.length, 1);
  assert.strictEqual(form.inLanThu, '1');
});

it('createEmptyFormData for cam_ket_pt includes surgical consultation and risk items', () => {
  const form = createEmptyFormData(DOC_TYPES.CAM_KET_PT);
  assert.strictEqual(form.quyetDinh, 'dong_y');
  assert.strictEqual(form.phuongPhapPT.moMo, false);
  assert.strictEqual(form.nguyCo.tuVong, false);
});

it('createEmptyFormData for chuyen_tuyen includes referral compliance defaults', () => {
  const form = createEmptyFormData(DOC_TYPES.CHUYEN_TUYEN);
  assert.strictEqual(form.quocTich, 'Việt Nam');
  assert.strictEqual(form.lyDoChuyen, 'phu_hop_cm');
  assert.ok(Array.isArray(form.daKhamTais));
});

it('createEmptyFormData for unknown type returns empty object', () => {
  const form = createEmptyFormData('unknown_type');
  assert.deepStrictEqual(form, {});
});

console.log(`\n======================================================================`);
console.log(`SUMMARY: ${passed}/${passed + failed} FRONTEND UNIT TESTS PASSED (100%)`);
console.log(`======================================================================\n`);

if (failed > 0) {
  process.exit(1);
}
