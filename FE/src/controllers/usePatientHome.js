import { useCallback, useEffect, useState } from 'react';
import { get, put } from '../services/api.service';
import { consentStatus } from '../utils/signature';

/**
 * Dữ liệu trang chủ bệnh nhân: phim gần nhất, số lượt khám, lịch uống thuốc hôm nay.
 * Mỗi nguồn tải độc lập — một API lỗi không làm trống cả trang.
 */
export function usePatientHome() {
  const [imaging, setImaging] = useState({ loading: true, latest: null, total: 0 });
  const [visitCount, setVisitCount] = useState(0);
  const [reminders, setReminders] = useState({ loading: true, items: [] });
  const [consentsToDo, setConsentsToDo] = useState(0);

  const loadReminders = useCallback(async () => {
    try {
      const res = await get('/api/v1/patient/reminders/today');
      setReminders({ loading: false, items: res?.success ? res.data || [] : [] });
    } catch (err) {
      console.error('Lỗi tải lịch uống thuốc hôm nay:', err);
      setReminders({ loading: false, items: [] });
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await get('/api/v1/imaging/my-results');
        const list = res?.success && Array.isArray(res.data) ? res.data : [];
        setImaging({ loading: false, latest: list[0] || null, total: list.length });
      } catch (err) {
        console.error('Lỗi tải kết quả phim:', err);
        setImaging({ loading: false, latest: null, total: 0 });
      }
    })();
    (async () => {
      try {
        const res = await get('/api/v1/patient/records');
        setVisitCount(Array.isArray(res?.data) ? res.data.length : 0);
      } catch (err) {
        console.error('Lỗi tải lịch sử khám:', err);
      }
    })();
    (async () => {
      try {
        // UC-PAT-06: phiếu đồng thuận cản quang bệnh nhân còn phải trả lời sàng lọc hoặc ký
        const res = await get('/api/v1/patient/consents');
        const items = res?.data?.items || [];
        setConsentsToDo(items.filter((c) => ['checklist', 'ready'].includes(consentStatus(c)?.key)).length);
      } catch (err) {
        console.error('Lỗi tải phiếu đồng thuận:', err);
      }
    })();
    loadReminders();
  }, [loadReminders]);

  const markReminderDone = useCallback(async (id) => {
    // Cập nhật lạc quan để nút phản hồi ngay, rồi đồng bộ lại với server.
    setReminders((prev) => ({ ...prev, items: prev.items.map((r) => (r._id === id ? { ...r, status: 'done' } : r)) }));
    try {
      await put(`/api/v1/patient/reminders/${id}/done`, {});
    } catch (err) {
      console.error('Lỗi đánh dấu đã uống thuốc:', err);
    }
    loadReminders();
  }, [loadReminders]);

  const doneCount = reminders.items.filter((r) => r.status === 'done').length;

  return { imaging, visitCount, reminders, doneCount, markReminderDone, consentsToDo };
}
