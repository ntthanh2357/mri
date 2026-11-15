import { useCallback, useEffect, useRef, useState } from 'react';
import { get, post, put } from '../services/api.service';
import { notifyQueueChanged, subscribeQueueSync } from '../utils/queueSync';

const POLL_MS = 8000; // đồng bộ dự phòng (kết hợp SSE + focus + tab sync)

/** UC-PAT-03 — số thứ tự tiếp đón hôm nay của bệnh nhân. */
export function useQueueTicket() {
  const [state, setState] = useState({ loading: true, data: null, hospitals: [], error: null });
  const [hospitalId, setHospitalId] = useState(null); // chỉ dùng khi tài khoản chưa gắn bệnh viện
  const hospitalRef = useRef(null);
  hospitalRef.current = hospitalId;
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);

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
      const q = hospitalRef.current ? `?hospitalId=${hospitalRef.current}` : '';
      const res = await get(`/api/v1/queue-tickets/me${q}`);
      let hospitals = [];
      if (res?.data?.needHospital) {
        const h = await get('/api/v1/queue-tickets/hospitals');
        hospitals = h?.data?.hospitals || [];
      }
      if (!mountedRef.current) return;
      setState((s) => ({ loading: false, data: res?.data || null, hospitals: hospitals.length ? hospitals : s.hospitals, error: null }));
    } catch (err) {
      console.error('Lỗi tải số thứ tự:', err);
      if (!mountedRef.current) return;
      setState((s) => ({ ...s, loading: false, error: 'Không tải được thông tin lấy số. Vui lòng thử lại.' }));
    } finally {
      inFlightRef.current = false;
      if (queuedRef.current && mountedRef.current) {
        queuedRef.current = false;
        load();
      }
    }
  }, []);

  const needHospital = Boolean(state.data?.needHospital && !hospitalId);

  useEffect(() => {
    load();
    const q = hospitalId ? `?hospitalId=${hospitalId}` : '';
    return subscribeQueueSync({
      query: q,
      pollMs: POLL_MS,
      streamEnabled: !needHospital,
      onSync: load,
    });
  }, [load, hospitalId, needHospital]);

  const act = useCallback(async (fn) => {
    try {
      const res = await fn();
      notifyQueueChanged('ticket.updated');
      await load();
      return { ok: true, message: res?.message };
    } catch (err) {
      return { ok: false, message: err?.message || 'Không thực hiện được. Vui lòng thử lại.' };
    }
  }, [load]);

  const take = useCallback(() => act(() => post('/api/v1/queue-tickets', hospitalRef.current ? { hospitalId: hospitalRef.current } : {})), [act]);
  const cancel = useCallback(() => act(() => put(`/api/v1/queue-tickets/me/cancel${hospitalRef.current ? `?hospitalId=${hospitalRef.current}` : ''}`, {})), [act]);

  return { ...state, reload: load, take, cancel, hospitalId, setHospitalId };
}
