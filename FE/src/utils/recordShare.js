// UC-PAT-09 — Chia sẻ bệnh án qua QR: hàm thuần (không import react-native) để test bằng node.

/** Link đưa vào QR: trang xem công khai, mã QR chỉ mở được trong 5 phút. */
export const buildShareUrl = (origin, qrToken) =>
  `${String(origin).replace(/\/+$/, '')}/xem-benh-an?q=${encodeURIComponent(qrToken)}`;

/** Địa chỉ web từ địa chỉ API: dev cục bộ API cổng 3000 ↔ web cổng 8083; sau proxy thì dùng nguyên. */
export const webOriginFrom = (apiUrl) => String(apiUrl).replace(/\/+$/, '').replace(/:3000$/, ':8083');

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
