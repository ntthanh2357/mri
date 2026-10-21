import { useEffect, useRef } from 'react';
import { get, getToken } from '../services/api.service';
import { syncScheduled } from '../services/localNotifications';
import { buildPlan } from '../utils/notificationPlan';

/**
 * Hẹn sẵn thông báo trên điện thoại cho các liều thuốc còn lại hôm nay và lịch khám sắp tới.
 * Chạy lại mỗi khi danh sách nhắc thuốc hôm nay thay đổi (vd. vừa bấm "Đã uống"). Web: không làm gì.
 */
export function useLocalReminderSync(reminders, ready) {
  const lastKey = useRef('');

  useEffect(() => {
    if (!ready) return;
    const key = JSON.stringify((reminders || []).map((r) => [r._id, r.time, r.status]));
    if (key === lastKey.current) return;
    lastKey.current = key;
    (async () => {
      try {
        const visits = await get('/api/v1/patient/records').then((res) => (Array.isArray(res?.data) ? res.data : [])).catch(() => []);
        if (!(await getToken())) return; // vừa đăng xuất / hết phiên trong lúc đang tải: không hẹn lại
        await syncScheduled(buildPlan(reminders, visits));
      } catch (err) {
        console.warn('Không hẹn được thông báo nhắc:', err?.message);
      }
    })();
  }, [reminders, ready]);
}
