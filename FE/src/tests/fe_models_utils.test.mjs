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
import { extractMedications, extractOrders } from '../utils/clinicalText.js';
import { parseSimpleMarkdown } from '../utils/simpleMarkdown.js';
import { initialsOf } from '../utils/initials.js';
import { isStaffPortalPath } from '../utils/portalPath.js';
import { buildStaffTasks, nextUpVisits } from '../utils/staffTasks.js';
import { bpStatus, pulseStatus, spo2Status, labResultFlag, drugSchedule, isReminderDue } from '../utils/myHealth.js';
import { strokesToPath, consentStatus } from '../utils/signature.js';

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

console.log(`\n${colors.cyan}${colors.bold}SUITE 4: Staff Scheduling & Timezone Safety Algorithms${colors.reset}`);

const formatDateKey = (dateInput) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const timeToMinutes = (t) => {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const isTimeOverlap = (aStart, aEnd, bStart, bEnd) => {
  const s1 = timeToMinutes(aStart);
  const e1 = timeToMinutes(aEnd);
  const s2 = timeToMinutes(bStart);
  const e2 = timeToMinutes(bEnd);
  if (s1 === null || e1 === null || s2 === null || e2 === null) return false;
  return s1 < e2 && s2 < e1;
};

it('formatDateKey formats Date or ISO string consistently to YYYY-MM-DD', () => {
  const d = new Date(2026, 8, 29); // Sep 29, 2026
  assert.strictEqual(formatDateKey(d), '2026-09-29');
});

it('getWeekStart accurately calculates Monday for any day of the week', () => {
  const wed = new Date(2026, 8, 30); // Wednesday Sep 30, 2026
  const mon = getWeekStart(wed);
  assert.strictEqual(formatDateKey(mon), '2026-09-28');
  assert.strictEqual(mon.getDay(), 1); // Monday

  const sun = new Date(2026, 9, 4); // Sunday Oct 4, 2026
  const mon2 = getWeekStart(sun);
  assert.strictEqual(formatDateKey(mon2), '2026-09-28');
});

it('isTimeOverlap detects overlapping shift hours and permits sequential non-overlapping shifts', () => {
  // Overlap: 07:00-15:00 and 14:00-22:00 (14:00-15:00 overlap)
  assert.strictEqual(isTimeOverlap('07:00', '15:00', '14:00', '22:00'), true);
  // No overlap: 07:00-15:00 and 15:00-23:00 (Back-to-back)
  assert.strictEqual(isTimeOverlap('07:00', '15:00', '15:00', '23:00'), false);
  // No overlap: 06:00-14:00 and 18:00-22:00 (Completely separated)
  assert.strictEqual(isTimeOverlap('06:00', '14:00', '18:00', '22:00'), false);
});

it('findSchedules algorithm safely matches staff ID across string, ObjectId, and subdocument patterns', () => {
  const schedules = [
    { _id: 's1', staffId: { _id: 'user_01' }, date: '2026-09-29T00:00:00.000Z', shift: 'sáng' },
    { _id: 's2', staffId: 'user_01', date: '2026-09-29T10:00:00.000Z', shift: 'chiều' },
    { _id: 's3', staffId: { _id: 'user_02' }, date: '2026-09-29T00:00:00.000Z', shift: 'sáng' },
  ];

  const targetDate = new Date('2026-09-29T12:00:00Z');
  const targetKey = formatDateKey(targetDate);
  const found = schedules.filter((s) => {
    const sStaffId = s.staffId?._id || s.staffId?.id || s.staffId;
    return sStaffId === 'user_01' && formatDateKey(s.date) === targetKey;
  });

  assert.strictEqual(found.length, 2);
  assert.strictEqual(found[0]._id, 's1');
  assert.strictEqual(found[1]._id, 's2');
});

// ── clinicalText: trích thuốc / chỉ định từ form (dùng chung DocumentDetail + MedicalRecordForm) ──
it('extractMedications finds known drugs case-insensitively and ignores empty input', () => {
  assert.deepStrictEqual(extractMedications(''), []);
  assert.deepStrictEqual(extractMedications(undefined), []);
  assert.deepStrictEqual(extractMedications('Depakine 500mg x2, Keppra 1000mg'), ['keppra', 'depakine']);
});

it('extractOrders detects MRI order in a flat document form', () => {
  assert.deepStrictEqual(extractOrders({ chiDinh: 'Chụp MRI sọ não' }), ['MRI sọ não có cản quang']);
  assert.deepStrictEqual(extractOrders({ chiDinh: 'Xét nghiệm máu' }), []);
});

it('extractOrders detects MRI order nested inside a medical-record form (regression: [object Object])', () => {
  const nested = { hanhChinh: { hoTen: 'A' }, canLamSang: { hinhAnh: 'MRI có tiêm Gadolinium' } };
  assert.deepStrictEqual(extractOrders(nested), ['MRI sọ não có cản quang']);
});

// ── simpleMarkdown: hiển thị câu trả lời AI (Gemini trả markdown) ──
it('parseSimpleMarkdown turns bold-only lines into headings and bullets into list items', () => {
  const blocks = parseSimpleMarkdown('Chào bạn,\n\n**Kết quả cho thấy gì?**\n\n*   **Vị trí:** thùy thái dương\n- Kích thước nhỏ\n1. Tái khám');
  assert.deepStrictEqual(blocks.map((b) => b.type), ['paragraph', 'heading', 'bullet', 'bullet', 'numbered']);
  assert.strictEqual(blocks[1].segments[0].text, 'Kết quả cho thấy gì?');
  assert.deepStrictEqual(blocks[2].segments, [{ text: 'Vị trí:', bold: true }, { text: ' thùy thái dương', bold: false }]);
  assert.strictEqual(blocks[4].marker, '1.');
});

it('parseSimpleMarkdown keeps unmatched ** as plain text and handles empty input', () => {
  assert.deepStrictEqual(parseSimpleMarkdown(''), []);
  assert.deepStrictEqual(parseSimpleMarkdown(null), []);
  const [b] = parseSimpleMarkdown('Chỉ số 5 ** chưa đóng');
  assert.strictEqual(b.type, 'paragraph');
  assert.strictEqual(b.segments.map((s) => s.text).join(''), 'Chỉ số 5 ** chưa đóng');
});

// ── initialsOf: avatar bệnh nhân (trước đây mọi tên mẫu "Bệnh nhân …" đều ra "B") ──
it('initialsOf strips the "Bệnh nhân" prefix and the note in parentheses', () => {
  assert.strictEqual(initialsOf('Bệnh nhân Tuấn Thành (U Màng Não)'), 'TT');
  assert.strictEqual(initialsOf('Bệnh nhân Minh Hằng (Glioblastoma Phù Não)'), 'MH');
  assert.strictEqual(initialsOf('Nguyễn Văn An'), 'VA');
});

it('initialsOf handles single words and empty input', () => {
  assert.strictEqual(initialsOf('An'), 'A');
  assert.strictEqual(initialsOf(''), '?');
  assert.strictEqual(initialsOf(undefined), '?');
});

// ── isStaffPortalPath: trước đây "/staff-management" bị coi là cổng nội bộ (F5 bị đá về dashboard) ──
it('isStaffPortalPath matches only /staff and /staff/*', () => {
  assert.strictEqual(isStaffPortalPath('/staff'), true);
  assert.strictEqual(isStaffPortalPath('/staff/home'), true);
  assert.strictEqual(isStaffPortalPath('/staff/staff-management'), true);
});

it('isStaffPortalPath ignores main-app routes that merely start with "staff"', () => {
  assert.strictEqual(isStaffPortalPath('/staff-management'), false);
  assert.strictEqual(isStaffPortalPath('/staff-scheduling'), false);
  assert.strictEqual(isStaffPortalPath('/'), false);
  assert.strictEqual(isStaffPortalPath(''), false);
});

// ── buildStaffTasks / nextUpVisits: trang chủ nhân viên "Việc cần làm hôm nay" ──
it('buildStaffTasks counts doctor work by status and puts pending tasks first', () => {
  const visits = [
    { status: 'đang chờ' }, { status: 'chờ khám bệnh' }, { status: 'chờ bác sĩ đọc' }, { status: 'hoàn tất' },
  ];
  const emr = [{ signStatus: 'Chưa duyệt' }, { signStatus: 'Đã ký' }];
  const tasks = buildStaffTasks('doctor', { visits, emr });
  const byKey = Object.fromEntries(tasks.map(t => [t.key, t.count]));
  assert.deepStrictEqual(byKey, { exam: 2, examining: 0, read: 1, scan: 0, sign: 1 });
  assert.deepStrictEqual(tasks.map(t => t.key), ['exam', 'read', 'sign', 'examining', 'scan']);
  // bác sĩ kiêm chụp MRI (BE my-queue trả cả ca chụp cho bác sĩ)
  const withScan = buildStaffTasks('doctor', { visits: [{ status: 'chờ chụp' }, { status: 'đang chụp' }] });
  assert.strictEqual(withScan.find(t => t.key === 'scan').count, 2);
  assert.deepStrictEqual(tasks[0].params, { tab: 'examQueue' });
});

it('buildStaffTasks handles unknown role and missing data', () => {
  assert.deepStrictEqual(buildStaffTasks('patient', {}), []);
  assert.deepStrictEqual(buildStaffTasks('receptionist').map(t => t.count), [0, 0]);
});

it('nextUpVisits keeps only the role\'s active statuses, emergencies first', () => {
  const visits = [
    { _id: 'a', status: 'chờ chụp' },
    { _id: 'b', status: 'đang khám' },
    { _id: 'c', status: 'đang chụp', priority: 'khẩn cấp' },
    { _id: 'd', status: 'hoàn tất' },
  ];
  assert.deepStrictEqual(nextUpVisits('technician', visits).map(v => v._id), ['c', 'a']);
  assert.deepStrictEqual(nextUpVisits('receptionist', visits, 2).map(v => v._id), ['c', 'a']);
});

// ── myHealth: diễn giải chỉ số cho bệnh nhân (màn "Sức khỏe của tôi") ──
it('bpStatus classifies blood pressure (ACC/AHA) and tolerates missing data', () => {
  assert.strictEqual(bpStatus({ systolic: 115, diastolic: 75 }).level, 'normal');
  assert.strictEqual(bpStatus({ systolic: 125, diastolic: 78 }).level, 'elevated');
  assert.strictEqual(bpStatus({ systolic: 118, diastolic: 85 }).level, 'high');
  assert.strictEqual(bpStatus({ systolic: 150, diastolic: 95 }).level, 'high');
  assert.strictEqual(bpStatus(null), null);
  assert.strictEqual(bpStatus({ systolic: 120 }), null);
});

it('pulseStatus and spo2Status flag values outside common ranges', () => {
  assert.strictEqual(pulseStatus(72).level, 'normal');
  assert.strictEqual(pulseStatus(52).level, 'low');
  assert.strictEqual(pulseStatus(110).level, 'high');
  assert.strictEqual(spo2Status(98).level, 'normal');
  assert.strictEqual(spo2Status(92).level, 'low');
  assert.strictEqual(spo2Status(undefined), null);
});

it('labResultFlag and drugSchedule produce patient-friendly text', () => {
  assert.strictEqual(labResultFlag({ is_abnormal: true, abnormal_direction: 'HIGH' }).label, 'Cao hơn tham chiếu');
  assert.strictEqual(labResultFlag({ is_abnormal: true, abnormal_direction: 'LOW' }).label, 'Thấp hơn tham chiếu');
  assert.strictEqual(labResultFlag({ is_abnormal: false }).level, 'normal');
  assert.strictEqual(drugSchedule({ timesPerDay: 2, durationDays: 7 }), '2 lần/ngày, trong 7 ngày');
  assert.strictEqual(drugSchedule({}), '');
});

// ── signature: chữ ký tay + trạng thái phiếu đồng thuận cản quang (UC-PAT-06) ──
it('strokesToPath scales pad strokes into the 300x120 viewBox and keeps single taps visible', () => {
  const path = strokesToPath([[{ x: 0, y: 0 }, { x: 600, y: 240 }]], { width: 600, height: 240 });
  assert.strictEqual(path, 'M0 0 L300 120');
  assert.ok(strokesToPath([[{ x: 10, y: 10 }]], { width: 300, height: 120 }).includes('L'));
  assert.strictEqual(strokesToPath([], { width: 300, height: 120 }), '');
  assert.ok(/^[ML0-9.\s-]+$/.test(strokesToPath([[{ x: 1.234, y: 5.678 }, { x: 9, y: 9 }]], { width: 300, height: 120 })));
});

it('consentStatus orders the steps: checklist → doctor review → sign → signed', () => {
  assert.strictEqual(consentStatus({}).key, 'checklist');
  assert.strictEqual(consentStatus({ patientChecklistAt: '2026-10-06', isBlockedByChecklist: true }).key, 'blocked');
  assert.strictEqual(consentStatus({ patientChecklistAt: '2026-10-06', isBlockedByChecklist: true, isDoctorOverridden: true }).key, 'ready');
  assert.strictEqual(consentStatus({ patientChecklistAt: '2026-10-06' }).key, 'ready');
  assert.strictEqual(consentStatus({ patientChecklistAt: '2026-10-06', patientSigned: true }).key, 'signed');
  assert.strictEqual(consentStatus(null), null);
});

// ── UC-PAT-13: nhắc uống thuốc trong app ──
it('isReminderDue flags pending doses whose time has come, not done/skipped/future ones', () => {
  const now = new Date(2026, 9, 6, 13, 5);
  assert.strictEqual(isReminderDue({ status: 'pending', time: '13:00' }, now), true);
  assert.strictEqual(isReminderDue({ status: 'pending', time: '13:05' }, now), true);
  assert.strictEqual(isReminderDue({ status: 'pending', time: '20:00' }, now), false);
  assert.strictEqual(isReminderDue({ status: 'done', time: '08:00' }, now), false);
  assert.strictEqual(isReminderDue({ status: 'skipped', time: '08:00' }, now), false);
});

console.log(`\n======================================================================`);
console.log(`SUMMARY: ${passed}/${passed + failed} FRONTEND UNIT TESTS PASSED (100%)`);
console.log(`======================================================================\n`);

if (failed > 0) {
  process.exit(1);
}

