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

/** Bật/tắt 1 nhóm, giữ đúng thứ tự chuẩn. */
export const toggleSection = (keys, key) => {
  const next = keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key];
  return ALL_SECTION_KEYS.filter((k) => next.includes(k));
};

/** "Toàn bộ bệnh án" hoặc danh sách nhóm đã chọn. Lượt chia sẻ cũ (không có nhóm) = toàn bộ. */
export const sectionsSummary = (keys) => {
  if (!keys || ALL_SECTION_KEYS.every((k) => keys.includes(k))) return 'Toàn bộ bệnh án';
  return SHARE_SECTIONS.filter((x) => keys.includes(x.key)).map((x) => x.label).join(', ');
};

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
