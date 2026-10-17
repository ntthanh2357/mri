import { useCallback, useEffect, useRef, useState } from 'react';
import { get, post, put } from '../services/api.service';

const POLL_MS = 30000; // dự án chưa có WebSocket: tự tải lại mỗi 30 giây

/** UC-PAT-03 — số thứ tự tiếp đón hôm nay của bệnh nhân. */
export function useQueueTicket() {
  const [state, setState] = useState({ loading: true, data: null, hospitals: [], error: null });
  const [hospitalId, setHospitalId] = useState(null); // chỉ dùng khi tài khoản chưa gắn bệnh viện
  const hospitalRef = useRef(null);
  hospitalRef.current = hospitalId;

  const load = useCallback(async () => {
    try {
      const q = hospitalRef.current ? `?hospitalId=${hospitalRef.current}` : '';
      const res = await get(`/api/v1/queue-tickets/me${q}`);
      let hospitals = [];
      if (res?.data?.needHospital) {
        const h = await get('/api/v1/queue-tickets/hospitals');
        hospitals = h?.data?.hospitals || [];
      }
      setState((s) => ({ loading: false, data: res?.data || null, hospitals: hospitals.length ? hospitals : s.hospitals, error: null }));
    } catch (err) {
      console.error('Lỗi tải số thứ tự:', err);
      setState((s) => ({ ...s, loading: false, error: 'Không tải được thông tin lấy số. Vui lòng thử lại.' }));
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => { if (hospitalId) load(); }, [hospitalId, load]);

  const act = useCallback(async (fn) => {
    try {
      const res = await fn();
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
