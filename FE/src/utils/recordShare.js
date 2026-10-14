// UC-PAT-09 — Chia sẻ bệnh án qua QR: hàm thuần (không import react-native) để test bằng node.

/** Link đưa vào QR: trang xem công khai, mã QR chỉ mở được trong 5 phút. */
export const buildShareUrl = (origin, qrToken) =>
  `${String(origin).replace(/\/+$/, '')}/xem-benh-an?q=${encodeURIComponent(qrToken)}`;

/** Địa chỉ web từ địa chỉ API: dev cục bộ API cổng 3000 ↔ web cổng 8083; sau proxy thì dùng nguyên. */
export const webOriginFrom = (apiUrl) => String(apiUrl).replace(/\/+$/, '').replace(/:3000$/, ':8083');

/**
 * Địa chỉ web đưa vào QR. Điện thoại quét không mở được "localhost" (là chính nó),
 * nên khi đang mở web bằng localhost thì đổi sang IP LAN của máy chạy web.
 */
export const shareOrigin = ({ webUrl, location, lanIp, apiUrl } = {}) => {
  if (webUrl) return String(webUrl).replace(/\/+$/, '');
  if (location) {
    const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    if (isLocal && lanIp) return `${location.protocol}//${lanIp}${location.port ? `:${location.port}` : ''}`;
    return location.origin;
  }
  return webOriginFrom(apiUrl);
};

/** Nhóm bệnh nhân chọn để chia sẻ — khớp SHARE_SECTIONS ở BE (sharedRecord.service.js). */
export const SHARE_SECTIONS = [
  { key: 'visits', label: 'Lịch sử khám', icon: 'clipboard' },
  { key: 'imaging', label: 'Phim MRI/CT', icon: 'film' },
  { key: 'prescriptions', label: 'Đơn thuốc', icon: 'package' },
  { key: 'labs', label: 'Xét nghiệm', icon: 'droplet' },
  { key: 'vitals', label: 'Sinh hiệu', icon: 'activity' },
  { key: 'safety', label: 'Dị ứng thuốc & liên hệ khẩn cấp', icon: 'alert-triangle' },
  { key: 'inpatient', label: 'Bệnh án nội trú', icon: 'folder' },
  { key: 'papers', label: 'Giấy ra viện, chuyển viện', icon: 'file-text' },
  { key: 'documents', label: 'Giấy tờ tự quét', icon: 'camera' },
];
export const ALL_SECTION_KEYS = SHARE_SECTIONS.map((x) => x.key);

/**
 * "Toàn bộ bệnh án" hoặc danh sách nhóm đã chọn. Lượt chia sẻ cũ (không có nhóm) = toàn bộ.
 * `documentCount`: số giấy tờ tự quét bệnh nhân chọn cho lượt đó (null = không rõ / tất cả).
 * `itemCounts` { nhóm: số mục }: nhóm bệnh nhân chỉ chia sẻ một số mục → ghi "Đơn thuốc (2 mục)".
 */
export const sectionsSummary = (keys, { documentCount = null, itemCounts = null } = {}) => {
  const n = documentCount === null || documentCount === undefined ? '' : ` (${documentCount})`;
  if (!keys) return 'Toàn bộ bệnh án';
  const counts = itemCounts || {};
  const partial = keys.some((k) => Number.isInteger(counts[k]));
  if (!partial && ALL_SECTION_KEYS.every((k) => keys.includes(k))) return n ? `Toàn bộ bệnh án, gồm ${documentCount} giấy tờ tự quét` : 'Toàn bộ bệnh án';
  const suffix = (k) => (k === 'documents' ? n : (Number.isInteger(counts[k]) ? ` (${counts[k]} mục)` : ''));
  return SHARE_SECTIONS.filter((x) => keys.includes(x.key)).map((x) => `${x.label}${suffix(x.key)}`).join(', ');
};

/** Loại giấy tờ tự quét — khớp DOC_TYPES ở BE (scannedDocument.service.js) và AI service (document_ocr.py). */
export const SCAN_DOC_TYPES = [
  { key: 'prescription', label: 'Đơn thuốc' },
  { key: 'lab_result', label: 'Kết quả xét nghiệm' },
  { key: 'imaging_result', label: 'Kết quả chụp chiếu' },
  { key: 'discharge', label: 'Giấy ra viện' },
  { key: 'referral', label: 'Giấy chuyển viện' },
  { key: 'other', label: 'Khác' },
];
export const docTypeLabel = (key) => SCAN_DOC_TYPES.find((t) => t.key === key)?.label || 'Khác';

/** Giấy tờ có thông tin chính (loại giấy, ngày, nơi khám, thuốc...) hay chỉ lưu ở dạng chữ. */
export const hasStructuredInfo = (fields) => {
  const f = fields || {};
  return (!!f.docType && f.docType !== 'other') || [f.date, f.facility, f.doctor, f.diagnosis].some((v) => String(v || '').trim()) || (f.medications || []).length > 0;
};

/**
 * Giấy tờ thuộc loại đã có mẫu (đơn thuốc, xét nghiệm, chụp chiếu, ra viện, chuyển viện) hoặc có danh sách thuốc.
 * Loại khác (bệnh án, giấy hẹn, ghi chú...) mặc định lưu ở dạng chữ, không ép điền theo mẫu.
 */
export const fitsKnownForm = (fields) => (!!fields?.docType && fields.docType !== 'other') || (fields?.medications || []).length > 0;

// ── So 2 lần đọc của AI: các "chỗ cần kiểm tra" { start, end, primary, other } (vị trí tính trên phần chữ AI trả về) ──

/** Dòng thứ mấy (từ 1) của vị trí `pos` trong phần chữ. */
export const lineOf = (text, pos) => String(text || '').slice(0, Math.max(0, pos)).split('\n').length;

/**
 * Vị trí hiện tại của 1 chỗ cần kiểm tra trong ô chữ. Bệnh nhân có thể đã sửa chữ làm lệch vị trí ban đầu:
 * khi đó tìm lại cụm chữ gần chỗ cũ. Trả { start, end } hoặc null nếu không còn tìm thấy.
 */
export const locateCheck = (text, check) => {
  const t = String(text || '');
  if (!check.primary) return check.start <= t.length ? { start: check.start, end: check.start } : null;
  if (t.slice(check.start, check.end) === check.primary) return { start: check.start, end: check.end };
  const near = t.indexOf(check.primary, Math.max(0, check.start - 300));
  return near >= 0 && near - check.start <= 600 ? { start: near, end: near + check.primary.length } : null;
};

/**
 * Đổi 1 chỗ theo bản đọc thứ hai (bệnh nhân nhìn ảnh thấy bản thứ hai mới đúng).
 * Trả { text, checks } mới (chỗ đó được bỏ khỏi danh sách, các chỗ phía sau dời vị trí theo), hoặc null nếu không áp dụng được.
 */
export const applyCheck = (text, checks, index) => {
  const check = checks[index];
  const at = check && check.other ? locateCheck(text, check) : null;
  if (!at) return null;
  const t = String(text || '');
  // chèn từ mới (bản chính không có): thêm khoảng trắng để không dính vào từ bên cạnh
  const insert = check.primary ? check.other : (at.start >= t.length ? ` ${check.other}` : `${check.other} `);
  const delta = insert.length - (at.end - at.start);
  return {
    text: t.slice(0, at.start) + insert + t.slice(at.end),
    checks: checks.filter((_, i) => i !== index).map((c) => (c.start >= at.end ? { ...c, start: c.start + delta, end: c.end + delta } : c)),
  };
};

/** Chiều cao ô nhập nhiều dòng: giãn theo nội dung nhưng trong khoảng [min, max] để trang không quá dài. */
export const clampHeight = (contentHeight, min, max) => Math.max(min, Math.min(max, Math.ceil(Number(contentHeight) || 0)));

// ── Nhân viên quét mã chia sẻ trong app ──
const SHARE_LINK_RE = /^https?:\/\/[^/?#\s]+(?:\/[^?#\s]*)?\/xem-benh-an\/?\?(?:[^#\s]*&)?q=([A-Za-z0-9_-]{20,128})(?:[&#]|$)/;
const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{20,128}$/;

/**
 * Chữ đọc được từ mã QR (hoặc liên kết dán vào) → mã chia sẻ, hoặc null nếu không phải mã chia sẻ bệnh án.
 * Chỉ lấy mã ra để gọi API của chính hệ thống; KHÔNG bao giờ mở địa chỉ nằm trong mã QR (tránh mã QR giả dẫn sang trang lạ).
 */
export const parseShareQr = (text) => {
  const raw = String(text ?? '').trim();
  if (SHARE_TOKEN_RE.test(raw)) return raw;
  return SHARE_LINK_RE.exec(raw)?.[1] || null;
};

const STAFF_ROLE_LABELS = { doctor: 'Bác sĩ', nurse: 'Điều dưỡng', receptionist: 'Lễ tân', technician: 'Kỹ thuật viên' };
/** Vai trò (do hệ thống ghi, nhân viên không tự sửa được) của người đã mở bệnh án bằng cách quét mã trong app. */
export const staffRoleLabel = (role) => STAFF_ROLE_LABELS[role] || 'Nhân viên y tế';

/** Số giây còn lại tới hạn (không âm). */
export const secondsLeft = (expiresAt, now = new Date()) =>
  Math.max(0, Math.round((new Date(expiresAt).getTime() - now.getTime()) / 1000));

/** 300 → "5:00". */
export const fmtCountdown = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** Ảnh phim lưu đường dẫn tương đối (/uploads/...) → ghép địa chỉ API; link tuyệt đối giữ nguyên. */
export const assetUrl = (url, apiBase) => {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `${String(apiBase).replace(/\/+$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
};
