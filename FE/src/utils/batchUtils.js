// Tiện ích hiển thị tồn kho THEO LÔ (UC-PHA-07) — dùng chung cho các màn Kho thuốc.
// Thuần hàm, không phụ thuộc React, để test được bằng bộ unit test FE.

const DAY_MS = 24 * 60 * 60 * 1000;

// Số ngày còn lại tới hạn dùng (âm = đã hết hạn; null = không ghi hạn dùng)
export function daysLeftOf(expiryDate, now = new Date()) {
  if (!expiryDate) return null;
  const t = new Date(expiryDate).getTime() - new Date(now).getTime();
  return Math.ceil(t / DAY_MS);
}

// Mức độ cảnh báo theo số ngày còn lại
export function expiryStatus(daysLeft) {
  if (daysLeft === null || daysLeft === undefined) return 'unknown';
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 7) return 'critical';
  if (daysLeft <= 30) return 'warning';
  return 'ok';
}

// Nhãn tiếng Việt ngắn gọn của mức cảnh báo
export function expiryStatusText(status) {
  switch (status) {
    case 'expired': return 'ĐÃ HẾT HẠN';
    case 'critical': return 'SẮP HẾT HẠN';
    case 'warning': return 'CẦN THEO DÕI';
    default: return '';
  }
}

export function batchesOf(drug) {
  return Array.isArray(drug && drug.batches) ? drug.batches : [];
}

export function batchCountOf(drug) {
  return batchesOf(drug).length;
}

// Lô còn hàng có hạn dùng sớm nhất (FEFO sẽ xuất lô này trước tiên);
// trả về null khi thuốc không có lô nào còn hàng.
export function earliestActiveBatch(drug, now = new Date()) {
  const withQty = batchesOf(drug).filter((b) => (Number(b.quantity) || 0) > 0);
  if (withQty.length === 0) return null;
  return withQty.reduce((best, b) => {
    if (!best) return b;
    const ba = best.expiryDate ? new Date(best.expiryDate).getTime() : Number.POSITIVE_INFINITY;
    const bb = b.expiryDate ? new Date(b.expiryDate).getTime() : Number.POSITIVE_INFINITY;
    return bb < ba ? b : best;
  }, null);
}

// Chuỗi hiển thị "Hạn dùng" của cả thuốc: ưu tiên lô sớm nhất của thuốc theo lô,
// fallback hạn dùng danh mục cũ (legacy).
export function displayExpiry(drug, now = new Date()) {
  const batch = earliestActiveBatch(drug, now);
  if (batch && batch.expiryDate) return new Date(batch.expiryDate).toLocaleDateString('vi-VN');
  if (drug && drug.expiryDate) return new Date(drug.expiryDate).toLocaleDateString('vi-VN');
  return 'Không thời hạn';
}
