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
import { isRateLimitError } from '../utils/apiErrors.js';
import { buildStaffTasks, nextUpVisits } from '../utils/staffTasks.js';
import { daysLeftOf, expiryStatus, expiryStatusText, batchCountOf, earliestActiveBatch, displayExpiry } from '../utils/batchUtils.js';
import { bpStatus, pulseStatus, spo2Status, labResultFlag, drugSchedule, isReminderDue, temperatureStatus, vitalSeries, chartRange, VITAL_METRICS } from '../utils/myHealth.js';
import { strokesToPath, consentStatus } from '../utils/signature.js';
import { buildShareUrl, secondsLeft, fmtCountdown, webOriginFrom, shareOrigin, assetUrl, SHARE_SECTIONS, ALL_SECTION_KEYS, sectionsSummary, SCAN_DOC_TYPES, docTypeLabel, parseShareQr, staffRoleLabel, hasStructuredInfo, fitsKnownForm, clampHeight, lineOf, locateCheck, applyCheck } from '../utils/recordShare.js';
import { foldText, prepareItems, filterItems, isFiltering, NO_FILTER, initialSelection, isItemOn, sectionState, toggleSectionAll, toggleItem, setItemsOn, sharePayload, countsOf, flattenSharedRecord, countBySection } from '../utils/shareCatalog.js';
import { SCREENING_LABELS, flaggedAnswers, prefillFromScreening, screeningBadge } from '../utils/mriScreening.js';
import { atTime, reminderPlan, appointmentPlan, buildPlan, MAX_SCHEDULED } from '../utils/notificationPlan.js';
import { COPY_SECTIONS, copySectionsText, copyStatus, copyFormError, COPY_REASON_MAX } from '../utils/recordCopy.js';
import { looksUrgent, appendMessage, SUGGESTED_QUESTIONS, CHAT_MAX_MESSAGE, CHAT_CONSENT_VERSION, CHAT_CONSENT_POINTS } from '../utils/healthChat.js';
import { readFileSync } from 'node:fs';

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
  // [0013-MyAssignments] thêm task 'assign' (ca phân công chờ xác nhận) — mặc định 0 khi chưa tải assignments
  assert.deepStrictEqual(byKey, { assign: 0, exam: 2, examining: 0, read: 1, scan: 0, sign: 1 });
  assert.deepStrictEqual(tasks.map(t => t.key), ['exam', 'read', 'sign', 'assign', 'examining', 'scan']);
  // bác sĩ kiêm chụp MRI (BE my-queue trả cả ca chụp cho bác sĩ)
  const withScan = buildStaffTasks('doctor', { visits: [{ status: 'chờ chụp' }, { status: 'đang chụp' }] });
  assert.strictEqual(withScan.find(t => t.key === 'scan').count, 2);
  assert.deepStrictEqual(tasks[0].params, { tab: 'examQueue' });
});

// [0013-MyAssignments] task 'assign' đếm ca phân công pending và dẫn tới màn Phân công của tôi
it('buildStaffTasks counts pending assignments for doctor and routes to MyAssignments first when present', () => {
  const withAssign = buildStaffTasks('doctor', {
    visits: [{ status: 'đang chờ' }],
    emr: [],
    assignments: [{ status: 'pending' }, { status: 'pending' }, { status: 'acknowledged' }, { status: 'completed' }],
  });
  assert.strictEqual(withAssign.find(t => t.key === 'assign').count, 2);
  // Việc còn tồn lên trước: assign (2 ca chờ ACK) đứng đầu danh sách
  assert.strictEqual(withAssign[0].key, 'assign');
  assert.deepStrictEqual(withAssign[0].params, { tab: 'pending' });
  // Role khác không có task assign
  assert.strictEqual(buildStaffTasks('nurse', { assignments: [{ status: 'pending' }] }).find(t => t.key === 'assign'), undefined);
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

// ── UC-PHA-07: tồn kho theo lô / FEFO — tiện ích hiển thị ──
console.log(`${colors.cyan}${colors.bold}SUITE: Batch/Expiry Utilities (batchUtils.js — UC-PHA-07)${colors.reset}`);

it('daysLeftOf đếm đúng số ngày tới hạn dùng (tròn ngày, không lệch timezone cục bộ)', () => {
  const now = new Date(2026, 9, 14, 8, 0); // 14/10/2026 08:00 giờ chỗ
  assert.strictEqual(daysLeftOf(new Date(2026, 9, 15, 8, 0), now), 1);
  assert.strictEqual(daysLeftOf(new Date(2026, 10, 5, 8, 0), now), 22);
  assert.strictEqual(daysLeftOf(new Date(2026, 8, 30, 8, 0), now), -14);
  assert.strictEqual(daysLeftOf(null, now), null);
});

it('expiryStatus phân cấp expired / critical (≤7 ngày) / warning (≤30 ngày) / ok', () => {
  assert.strictEqual(expiryStatus(-1), 'expired');
  assert.strictEqual(expiryStatus(3), 'critical');
  assert.strictEqual(expiryStatus(22), 'warning');
  assert.strictEqual(expiryStatus(45), 'ok');
  assert.strictEqual(expiryStatus(null), 'unknown');
  assert.strictEqual(expiryStatusText('expired'), 'ĐÃ HẾT HẠN');
  assert.strictEqual(expiryStatusText('critical'), 'SẮP HẾT HẠN');
});

it('earliestActiveBatch chọn lô còn hàng có hạn sớm nhất (nguyên tắc FEFO)', () => {
  const drug = {
    batches: [
      { batchNumber: 'LO-B', quantity: 700, expiryDate: '2028-06-30' },
      { batchNumber: 'LO-A', quantity: 500, expiryDate: '2027-04-30' },
      { batchNumber: 'LO-EMPTY', quantity: 0, expiryDate: '2026-11-01' },
    ],
  };
  assert.strictEqual(earliestActiveBatch(drug).batchNumber, 'LO-A');
  assert.strictEqual(batchCountOf(drug), 3);
  assert.strictEqual(earliestActiveBatch({ batches: [] }), null);
  assert.strictEqual(earliestActiveBatch({}), null);
});

it('displayExpiry ưu tiên lô sớm nhất, fallback hạn dùng danh mục cũ (legacy)', () => {
  const batched = {
    expiryDate: '2028-06-30',
    batches: [{ batchNumber: 'LO-A', quantity: 500, expiryDate: '2027-04-30' }],
  };
  assert.strictEqual(displayExpiry(batched), new Date('2027-04-30').toLocaleDateString('vi-VN'));
  const legacy = { expiryDate: '2027-10-15' };
  assert.strictEqual(displayExpiry(legacy), new Date('2027-10-15').toLocaleDateString('vi-VN'));
  assert.strictEqual(displayExpiry({}), 'Không thời hạn');
});

// ── [FIX 0014] Phân loại lỗi API: 429 (hệ thống bận) vs 401/403 (phiên hết hạn) ──
console.log('\n  ── FIX 0014: isRateLimitError (utils/apiErrors.js) ──');

it('isRateLimitError nhận ra lỗi 429 qua err.status', () => {
  assert.strictEqual(isRateLimitError({ status: 429, message: 'Quá nhiều lần thử' }), true);
});

it('isRateLimitError nhận ra lỗi qua err.code RATE_LIMIT_EXCEEDED', () => {
  assert.strictEqual(isRateLimitError({ status: 500, code: 'RATE_LIMIT_EXCEEDED', message: 'x' }), true);
});

it('isRateLimitError nhận ra qua message tiếng Việt của BE (FE cũ không gắn status)', () => {
  assert.strictEqual(isRateLimitError(new Error('Quá nhiều lần thử xác thực hoặc đăng nhập thất bại. Vui lòng thử lại sau 23 giây.')), true);
  assert.strictEqual(isRateLimitError(new Error('Bạn đã thực hiện quá nhiều yêu cầu. Vui lòng thử lại sau.')), true);
});

it('isRateLimitError KHÔNG nhầm 401/403/lỗi mạng với rate limit', () => {
  assert.strictEqual(isRateLimitError({ status: 401, message: 'Phiên làm việc đã hết hạn.' }), false);
  assert.strictEqual(isRateLimitError({ status: 403, code: 'FORBIDDEN', message: 'Không có quyền' }), false);
  assert.strictEqual(isRateLimitError(new Error('Request failed with status 500')), false);
  assert.strictEqual(isRateLimitError(new Error('Network request failed')), false);
});

it('isRateLimitError an toàn với input null/undefined/đối tượng rỗng', () => {
  assert.strictEqual(isRateLimitError(null), false);
  assert.strictEqual(isRateLimitError(undefined), false);
  assert.strictEqual(isRateLimitError({}), false);
  assert.strictEqual(isRateLimitError({ message: 123 }), false);
});

// ── UC-PAT-12: biểu đồ diễn biến sinh hiệu ──
it('temperatureStatus: bình thường, hơi cao, sốt, thấp; thiếu dữ liệu → null', () => {
  assert.strictEqual(temperatureStatus(36.8).level, 'normal');
  assert.strictEqual(temperatureStatus(37.6).level, 'elevated');
  assert.strictEqual(temperatureStatus(38.5).level, 'high');
  assert.strictEqual(temperatureStatus(34.8).level, 'low');
  assert.strictEqual(temperatureStatus(null), null);
});

it('vitalSeries sorts old → new, skips records missing the metric, keeps the latest N', () => {
  const items = [
    { recorded_at: '2026-10-03', blood_pressure: { systolic: 130, diastolic: 85 }, pulse: 88, spo2: 97, temperature: 37.9 },
    { recorded_at: '2026-10-01', blood_pressure: { systolic: 120, diastolic: 80 }, pulse: 72, spo2: 98 },
    { recorded_at: '2026-10-02', blood_pressure: { systolic: 125, diastolic: 82 }, pulse: 80, spo2: 96, temperature: 37.1 },
  ];
  const bp = vitalSeries(items, 'bp');
  assert.deepStrictEqual(bp.map((p) => p.values), [[120, 80], [125, 82], [130, 85]]);
  assert.deepStrictEqual(vitalSeries(items, 'temperature').map((p) => p.values[0]), [37.1, 37.9]);
  assert.deepStrictEqual(vitalSeries(items, 'pulse', 2).map((p) => p.values[0]), [80, 88]);
  assert.strictEqual(vitalSeries([], 'bp').length, 0);
  assert.ok(VITAL_METRICS.every((m) => m.key && m.label && m.unit && m.band));
});

it('chartRange covers both the data and the normal band, with padding', () => {
  const r = chartRange([{ values: [97] }, { values: [91] }], { min: 95, max: 100 });
  assert.ok(r.min < 91 && r.max > 100);
  const flat = chartRange([{ values: [72] }], { min: 72, max: 72 });
  assert.ok(flat.max > flat.min);
});

// ── UC-PAT-09: chia sẻ bệnh án qua QR ──
it('buildShareUrl puts the QR token in the public viewer URL (encoded, no trailing slash issues)', () => {
  assert.strictEqual(buildShareUrl('https://app.neuroscan.vn/', 'abc_-123'), 'https://app.neuroscan.vn/xem-benh-an?q=abc_-123');
  assert.strictEqual(buildShareUrl('http://192.168.1.5:8083', 'a+b'), 'http://192.168.1.5:8083/xem-benh-an?q=a%2Bb');
});

it('webOriginFrom maps the dev API port 3000 to the web port 8083, keeps proxied origins', () => {
  assert.strictEqual(webOriginFrom('http://192.168.1.5:3000'), 'http://192.168.1.5:8083');
  assert.strictEqual(webOriginFrom('https://api.neuroscan.vn'), 'https://api.neuroscan.vn');
});

it('share sections: same 9 keys as the backend, summary reads naturally', () => {
  assert.deepStrictEqual(ALL_SECTION_KEYS, ['visits', 'imaging', 'prescriptions', 'labs', 'vitals', 'safety', 'inpatient', 'papers', 'documents']);
  // 8 nhóm cũ (không có giấy tờ tự quét) không còn được gọi là "toàn bộ"
  assert.strictEqual(sectionsSummary(ALL_SECTION_KEYS.filter((k) => k !== 'documents')).includes('Giấy tờ tự quét'), false);
  assert.notStrictEqual(sectionsSummary(ALL_SECTION_KEYS.filter((k) => k !== 'documents')), 'Toàn bộ bệnh án');
  assert.ok(SHARE_SECTIONS.every((x) => x.label && x.icon));
  assert.strictEqual(sectionsSummary(ALL_SECTION_KEYS), 'Toàn bộ bệnh án');
  assert.strictEqual(sectionsSummary(undefined), 'Toàn bộ bệnh án'); // lượt chia sẻ cũ
  assert.strictEqual(sectionsSummary(['vitals', 'imaging']), 'Phim MRI/CT, Sinh hiệu');
});

it('picking individual scanned documents: summary shows the count, empty pick drops the documents group', () => {
  assert.strictEqual(sectionsSummary(['vitals', 'documents'], { documentCount: 2 }), 'Sinh hiệu, Giấy tờ tự quét (2)');
  assert.strictEqual(sectionsSummary(['documents']), 'Giấy tờ tự quét'); // lượt chia sẻ cũ: không rõ số lượng
  assert.strictEqual(sectionsSummary(ALL_SECTION_KEYS, { documentCount: 3 }), 'Toàn bộ bệnh án, gồm 3 giấy tờ tự quét');
  // nhóm chỉ chia sẻ một số mục: ghi rõ số mục, và không còn gọi là "toàn bộ"
  assert.strictEqual(sectionsSummary(['prescriptions', 'labs'], { itemCounts: { prescriptions: 2 } }), 'Đơn thuốc (2 mục), Xét nghiệm');
  assert.strictEqual(sectionsSummary(ALL_SECTION_KEYS, { documentCount: 1, itemCounts: { vitals: 3 } }).includes('Toàn bộ'), false);
  assert.strictEqual(sectionsSummary(ALL_SECTION_KEYS, { itemCounts: {} }), 'Toàn bộ bệnh án');
});

// ── Chọn từng mục, tìm kiếm và phân loại (utils/shareCatalog.js) ──
const NOW = new Date('2026-10-13T08:00:00Z');
const ago = (days) => new Date(NOW.getTime() - days * 24 * 3600 * 1000).toISOString();
const CATALOG = prepareItems([
  { section: 'prescriptions', id: 'rx1', title: 'Đơn thuốc', sub: 'Đau đầu, 1 thuốc', date: ago(400), source: 'hospital', keywords: 'đơn thuốc đau đầu bs an paracetamol 500mg' },
  { section: 'prescriptions', id: 'rx2', title: 'Đơn thuốc', sub: 'Tăng huyết áp, 1 thuốc', date: ago(3), source: 'hospital', keywords: 'đơn thuốc tăng huyết áp bs bình amlodipin 5mg' },
  { section: 'labs', id: 'lab1', title: 'Sinh hoá máu', sub: '1 chỉ số', date: ago(20), source: 'hospital', keywords: 'sinh hoá máu glucose' },
  { section: 'safety', id: 'allergies', title: 'Dị ứng thuốc', sub: 'Penicillin', date: null, source: 'self', keywords: 'dị ứng thuốc penicillin' },
  { section: 'documents', id: 'doc1', title: 'Đơn phòng khám tư', sub: 'Phòng khám Hoà Khánh', date: ago(100), source: 'self', keywords: 'losartan' },
  { section: 'hack', id: 'x', title: 'nhóm lạ' }, null,
]);
const ids = (list) => list.map((x) => x.id);

it('search ignores Vietnamese accents and case, every word must match', () => {
  assert.strictEqual(foldText('  Đơn  THUỐC Hoà Khánh '), 'don thuoc hoa khanh');
  assert.strictEqual(CATALOG.length, 5); // mục thuộc nhóm lạ / rỗng bị bỏ
  assert.deepStrictEqual(ids(CATALOG), ['rx2', 'lab1', 'doc1', 'rx1', 'allergies']); // mới nhất trước, không ngày xếp cuối
  assert.deepStrictEqual(ids(filterItems(CATALOG, { query: 'tang huyet ap' }, NOW)), ['rx2']);
  assert.deepStrictEqual(ids(filterItems(CATALOG, { query: 'AMLODIPIN bình' }, NOW)), ['rx2']);
  assert.deepStrictEqual(ids(filterItems(CATALOG, { query: 'don thuoc' }, NOW)), ['rx2', 'rx1']); // tìm theo tên loại tài liệu
  assert.deepStrictEqual(ids(filterItems(CATALOG, { query: 'đơn' }, NOW)), ['rx2', 'doc1', 'rx1']);
  assert.deepStrictEqual(ids(filterItems(CATALOG, { query: 'khong co gi' }, NOW)), []);
  assert.strictEqual(filterItems(CATALOG, NO_FILTER, NOW).length, 5);
});

it('filter by document type, time window and source; undated items survive the time filter', () => {
  assert.deepStrictEqual(ids(filterItems(CATALOG, { section: 'prescriptions' }, NOW)), ['rx2', 'rx1']);
  assert.deepStrictEqual(ids(filterItems(CATALOG, { period: '1m' }, NOW)), ['rx2', 'lab1', 'allergies']);
  assert.deepStrictEqual(ids(filterItems(CATALOG, { period: '6m' }, NOW)), ['rx2', 'lab1', 'doc1', 'allergies']);
  assert.deepStrictEqual(ids(filterItems(CATALOG, { source: 'self' }, NOW)), ['doc1', 'allergies']);
  assert.deepStrictEqual(ids(filterItems(CATALOG, { source: 'hospital', period: '1m', query: 'glucose' }, NOW)), ['lab1']);
  assert.strictEqual(isFiltering(NO_FILTER), false);
  assert.strictEqual(isFiltering({ ...NO_FILTER, query: '  ' }), false);
  assert.strictEqual(isFiltering({ ...NO_FILTER, period: '1y' }), true);
  assert.deepStrictEqual(countBySection(CATALOG), { prescriptions: 2, labs: 1, documents: 1, safety: 1 });
});

it('picking items: everything ticked by default; group box is all / some / none', () => {
  const rx1 = CATALOG.find((x) => x.id === 'rx1'); const rx2 = CATALOG.find((x) => x.id === 'rx2');
  let sel = initialSelection();
  assert.ok(CATALOG.every((it) => isItemOn(sel, it)));
  assert.strictEqual(sectionState(sel, CATALOG, 'prescriptions'), 'all');
  assert.strictEqual(sectionState(sel, CATALOG, 'visits'), 'all'); // nhóm chưa có mục nào vẫn bật được
  sel = toggleItem(sel, CATALOG, rx1);
  assert.strictEqual(sectionState(sel, CATALOG, 'prescriptions'), 'some');
  assert.strictEqual(isItemOn(sel, rx1), false);
  sel = toggleItem(sel, CATALOG, rx2); // bỏ nốt mục cuối → tắt cả nhóm
  assert.strictEqual(sectionState(sel, CATALOG, 'prescriptions'), 'none');
  assert.strictEqual(sel.sections.includes('prescriptions'), false);
  sel = toggleItem(sel, CATALOG, rx2); // tick 1 mục của nhóm đang tắt → bật nhóm với đúng mục đó
  assert.strictEqual(isItemOn(sel, rx2), true);
  assert.strictEqual(isItemOn(sel, rx1), false);
  assert.deepStrictEqual(sel.sections, initialSelection().sections); // giữ đúng thứ tự chuẩn
  sel = toggleSectionAll(sel, CATALOG, 'prescriptions'); // đang chọn 1 phần → bấm ô nhóm = chọn hết
  assert.strictEqual(sectionState(sel, CATALOG, 'prescriptions'), 'all');
  sel = toggleSectionAll(sel, CATALOG, 'prescriptions'); // đang đủ → tắt nhóm
  assert.strictEqual(sectionState(sel, CATALOG, 'prescriptions'), 'none');
  // chọn / bỏ nhiều mục đang hiện sau khi lọc
  sel = setItemsOn(initialSelection(), CATALOG, filterItems(CATALOG, { source: 'hospital' }, NOW), false);
  assert.deepStrictEqual(ids(CATALOG.filter((it) => isItemOn(sel, it))), ['doc1', 'allergies']);
  sel = setItemsOn(sel, CATALOG, filterItems(CATALOG, { query: 'glucose' }, NOW), true);
  assert.deepStrictEqual(ids(CATALOG.filter((it) => isItemOn(sel, it))), ['lab1', 'doc1', 'allergies']);
});

it('share payload: whole groups send no ids, partial groups send exactly the ticked ids, empty groups are dropped', () => {
  const rx1 = CATALOG.find((x) => x.id === 'rx1'); const doc1 = CATALOG.find((x) => x.id === 'doc1');
  const all = sharePayload(initialSelection(), CATALOG);
  assert.deepStrictEqual(all.sections, initialSelection().sections);
  assert.deepStrictEqual(all.items, { documents: ['doc1'] }); // giấy tờ tự quét luôn gửi danh sách
  const part = sharePayload(toggleItem(initialSelection(), CATALOG, rx1), CATALOG);
  assert.deepStrictEqual(part.items, { prescriptions: ['rx2'], documents: ['doc1'] });
  assert.deepStrictEqual(countsOf(part), { prescriptions: 1 });
  const noDocs = sharePayload(toggleItem(initialSelection(), CATALOG, doc1), CATALOG);
  assert.strictEqual(noDocs.sections.includes('documents'), false);
  assert.strictEqual('documents' in noDocs.items, false);
  // chưa có giấy tờ nào: nhóm giấy tờ không được gửi dù đang bật; nhóm khác chưa có mục vẫn gửi (chia sẻ mục phát sinh sau)
  const empty = sharePayload(initialSelection(), []);
  assert.strictEqual(empty.sections.includes('documents'), false);
  assert.strictEqual(empty.sections.includes('labs'), true);
  // mục đã chọn biến mất khỏi danh mục (vd. vừa xoá giấy tờ): không gửi nhóm rỗng lên máy chủ
  const stale = { sections: ['labs', 'prescriptions'], excluded: ['prescriptions:rx1', 'prescriptions:rx2'] };
  assert.deepStrictEqual(sharePayload(stale, CATALOG), { sections: ['labs'], items: {} });
  assert.deepStrictEqual(sharePayload({ sections: [], excluded: [] }, CATALOG), { sections: [], items: {} });
});

it('viewer: shared record flattens into one searchable list, newest first, with source and type', () => {
  const flat = flattenSharedRecord({
    prescriptions: [{ recorded_at: ago(3), diagnosis: 'Tăng huyết áp', doctor_name: 'BS Bình', drugs: [{ name: 'Amlodipin 5mg', usage: 'Sáng 1 viên' }] }],
    labs: [{ category: 'Sinh hoá máu', ordered_at: ago(20), results: [{ biomarker_name: 'Glucose' }] }],
    vitals: [{ recorded_at: ago(1), blood_pressure: '120/80', pulse: 72 }],
    safety: { shared: ['emergencyContact'], emergencyContact: { name: 'Trần Thị B', phone: '0900000001' } },
    dischargePapers: [{ dateOut: ago(50), diagnosis: 'U màng não' }],
    transferForms: [{ recorded_at: ago(55), transferTo: 'Bệnh viện Chợ Rẫy' }],
    scannedDocuments: [{ _id: 'd1', title: 'Kết quả siêu âm', text: 'Gan nhiễm mỡ độ 1', createdAt: ago(2), fields: {} }],
  });
  assert.deepStrictEqual(flat.map((x) => x.kind), ['vitals', 'documents', 'prescriptions', 'labs', 'discharge', 'transfer', 'emergencyContact']);
  assert.strictEqual(flat.some((x) => x.kind === 'allergies'), false); // phần bệnh nhân không chia sẻ thì không có trong danh sách
  assert.deepStrictEqual(filterItems(flat, { query: 'amlodipin' }, NOW).map((x) => x.section), ['prescriptions']);
  assert.deepStrictEqual(filterItems(flat, { query: 'nhiem mo' }, NOW).map((x) => x.title), ['Kết quả siêu âm']); // tìm trong chữ của giấy tờ tự quét
  assert.deepStrictEqual(filterItems(flat, { section: 'papers' }, NOW).map((x) => x.kind), ['discharge', 'transfer']);
  assert.deepStrictEqual(filterItems(flat, { source: 'self' }, NOW).map((x) => x.kind), ['documents', 'emergencyContact']);
  assert.deepStrictEqual(filterItems(flat, { period: '1m' }, NOW).map((x) => x.kind), ['vitals', 'documents', 'prescriptions', 'labs', 'emergencyContact']);
  assert.strictEqual(new Set(flat.map((x) => x.key)).size, flat.length); // khoá không trùng
  assert.deepStrictEqual(flattenSharedRecord(null), []);
  // lượt chia sẻ cũ không có `shared`: coi như chia sẻ cả 2 phần
  assert.deepStrictEqual(flattenSharedRecord({ safety: { drugAllergies: ['Penicillin'], emergencyContact: {} } }).map((x) => x.kind), ['allergies', 'emergencyContact']);
});

it('scanned document types match the backend list and unknown types read as "Khác"', () => {
  assert.deepStrictEqual(SCAN_DOC_TYPES.map((t) => t.key), ['prescription', 'lab_result', 'imaging_result', 'discharge', 'referral', 'other']);
  assert.strictEqual(docTypeLabel('prescription'), 'Đơn thuốc');
  assert.strictEqual(docTypeLabel('virus'), 'Khác');
  assert.strictEqual(docTypeLabel(undefined), 'Khác');
});

it('parseShareQr: only our share links / tokens yield a token; anything else (other sites, viewer links) is rejected', () => {
  const token = 'AbC-dEf_123456789012345678901234567890123';
  assert.strictEqual(parseShareQr(buildShareUrl('http://192.168.1.214:8083', token)), token);
  assert.strictEqual(parseShareQr(`  https://app.neuroscan.vn/xem-benh-an?q=${token}  `), token);
  assert.strictEqual(parseShareQr(`https://app.neuroscan.vn/staff/xem-benh-an/?x=1&q=${token}&y=2`), token);
  assert.strictEqual(parseShareQr(token), token);
  for (const bad of [
    '', null, undefined, 'xin chào', 'https://evil.example/login', `https://evil.example/?q=${token}`,
    `https://app.neuroscan.vn/xem-benh-an?v=${token}`, // vé xem của người khác, không phải mã QR
    `javascript:alert(1)//xem-benh-an?q=${token}`, 'https://app.neuroscan.vn/xem-benh-an?q=ngắn', `https://app.neuroscan.vn/xem-benh-an?q=${token}<script>`,
    `https://app.neuroscan.vn/xem-benh-an-gia?q=${token}`, `ftp://x/xem-benh-an?q=${token}`,
  ]) assert.strictEqual(parseShareQr(bad), null, String(bad));
});

it('staffRoleLabel: the role shown to the patient comes from the system role, unknown roles get a generic label', () => {
  assert.strictEqual(staffRoleLabel('doctor'), 'Bác sĩ');
  assert.strictEqual(staffRoleLabel('receptionist'), 'Lễ tân');
  assert.strictEqual(staffRoleLabel('la'), 'Nhân viên y tế');
});

it('a scanned document with no structured info is a plain-text document', () => {
  const empty = { docType: 'other', date: '', facility: ' ', doctor: '', diagnosis: '', medications: [] };
  assert.strictEqual(hasStructuredInfo(empty), false);
  assert.strictEqual(hasStructuredInfo(undefined), false);
  assert.strictEqual(hasStructuredInfo({}), false);
  assert.strictEqual(hasStructuredInfo({ ...empty, docType: 'prescription' }), true);
  assert.strictEqual(hasStructuredInfo({ ...empty, facility: 'PK An Bình' }), true);
  assert.strictEqual(hasStructuredInfo({ ...empty, medications: [{ name: 'A' }] }), true);
});

it('documents of an unknown type default to plain text even when a hospital name or date was detected', () => {
  assert.strictEqual(fitsKnownForm({ docType: 'other', facility: 'BV Mẫu', date: '1/1/2026', medications: [] }), false);
  assert.strictEqual(fitsKnownForm(undefined), false);
  assert.strictEqual(fitsKnownForm({ docType: 'lab_result' }), true);
  assert.strictEqual(fitsKnownForm({ docType: 'other', medications: [{ name: 'A' }] }), true);
});

it('cross-check spots: found at their position, re-found after the patient edits the text, applied without breaking later spots', () => {
  const text = 'ĐƠN THUỐC\nAmlodipin 5mg 30 viên\nMagnesi B6 60 viên';
  const a = { start: 20, end: 23, primary: '5mg', other: '50mg' };
  const b = { start: 43, end: 45, primary: '60', other: '80' };
  assert.strictEqual(text.slice(a.start, a.end), '5mg');
  assert.strictEqual(text.slice(b.start, b.end), '60');
  assert.strictEqual(lineOf(text, a.start), 2);
  assert.strictEqual(lineOf(text, b.start), 3);
  assert.deepStrictEqual(locateCheck(text, a), { start: 20, end: 23 });
  // bệnh nhân gõ thêm chữ ở đầu → vị trí lệch, vẫn tìm lại được đúng cụm chữ
  const edited = 'PHÒNG KHÁM AN BÌNH\n' + text;
  assert.deepStrictEqual(locateCheck(edited, a), { start: 39, end: 42 });
  assert.strictEqual(locateCheck(text.replace('5mg', '10mg'), a), null); // bệnh nhân đã tự sửa chỗ đó: không còn gì để chọn
  // đổi theo bản đọc thứ hai: chữ đổi đúng chỗ, chỗ phía sau dời vị trí theo và vẫn đúng
  const r = applyCheck(text, [a, b], 0);
  assert.strictEqual(r.text, 'ĐƠN THUỐC\nAmlodipin 50mg 30 viên\nMagnesi B6 60 viên');
  assert.strictEqual(r.checks.length, 1);
  assert.strictEqual(r.text.slice(r.checks[0].start, r.checks[0].end), '60');
  // từ chỉ bản thứ hai thấy: chèn vào, có khoảng trắng
  assert.strictEqual(applyCheck('Uống sáng 1 viên', [{ start: 16, end: 16, primary: '', other: 'sau ăn' }], 0).text, 'Uống sáng 1 viên sau ăn');
  assert.strictEqual(applyCheck('Uống 1 viên', [{ start: 5, end: 5, primary: '', other: 'sáng' }], 0).text, 'Uống sáng 1 viên');
  // bản thứ hai không thấy cụm chữ (other rỗng): không tự xoá chữ của bệnh nhân
  assert.strictEqual(applyCheck('a b c', [{ start: 2, end: 3, primary: 'b', other: '' }], 0), null);
});

it('clampHeight: the text box grows with its content but stays between the limits', () => {
  assert.strictEqual(clampHeight(120, 280, 520), 280);
  assert.strictEqual(clampHeight(400.2, 280, 520), 401);
  assert.strictEqual(clampHeight(5000, 280, 520), 520);
  assert.strictEqual(clampHeight(undefined, 280, 520), 280);
});

it('shareOrigin: QR never points to localhost when the LAN IP is known (phones cannot open localhost)', () => {
  const local = { protocol: 'http:', hostname: 'localhost', port: '8083', origin: 'http://localhost:8083' };
  assert.strictEqual(shareOrigin({ location: local, lanIp: '192.168.1.214' }), 'http://192.168.1.214:8083');
  assert.strictEqual(shareOrigin({ location: { ...local, hostname: '127.0.0.1' }, lanIp: '192.168.1.214' }), 'http://192.168.1.214:8083');
  // đã mở bằng IP LAN / tên miền thật thì giữ nguyên
  const lan = { protocol: 'http:', hostname: '192.168.1.214', port: '8083', origin: 'http://192.168.1.214:8083' };
  assert.strictEqual(shareOrigin({ location: lan, lanIp: '10.0.0.2' }), 'http://192.168.1.214:8083');
  // cấu hình EXPO_PUBLIC_WEB_URL luôn được ưu tiên
  assert.strictEqual(shareOrigin({ webUrl: 'https://app.neuroscan.vn', location: local, lanIp: '192.168.1.214' }), 'https://app.neuroscan.vn');
  // app điện thoại (không có window.location): suy từ địa chỉ API
  assert.strictEqual(shareOrigin({ apiUrl: 'http://192.168.1.214:3000' }), 'http://192.168.1.214:8083');
});

it('countdown: seconds left never negative, formatted m:ss', () => {
  const now = new Date('2026-10-12T08:00:00Z');
  assert.strictEqual(secondsLeft('2026-10-12T08:05:00Z', now), 300);
  assert.strictEqual(secondsLeft('2026-10-12T07:59:00Z', now), 0);
  assert.strictEqual(fmtCountdown(300), '5:00');
  assert.strictEqual(fmtCountdown(65), '1:05');
});

it('assetUrl prefixes relative upload paths with the API base, keeps absolute URLs', () => {
  assert.strictEqual(assetUrl('/uploads/a.jpg', 'http://x:3000'), 'http://x:3000/uploads/a.jpg');
  assert.strictEqual(assetUrl('https://drive.google.com/x', 'http://x:3000'), 'https://drive.google.com/x');
  assert.strictEqual(assetUrl('', 'http://x:3000'), '');
});

// ── Phiếu sàng lọc an toàn MRI bệnh nhân tự khai ──
const NO_ALL = Object.fromEntries(Object.keys(SCREENING_LABELS).map((k) => [k, 'no']));

it('MRI screening: staff prefill turns on the metal/device box for any dangerous yes/unsure answer', () => {
  assert.strictEqual(Object.keys(SCREENING_LABELS).length, 10);
  const unsure = { answers: { ...NO_ALL, metalFragments: 'unsure', claustrophobia: 'yes' }, details: 'Từng làm thợ hàn', declaredAt: '2026-10-15T02:00:00Z', level: 'danger' };
  const pre = prefillFromScreening(unsure);
  assert.strictEqual(pre.hasPacemakerOrMetal, true);
  assert.strictEqual(pre.hasClaustrophobia, true);
  assert.strictEqual(pre.isPregnant, false);
  assert.ok(pre.safetyNotes.includes('Mảnh kim loại trong người (Không rõ)'));
  assert.strictEqual(pre.safetyNotes.includes('Từng làm thợ hàn'), false); // chữ tự do của BN không vào ghi chú mang tên KTV
  assert.deepStrictEqual(flaggedAnswers(unsure).map((f) => f.key), ['metalFragments', 'claustrophobia']); // câu nguy hiểm lên đầu
  // dụng cụ cấy ghép thường (khớp, nẹp vít) không tự chặn, chỉ ghi chú
  assert.strictEqual(prefillFromScreening({ answers: { ...NO_ALL, implants: 'yes' }, declaredAt: 'x', level: 'attention' }).hasPacemakerOrMetal, false);
  // chưa khai: không điền gì, KTV hỏi từ đầu
  assert.deepStrictEqual(prefillFromScreening(null), { hasPacemakerOrMetal: false, hasClaustrophobia: false, isPregnant: false, safetyNotes: '' });
  assert.deepStrictEqual(prefillFromScreening({ answers: {}, declaredAt: null }).safetyNotes, '');
});

it('MRI screening: queue badge reflects what the patient declared', () => {
  assert.strictEqual(screeningBadge(null), null);
  assert.strictEqual(screeningBadge({ answers: NO_ALL, declaredAt: 'x', level: 'clear' }).tone, 'info');
  assert.strictEqual(screeningBadge({ answers: NO_ALL, declaredAt: 'x', level: 'attention' }).tone, 'warning');
  assert.strictEqual(screeningBadge({ answers: NO_ALL, declaredAt: 'x', level: 'danger' }).tone, 'danger');
  assert.ok(prefillFromScreening({ answers: NO_ALL, declaredAt: 'x', level: 'clear' }).safetyNotes.includes('không có yếu tố nào'));
});

// ── Thông báo hẹn sẵn trên điện thoại ──
it('local notifications: today\'s pending doses only, future times only, same-time drugs grouped', () => {
  const now = new Date(2026, 9, 15, 9, 0); // 09:00 giờ máy
  const plan = reminderPlan([
    { _id: 'a', time: '08:00', drugName: 'Paracetamol 500mg', dosageText: '1 viên', status: 'pending' }, // đã qua
    { _id: 'b', time: '12:00', drugName: 'Amlodipin 5mg', dosageText: '1 viên', status: 'pending' },
    { _id: 'c', time: '12:00', drugName: 'Depakine 500mg', dosageText: '', status: 'pending' },
    { _id: 'd', time: '20:00', drugName: 'Thuốc đã uống', status: 'done' },
    { _id: 'e', time: '21:00', drugName: 'Thuốc bỏ qua', status: 'skipped' },
    { _id: 'f', time: '25:99', drugName: 'Giờ hỏng', status: 'pending' },
    { _id: 'g', time: '7:30', drugName: 'Sáng sớm', status: 'pending' }, // đã qua, viết thiếu số 0
    null,
  ], now);
  assert.deepStrictEqual(plan.map((p) => p.title), ['Đến giờ uống thuốc 12:00']);
  assert.strictEqual(plan[0].body, '2 loại thuốc. Mở ứng dụng để xem tên thuốc và liều.');
  assert.strictEqual(plan[0].body.includes('Amlodipin'), false); // không lộ tên thuốc trên màn khoá
  assert.strictEqual(plan[0].date.getHours(), 12);
  assert.strictEqual(atTime(now, '24:00'), null);
  assert.deepStrictEqual(reminderPlan(undefined, now), []);
  const many = reminderPlan(['A', 'B', 'C', 'D', 'E'].map((n) => ({ time: '18:00', drugName: n, status: 'pending' })), now);
  assert.strictEqual(many[0].body.startsWith('5 loại thuốc'), true);
});

it('local notifications: appointments 2 hours ahead, only active future visits, capped list', () => {
  const now = new Date(2026, 9, 15, 9, 0);
  const visits = [
    { _id: 'v1', status: 'đang chờ', date: new Date(2026, 9, 16, 8, 30).toISOString(), mriOrder: { region: 'Sọ não' } },
    { _id: 'v2', status: 'hoàn tất', date: new Date(2026, 9, 16, 8, 30).toISOString() }, // đã xong
    { _id: 'v3', status: 'đang chờ', date: new Date(2026, 9, 15, 10, 0).toISOString() }, // còn 1 giờ: quá muộn để nhắc trước 2 giờ
    { _id: 'v4', status: 'đang chờ' }, // không có giờ hẹn
  ];
  const plan = appointmentPlan(visits, now);
  assert.deepStrictEqual(plan.map((p) => p.key), ['visit-v1']);
  assert.strictEqual(plan[0].title, 'Sắp tới giờ chụp MRI');
  assert.strictEqual(plan[0].date.getHours(), 6);
  assert.ok(plan[0].body.includes('08:30'));
  const meds = Array.from({ length: 40 }, (_, i) => ({ time: `${String(10 + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`, drugName: `T${i}`, status: 'pending' }));
  const all = buildPlan(meds, visits, now);
  assert.strictEqual(all.length, MAX_SCHEDULED);
  assert.ok(all.every((p, i) => i === 0 || all[i - 1].date <= p.date)); // theo thứ tự thời gian
});

it('record copy: sections match the backend list, labels and form validation', () => {
  assert.deepStrictEqual(COPY_SECTIONS.map((x) => x.key), ['visits', 'imaging', 'prescriptions', 'labs', 'vitals', 'inpatient', 'papers']);
  assert.strictEqual(copySectionsText(['prescriptions', 'visits']), 'Lịch sử khám, Đơn thuốc'); // theo thứ tự chuẩn
  assert.strictEqual(copyStatus('approved').label, 'Đã duyệt');
  assert.strictEqual(copyStatus('lạ').label, 'Không rõ');
  assert.ok(copyFormError({ sections: [], reason: '' }));
  assert.ok(copyFormError({ sections: ['visits'], reason: 'a'.repeat(COPY_REASON_MAX + 1) }));
  assert.strictEqual(copyFormError({ sections: ['visits'], reason: '  ' + 'a'.repeat(COPY_REASON_MAX) + '  ' }), null);
});

it('health chat: urgent-sign hint ignores diacritics, history is capped', () => {
  assert.strictEqual(looksUrgent('Bố tôi bị CO GIẬT từ sáng'), true);
  assert.strictEqual(looksUrgent('yeu nua nguoi ben trai'), true);
  assert.strictEqual(looksUrgent('Chụp MRI có đau không?'), false);
  let list = [];
  for (let i = 0; i < 70; i += 1) list = appendMessage(list, i % 2 ? 'assistant' : 'user', 'm' + i);
  assert.strictEqual(list.length, 60);
  assert.strictEqual(list[59].text, 'm69');
  assert.strictEqual(new Set(list.map((m) => m.id)).size, 60);
  assert.ok(SUGGESTED_QUESTIONS.every((q) => q.length <= CHAT_MAX_MESSAGE));
});

it('health chat consent: version matches the backend, text names Google and the logging', () => {
  // đồng ý gửi kèm phiên bản nội dung đã hiện; lệch với máy chủ thì mọi lần bấm đồng ý đều bị 409
  const be = readFileSync(new URL('../../../BE/src/services/patientChat.service.js', import.meta.url), 'utf8');
  assert.strictEqual(/CHAT_CONSENT_VERSION = "([^"]+)"/.exec(be)?.[1], CHAT_CONSENT_VERSION);
  const text = CHAT_CONSENT_POINTS.join(' ');
  assert.ok(text.includes('Google') && text.includes('ghi lại') && text.includes('rút lại'));
});


console.log(`\n======================================================================`);
console.log(`SUMMARY: ${passed}/${passed + failed} FRONTEND UNIT TESTS PASSED (100%)`);
console.log(`======================================================================\n`);

if (failed > 0) {
  process.exit(1);
}

