// Thông báo hẹn sẵn trên điện thoại (nhắc uống thuốc, nhắc lịch khám). Hàm thuần để test bằng node.
// Lập kế hoạch ở đây; services/localNotifications.js hẹn thật bằng expo-notifications (chỉ trên app điện thoại).

export const MAX_SCHEDULED = 30; // giới hạn số thông báo hẹn sẵn mỗi lần đồng bộ
export const APPOINTMENT_LEAD_MS = 2 * 3600 * 1000; // nhắc lịch khám trước 2 giờ
const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** "08:30" trên ngày của `base` → Date (giờ máy), hoặc null nếu chuỗi giờ không hợp lệ. */
export const atTime = (base, hhmm) => {
  const m = HHMM.exec(String(hhmm || '').trim());
  if (!m) return null;
  const d = new Date(base);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
};

/**
 * Nhắc uống thuốc hôm nay: chỉ liều chưa uống / chưa bỏ qua, giờ còn ở phía trước; các thuốc cùng giờ gom 1 thông báo.
 * `reminders`: dữ liệu /api/v1/patient/reminders/today ({ _id, time, drugName, dosageText, status }).
 */
export const reminderPlan = (reminders, now = new Date()) => {
  const byTime = new Map();
  for (const r of Array.isArray(reminders) ? reminders : []) {
    if (!r || r.status !== 'pending') continue;
    const date = atTime(now, r.time);
    if (!date || date <= now) continue;
    const key = r.time.padStart(5, '0');
    if (!byTime.has(key)) byTime.set(key, { date, drugs: [] });
    byTime.get(key).drugs.push(`${r.drugName}${r.dosageText ? ` (${r.dosageText})` : ''}`);
  }
  return [...byTime.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    // Không ghi tên thuốc: thông báo hiện cả trên màn khoá (tên thuốc có thể lộ bệnh, vd. thuốc điều trị ung thư)
    .map(([time, { date, drugs }]) => ({
      key: `med-${time.replace(':', '')}`,
      date,
      title: `Đến giờ uống thuốc ${time}`,
      body: `${drugs.length} loại thuốc. Mở ứng dụng để xem tên thuốc và liều.`,
    }));
};

const ACTIVE = ['đang chờ', 'chờ chụp', 'chờ chụp lại', 'chờ chụp sau phẫu thuật', 'tái khám định kỳ'];

/** Nhắc lịch khám / chụp có giờ hẹn trong tương lai: thông báo trước 2 giờ. `visits`: /api/v1/patient/records. */
export const appointmentPlan = (visits, now = new Date()) => (Array.isArray(visits) ? visits : [])
  .filter((v) => v && v.date && ACTIVE.includes(v.status))
  .map((v) => ({ v, at: new Date(v.date) }))
  .filter(({ at }) => !Number.isNaN(at.getTime()) && at.getTime() - APPOINTMENT_LEAD_MS > now.getTime())
  .map(({ v, at }) => ({
    key: `visit-${v._id}`,
    date: new Date(at.getTime() - APPOINTMENT_LEAD_MS),
    title: v.mriOrder?.region ? 'Sắp tới giờ chụp MRI' : 'Sắp tới giờ khám',
    body: `Bạn có lịch lúc ${at.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ngày ${at.toLocaleDateString('vi-VN')}. Hãy đến trước 30 phút.`,
  }));

/** Gộp, sắp theo giờ, giới hạn số lượng. */
export const buildPlan = (reminders, visits, now = new Date()) =>
  [...reminderPlan(reminders, now), ...appointmentPlan(visits, now)].sort((a, b) => a.date - b.date).slice(0, MAX_SCHEDULED);
