// Xin bản sao bệnh án — nhãn và trạng thái dùng chung cho màn bệnh nhân và màn bệnh viện duyệt.
// Hàm thuần (không import react-native) để test bằng node.

/** Phần bệnh án bệnh viện cấp bản sao được (khớp COPY_SECTIONS phía máy chủ). */
export const COPY_SECTIONS = [
  { key: 'visits', label: 'Lịch sử khám', icon: 'clipboard' },
  { key: 'imaging', label: 'Kết quả phim MRI/CT', icon: 'film' },
  { key: 'prescriptions', label: 'Đơn thuốc', icon: 'package' },
  { key: 'labs', label: 'Kết quả xét nghiệm', icon: 'droplet' },
  { key: 'vitals', label: 'Sinh hiệu', icon: 'activity' },
  { key: 'inpatient', label: 'Bệnh án nội trú', icon: 'folder' },
  { key: 'papers', label: 'Giấy ra viện, chuyển viện', icon: 'file-text' },
];
export const COPY_REASON_MAX = 500;

export const copySectionsText = (keys = []) =>
  COPY_SECTIONS.filter((s) => keys.includes(s.key)).map((s) => s.label).join(', ') || 'Không rõ';

/** tone: màu nền/chữ của nhãn trạng thái (warning/success/error/muted). */
export const copyStatus = (status) => ({
  pending: { label: 'Chờ duyệt', tone: 'warning', icon: 'clock' },
  approved: { label: 'Đã duyệt', tone: 'success', icon: 'check-circle' },
  rejected: { label: 'Bị từ chối', tone: 'error', icon: 'x-circle' },
  cancelled: { label: 'Đã huỷ', tone: 'muted', icon: 'slash' },
}[status] || { label: 'Không rõ', tone: 'muted', icon: 'help-circle' });

/** Lỗi nhập trên form gửi yêu cầu (null = hợp lệ). */
export const copyFormError = ({ sections = [], reason = '' } = {}) => {
  if (!sections.length) return 'Hãy chọn ít nhất 1 phần bệnh án cần sao.';
  if (reason.trim().length > COPY_REASON_MAX) return `Lý do tối đa ${COPY_REASON_MAX} ký tự.`;
  return null;
};
