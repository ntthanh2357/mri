import { useCallback, useEffect, useState } from 'react';
import { get, put } from '../services/api.service';

/** UC-PAT-13 — giờ nhắc uống thuốc theo 4 khung Sáng/Trưa/Chiều/Tối của bệnh nhân. */
export function useReminderSettings() {
  const [state, setState] = useState({ loading: true, times: null, defaults: null, error: null });

  const load = useCallback(async () => {
    try {
      const res = await get('/api/v1/patient/reminders/settings');
      setState({ loading: false, times: res?.data?.times || null, defaults: res?.data?.defaults || null, error: null });
    } catch (err) {
      console.error('Lỗi tải giờ nhắc uống thuốc:', err);
      setState((s) => ({ ...s, loading: false, error: 'Không tải được giờ nhắc.' }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (times) => {
    try {
      const res = await put('/api/v1/patient/reminders/settings', times);
      setState((s) => ({ ...s, times: res?.data?.times || times }));
      return { ok: true, message: res?.message || 'Đã lưu giờ nhắc.' };
    } catch (err) {
      return { ok: false, message: err?.message || 'Không lưu được giờ nhắc. Vui lòng thử lại.' };
    }
  }, []);

  return { ...state, reload: load, save };
}
