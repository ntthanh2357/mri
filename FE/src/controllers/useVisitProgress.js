import { useCallback, useEffect, useState } from 'react';
import { get } from '../services/api.service';

const POLL_MS = 30000; // dự án chưa có WebSocket: tự tải lại mỗi 30 giây

/** UC-PAT-05 — tiến trình lượt khám đang diễn ra của bệnh nhân (null nếu hôm nay không có lượt khám nào). */
export function useVisitProgress() {
  const [state, setState] = useState({ loading: true, progress: null, error: null });

  const load = useCallback(async () => {
    try {
      const res = await get('/api/v1/patient/visit-progress');
      setState({ loading: false, progress: res?.data || null, error: null });
    } catch (err) {
      console.error('Lỗi tải tình trạng lượt khám:', err);
      setState((s) => ({ ...s, loading: false, error: 'Không tải được tình trạng lượt khám.' }));
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  return { ...state, reload: load };
}
