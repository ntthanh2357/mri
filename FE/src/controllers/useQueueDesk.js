import { useCallback, useEffect, useState } from 'react';
import { get, post, put } from '../services/api.service';

const POLL_MS = 20000; // chưa có WebSocket: tự tải lại để thấy số bệnh nhân vừa lấy

/** UC-PAT-03 — quầy tiếp đón: danh sách số hôm nay, gọi số, đánh dấu có mặt/vắng/tiếp nhận. */
export function useQueueDesk() {
  const [state, setState] = useState({ loading: true, tickets: [], current: 0, nextNumber: null, settings: null, error: null });

  const load = useCallback(async () => {
    try {
      const res = await get('/api/v1/queue-tickets/today');
      setState({ loading: false, tickets: res?.data?.tickets || [], current: res?.data?.current || 0, nextNumber: res?.data?.nextNumber || null, settings: res?.data?.settings || null, error: null });
    } catch (err) {
      console.error('Lỗi tải danh sách số thứ tự:', err);
      setState((s) => ({ ...s, loading: false, error: 'Không tải được danh sách số.' }));
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const act = useCallback(async (fn) => {
    try {
      const res = await fn();
      await load();
      return { ok: true, message: res?.message, ticket: res?.data };
    } catch (err) {
      await load();
      return { ok: false, message: err?.message || 'Không thực hiện được.' };
    }
  }, [load]);

  return {
    ...state,
    reload: load,
    callNext: () => act(() => post('/api/v1/queue-tickets/call-next', {})),
    markArrived: (id) => act(() => put(`/api/v1/queue-tickets/${id}/arrived`, {})),
    markMissed: (id) => act(() => put(`/api/v1/queue-tickets/${id}/missed`, {})),
    markServed: (id) => act(() => put(`/api/v1/queue-tickets/${id}/served`, {})),
    saveSettings: (avgServeMinutes) => act(() => put('/api/v1/queue-tickets/settings', { avgServeMinutes })),
  };
}
