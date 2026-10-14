// UC-PAT-09 — Chọn từng mục khi chia sẻ bệnh án, tìm kiếm và phân loại tài liệu.
// Hàm thuần (không import react-native) để test bằng node.
import { ALL_SECTION_KEYS, SHARE_SECTIONS, docTypeLabel, hasStructuredInfo } from './recordShare.js';

/** Chữ để so khi tìm kiếm: bỏ dấu tiếng Việt, chữ thường, gọn khoảng trắng ("Đơn thuốc" → "don thuoc"). */
export const foldText = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd')
  .toLowerCase().replace(/\s+/g, ' ').trim();

export const PERIODS = [
  { key: 'all', label: 'Mọi lúc' },
  { key: '1m', label: '1 tháng', days: 31 },
  { key: '6m', label: '6 tháng', days: 183 },
  { key: '1y', label: '1 năm', days: 366 },
];
export const SOURCES = [
  { key: 'all', label: 'Mọi nguồn' },
  { key: 'hospital', label: 'Bệnh viện ghi' },
  { key: 'self', label: 'Bệnh nhân tự khai' },
];
export const NO_FILTER = { query: '', section: 'all', period: 'all', source: 'all' };
export const sectionLabel = (key) => SHARE_SECTIONS.find((x) => x.key === key)?.label || '';
export const sectionIcon = (key) => SHARE_SECTIONS.find((x) => x.key === key)?.icon || 'file';

const time = (d) => { const t = d ? new Date(d).getTime() : NaN; return Number.isNaN(t) ? null : t; };

/** Danh mục từ máy chủ → mục có khoá riêng (`nhóm:mã`), chữ tìm kiếm đã bỏ dấu; mới nhất trước, mục không có ngày xếp cuối. */
export const prepareItems = (items) => (Array.isArray(items) ? items : [])
  .filter((it) => it && ALL_SECTION_KEYS.includes(it.section) && it.id)
  .map((it) => ({ ...it, key: `${it.section}:${it.id}`, search: foldText(`${it.title} ${it.sub} ${it.keywords} ${sectionLabel(it.section)}`) }))
  .sort((a, b) => (time(b.date) ?? -Infinity) - (time(a.date) ?? -Infinity));

/**
 * Lọc theo từ khoá (mọi từ đều phải có, không phân biệt dấu), loại tài liệu, thời gian, nguồn.
 * Mục không có ngày (dị ứng thuốc, liên hệ khẩn cấp) là thông tin hiện tại nên không bị lọc theo thời gian.
 */
export const filterItems = (items, { query = '', section = 'all', period = 'all', source = 'all' } = {}, now = new Date()) => {
  const words = foldText(query).split(' ').filter(Boolean);
  const days = PERIODS.find((p) => p.key === period)?.days;
  const since = days ? now.getTime() - days * 24 * 3600 * 1000 : null;
  return items.filter((it) => (section === 'all' || it.section === section)
    && (source === 'all' || it.source === source)
    && (since === null || time(it.date) === null || time(it.date) >= since)
    && words.every((w) => it.search.includes(w)));
};
export const isFiltering = (f) => !!f && (!!foldText(f.query) || f.section !== 'all' || f.period !== 'all' || f.source !== 'all');

// ── Trạng thái tick của bệnh nhân: { sections: [nhóm đang bật], excluded: [khoá mục bị bỏ tick] } ──
// Mặc định mọi nhóm bật, không bỏ mục nào (đã chốt: tick sẵn tất cả).

export const initialSelection = () => ({ sections: [...ALL_SECTION_KEYS], excluded: [] });
const ordered = (keys) => ALL_SECTION_KEYS.filter((k) => keys.includes(k));
const keysOf = (items, section) => items.filter((it) => it.section === section).map((it) => it.key);

export const isItemOn = (sel, item) => sel.sections.includes(item.section) && !sel.excluded.includes(item.key);
export const selectedIn = (sel, items, section) => items.filter((it) => it.section === section && isItemOn(sel, it));

/** 'all' | 'some' | 'none'. Nhóm chưa có mục nào vẫn bật/tắt được (bật = chia sẻ cả các mục phát sinh sau này). */
export const sectionState = (sel, items, section) => {
  if (!sel.sections.includes(section)) return 'none';
  const total = keysOf(items, section).length;
  const on = selectedIn(sel, items, section).length;
  if (!total || on === total) return 'all';
  return on ? 'some' : 'none';
};

/** Bấm vào ô của cả nhóm: đang đủ → tắt nhóm; còn lại → bật và chọn hết các mục. */
export const toggleSectionAll = (sel, items, section) => {
  const mine = keysOf(items, section);
  const excluded = sel.excluded.filter((k) => !mine.includes(k));
  return sectionState(sel, items, section) === 'all'
    ? { sections: sel.sections.filter((k) => k !== section), excluded }
    : { sections: ordered([...sel.sections, section]), excluded };
};

/** Tick / bỏ tick 1 mục. Tick mục của nhóm đang tắt → bật nhóm với đúng mục đó; bỏ mục cuối cùng → tắt nhóm. */
export const toggleItem = (sel, items, item) => {
  const mine = keysOf(items, item.section);
  const others = sel.excluded.filter((k) => !mine.includes(k));
  if (!sel.sections.includes(item.section)) {
    return { sections: ordered([...sel.sections, item.section]), excluded: [...others, ...mine.filter((k) => k !== item.key)] };
  }
  if (sel.excluded.includes(item.key)) return { sections: sel.sections, excluded: sel.excluded.filter((k) => k !== item.key) };
  const excluded = [...sel.excluded, item.key];
  return mine.every((k) => excluded.includes(k))
    ? { sections: sel.sections.filter((k) => k !== item.section), excluded: others }
    : { sections: sel.sections, excluded };
};

/** Tick hoặc bỏ tick nhiều mục cùng lúc (các mục đang hiện sau khi lọc). */
export const setItemsOn = (sel, items, targets, on) => targets.reduce((cur, it) => (isItemOn(cur, it) === on ? cur : toggleItem(cur, items, it)), sel);

/**
 * Dữ liệu gửi lên khi tạo mã: { sections, items }.
 * - Nhóm chọn đủ: chỉ gửi tên nhóm (chia sẻ cả nhóm, kể cả mục phát sinh sau).
 * - Nhóm chỉ chọn một số mục: gửi kèm đúng mã các mục đó (chốt lúc tạo mã).
 * - Giấy tờ tự quét luôn gửi danh sách; không còn giấy tờ nào được chọn thì bỏ nhóm.
 */
export const sharePayload = (sel, items) => {
  const out = { sections: [], items: {} };
  for (const section of ordered(sel.sections)) {
    const total = keysOf(items, section).length;
    const on = selectedIn(sel, items, section);
    if (section === 'documents' ? !on.length : (total > 0 && !on.length)) continue;
    out.sections.push(section);
    if (section === 'documents' || on.length < total) out.items[section] = on.map((it) => it.id);
  }
  return out;
};

/** Số mục đã chọn của từng nhóm chỉ chia sẻ một phần, để ghi "Đơn thuốc (2 mục)". */
export const countsOf = (payload) => Object.fromEntries(Object.entries(payload.items).filter(([k]) => k !== 'documents').map(([k, ids]) => [k, ids.length]));

// ── Trang người xem: gom mọi mục được chia sẻ vào 1 danh sách để tìm và lọc ──

const row = (section, index, item, { title, sub = '', date = null, source = 'hospital', words = [], kind = section }) => ({
  key: `${kind}:${index}`, section, kind, item, title, sub, date, source,
  search: foldText([title, sub, sectionLabel(section), ...words.flat(3)].filter(Boolean).join(' ')),
});
const join = (parts) => parts.filter(Boolean).join(', ');

/** Bệnh án người xem nhận được → danh sách phẳng, mới nhất trước. `item` là dữ liệu gốc để vẽ chi tiết. */
export const flattenSharedRecord = (data) => {
  const d = data || {};
  const out = [];
  (d.imaging || []).forEach((f, i) => out.push(row('imaging', i, f, {
    title: f.procedure || f.imagingType || 'Phim chụp', sub: f.conclusion || f.diagnosis, date: f.reportDate || f.orderDate,
    words: [f.imagingType, f.technique, f.diagnosis, f.findings, f.radiologist, f.orderingDoctor],
  })));
  (d.visits || []).forEach((v, i) => out.push(row('visits', i, v, {
    title: v.reason ? `Lượt khám: ${v.reason}` : 'Lượt khám', sub: join([v.visitType, v.doctor ? `bác sĩ ${v.doctor}` : '']), date: v.date, words: [v.status, v.mriRegion],
  })));
  (d.prescriptions || []).forEach((p, i) => out.push(row('prescriptions', i, p, {
    title: 'Đơn thuốc', sub: join([p.diagnosis, (p.drugs || []).length ? `${p.drugs.length} thuốc` : '']), date: p.recorded_at,
    words: [p.doctor_name, p.note, (p.drugs || []).map((x) => [x?.name, x?.usage])],
  })));
  (d.labs || []).forEach((l, i) => out.push(row('labs', i, l, {
    title: l.category || 'Xét nghiệm', sub: (l.results || []).length ? `${l.results.length} chỉ số` : '', date: l.resulted_at || l.ordered_at,
    words: [l.status, (l.results || []).map((r) => r?.biomarker_name)],
  })));
  (d.vitals || []).forEach((v, i) => out.push(row('vitals', i, v, {
    title: 'Sinh hiệu', date: v.recorded_at,
    sub: join([v.blood_pressure ? `huyết áp ${v.blood_pressure}` : '', v.pulse ? `mạch ${v.pulse}` : '', v.spo2 ? `SpO₂ ${v.spo2}%` : '', v.temperature ? `nhiệt độ ${v.temperature} °C` : '']),
  })));
  const shared = d.safety ? (d.safety.shared || ['allergies', 'emergencyContact']) : [];
  if (shared.includes('allergies')) {
    const list = d.safety.drugAllergies || [];
    out.push(row('safety', 0, d.safety, { kind: 'allergies', title: 'Dị ứng thuốc', sub: list.length ? list.join(', ') : 'Bệnh nhân chưa khai báo', source: 'self' }));
  }
  if (shared.includes('emergencyContact')) {
    const c = d.safety.emergencyContact || {};
    out.push(row('safety', 0, d.safety, { kind: 'emergencyContact', title: 'Người liên hệ khẩn cấp', sub: [c.name, c.relation ? `(${c.relation})` : '', c.phone].filter(Boolean).join(' ') || 'Bệnh nhân chưa khai báo', source: 'self' }));
  }
  (d.inpatientRecords || []).forEach((r, i) => out.push(row('inpatient', i, r, {
    title: r.department ? `Bệnh án nội trú: ${r.department}` : 'Bệnh án nội trú', sub: r.diagnosis, date: r.createdAt,
    words: [r.doctorInCharge, r.tumorType, r.status, r.treatmentPlan],
  })));
  (d.dischargePapers || []).forEach((p, i) => out.push(row('papers', i, p, {
    kind: 'discharge', title: 'Giấy ra viện', sub: p.diagnosis, date: p.dateOut || p.recorded_at, words: [p.doctor_name, p.treatment, p.note],
  })));
  (d.transferForms || []).forEach((t, i) => out.push(row('papers', i, t, {
    kind: 'transfer', title: t.transferTo ? `Giấy chuyển viện đến ${t.transferTo}` : 'Giấy chuyển viện', sub: t.diagnosis, date: t.recorded_at,
    words: [t.doctor_name, t.reason, t.reasonDetail, t.clinicalSummary],
  })));
  (d.scannedDocuments || []).forEach((s, i) => out.push(row('documents', i, s, {
    title: s.title, sub: hasStructuredInfo(s.fields) ? docTypeLabel(s.fields?.docType) : 'Giấy tờ dạng chữ', date: s.createdAt, source: 'self',
    words: [s.fields?.facility, s.fields?.doctor, s.fields?.diagnosis, s.fields?.date, (s.fields?.medications || []).map((m) => m?.name), String(s.text || '').slice(0, 4000)],
  })));
  return out.sort((a, b) => (time(b.date) ?? -Infinity) - (time(a.date) ?? -Infinity));
};

/** Số mục theo nhóm, cho nhãn "Đơn thuốc (3)" ở thanh phân loại. */
export const countBySection = (items) => items.reduce((acc, it) => ({ ...acc, [it.section]: (acc[it.section] || 0) + 1 }), {});
