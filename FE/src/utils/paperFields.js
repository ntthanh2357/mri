/**
 * Giấy tờ y tế (giấy ra viện, giấy chuyển tuyến, đơn thuốc) KHÔNG được điền dữ liệu giả (IT1-05).
 * Thiếu dữ liệu → in dòng chấm để điền tay / đóng dấu; trên màn hình thông tin → "—".
 */
export const PAPER_BLANK = '..................................';
export const SHORT_BLANK = '............';

export const isEmpty = (v) => v === undefined || v === null || String(v).trim() === '' || v === 'N/A';
export const orBlank = (v, blank = PAPER_BLANK) => (isEmpty(v) ? blank : v);
export const orDash = (v) => (isEmpty(v) ? '—' : v);

const validDate = (d) => {
  const t = d ? new Date(d) : null;
  return t && !Number.isNaN(t.getTime()) ? t : null;
};

/** "12 tháng 3 năm 2026" hoặc dòng chấm khi không có ngày thật */
export const dayMonthYear = (d) => {
  const t = validDate(d);
  return t ? `${t.getDate()} tháng ${t.getMonth() + 1} năm ${t.getFullYear()}` : '........ tháng ........ năm ..............';
};

/** Ngày giờ đầy đủ hoặc dòng chấm khi không có thời điểm thật */
export const dateTimeOrBlank = (d) => {
  const t = validDate(d);
  return t ? t.toLocaleString('vi-VN') : '...... giờ ...... phút, ngày ...... / ...... / ............';
};

/** Ngày (dd/mm/yyyy) hoặc nhãn thay thế khi không có ngày thật */
export const dateOr = (d, fallback = '—') => {
  const t = validDate(d);
  return t ? t.toLocaleDateString('vi-VN') : fallback;
};
