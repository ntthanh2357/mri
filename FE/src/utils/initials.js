/**
 * Chữ viết tắt cho avatar. Tên mẫu dạng "Bệnh nhân Tuấn Thành (U Màng Não)":
 * bỏ tiền tố "Bệnh nhân" và phần ghi chú trong ngoặc, lấy chữ đầu của 2 từ cuối ("TT").
 */
export const initialsOf = (name = '') => {
  const words = String(name || '')
    .replace(/\(.*?\)/g, '')
    .replace(/^Bệnh nhân\s+/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '?';
  return ((words.length > 1 ? words[words.length - 2][0] : '') + words[words.length - 1][0]).toUpperCase();
};
