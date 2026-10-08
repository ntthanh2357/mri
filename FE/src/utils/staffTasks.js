// Trang chủ nhân viên — "Việc cần làm hôm nay".
// Hàm thuần (không gọi API, không import react-native) để test được bằng node.

export const SHIFT_LABELS = {
  'sáng': 'Ca sáng',
  'chiều': 'Ca chiều',
  'tối': 'Ca tối',
  'cả ngày': 'Cả ngày',
};

const DONE = ['hoàn tất', 'đã đóng', 'đã hủy'];
const SCAN_STATUSES = ['chờ chụp', 'chờ chụp lại', 'chờ chụp sau phẫu thuật', 'đang chụp'];
const countStatus = (visits, statuses) => visits.filter(v => statuses.includes(v.status)).length;
const task = (key, label, hint, count, route, params) => ({ key, label, hint, count, route, params });

/** Danh sách việc theo role; việc còn tồn (count > 0) lên trước, giữ thứ tự ưu tiên trong từng nhóm. */
export const buildStaffTasks = (role, { visits = [], emr = [], invoices = [] } = {}) => {
  let list = [];
  if (role === 'doctor') {
    list = [
      task('exam', 'Bệnh nhân chờ khám', 'Đã tiếp nhận, chưa bắt đầu khám', countStatus(visits, ['đang chờ', 'chờ khám bệnh']), 'DoctorWorkQueue', { tab: 'examQueue' }),
      task('examining', 'Đang khám, chưa kết thúc', 'Kê đơn hoặc ra y lệnh rồi kết thúc ca', countStatus(visits, ['đang khám']), 'DoctorWorkQueue', { tab: 'examQueue' }),
      task('read', 'Phim chờ đọc kết quả', 'Đã chụp xong, chờ bác sĩ kết luận', countStatus(visits, ['chờ bác sĩ đọc', 'chờ kết quả AI']), 'DoctorWorkQueue', { tab: 'mriQueue' }),
      task('scan', 'Ca chụp MRI đang xử lý', 'Chờ chụp hoặc đang chụp, bác sĩ có thể thao tác thay KTV', countStatus(visits, SCAN_STATUSES), 'DoctorWorkQueue', { tab: 'mriQueue' }),
      task('sign', 'Bệnh án chờ ký duyệt', 'Hồ sơ EMR chưa ký số', emr.filter(r => r.signStatus === 'Chưa duyệt').length, 'EMRDashboard', { tab: 'records' }),
    ];
  } else if (role === 'technician') {
    list = [
      task('scan', 'Ca chờ chụp MRI', 'Kiểm tra an toàn rồi đưa vào buồng chụp', countStatus(visits, SCAN_STATUSES.filter(x => x !== 'đang chụp')), 'DoctorWorkQueue', { tab: 'mriQueue' }),
      task('upload', 'Đang chụp, chưa nộp phim', 'Tải ảnh phim lên để AI phân tích', countStatus(visits, ['đang chụp']), 'DoctorWorkQueue', { tab: 'mriQueue' }),
    ];
  } else if (role === 'nurse') {
    list = [
      task('vitals', 'Chờ đo sinh hiệu', 'Bệnh nhân đã tiếp nhận, chưa có sinh hiệu', countStatus(visits, ['đang chờ']), 'DoctorWorkQueue', { tab: 'examQueue' }),
      task('inpatient', 'Bệnh nhân nội trú cần theo dõi', 'Ghi phiếu chăm sóc trong ca', emr.filter(r => r.admissionType === 'Nội trú').length, 'EMRDashboard', { tab: 'care' }),
    ];
  } else if (role === 'receptionist') {
    list = [
      task('billing', 'Hóa đơn chờ thu', 'Thu tiền mặt, PayOS hoặc áp dụng BHYT', invoices.filter(i => i.status === 'chờ thanh toán').length, 'NurseReception', { tab: 'billing' }),
      task('today', 'Lượt tiếp đón hôm nay', 'Lượt khám đã tạo trong ngày', visits.length, 'NurseReception', { tab: 'myQueue' }),
    ];
  }
  return [...list.filter(t => t.count > 0), ...list.filter(t => t.count === 0)];
};

const NEXT_STATUSES = {
  doctor: ['đang chờ', 'chờ khám bệnh', 'đang khám', 'chờ bác sĩ đọc', 'chờ kết quả AI', ...SCAN_STATUSES],
  technician: SCAN_STATUSES,
  nurse: ['đang chờ'],
};

/** Các ca tiếp theo cần xử lý của role (role khác: mọi ca chưa xong); ca cấp cứu lên đầu. */
export const nextUpVisits = (role, visits = [], limit = 5) => {
  const statuses = NEXT_STATUSES[role];
  const list = visits.filter(v => (statuses ? statuses.includes(v.status) : !DONE.includes(v.status)));
  return [...list]
    .sort((a, b) => (b.priority === 'khẩn cấp') - (a.priority === 'khẩn cấp'))
    .slice(0, limit);
};
