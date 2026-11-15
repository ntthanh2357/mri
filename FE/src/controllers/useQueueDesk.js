import { useCallback, useEffect, useRef, useState } from 'react';
import { get, post, put } from '../services/api.service';
import { notifyQueueChanged, subscribeQueueSync } from '../utils/queueSync';

const POLL_MS = 5000; // đồng bộ dự phòng nhanh (kết hợp SSE + focus + tab sync)

/** UC-PAT-03 — quầy tiếp đón: danh sách số hôm nay, gọi số, đánh dấu có mặt/vắng/tiếp nhận. */
export function useQueueDesk({ onSync } = {}) {
  const [state, setState] = useState({ loading: true, tickets: [], current: 0, nextNumber: null, settings: null, error: null });
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }
    inFlightRef.current = true;
    try {
      const res = await get('/api/v1/queue-tickets/today');
      if (!mountedRef.current) return;
      setState({ loading: false, tickets: res?.data?.tickets || [], current: res?.data?.current || 0, nextNumber: res?.data?.nextNumber || null, settings: res?.data?.settings || null, error: null });
    } catch (err) {
      console.error('Lỗi tải danh sách số thứ tự:', err);
      if (!mountedRef.current) return;
      setState((s) => ({ ...s, loading: false, error: 'Không tải được danh sách số.' }));
    } finally {
      inFlightRef.current = false;
      if (queuedRef.current && mountedRef.current) {
        queuedRef.current = false;
        load();
      }
    }
  }, []);

  useEffect(() => {
    load();
    return subscribeQueueSync({
      pollMs: POLL_MS,
      onSync: () => {
        load();
        if (typeof onSyncRef.current === 'function') onSyncRef.current();
      },
    });
  }, [load]);

  const act = useCallback(async (fn) => {
    try {
      const res = await fn();
      notifyQueueChanged('desk.updated');
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
