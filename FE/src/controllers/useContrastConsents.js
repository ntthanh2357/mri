import { useCallback, useEffect, useState } from 'react';
import { get, put } from '../services/api.service';

/** UC-PAT-06 — phiếu đồng thuận tiêm cản quang của bệnh nhân: tải, trả lời sàng lọc, ký. */
export function useContrastConsents() {
  const [state, setState] = useState({ loading: true, items: [], savedSignature: null, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await get('/api/v1/patient/consents');
      setState({ loading: false, items: res?.data?.items || [], savedSignature: res?.data?.savedSignature || null, error: null });
    } catch (err) {
      console.error('Lỗi tải phiếu đồng thuận:', err);
      setState((s) => ({ ...s, loading: false, error: 'Không tải được phiếu đồng thuận. Vui lòng thử lại.' }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Trả { ok, message } để màn hiện thông báo ngay tại bước đang làm
  const run = useCallback(async (path, body) => {
    try {
      const res = await put(path, body);
      await load();
      return { ok: true, message: res?.message || 'Đã lưu.' };
    } catch (err) {
      return { ok: false, message: err?.message || 'Không thực hiện được. Vui lòng thử lại.' };
    }
  }, [load]);

  const submitChecklist = useCallback((id, answers) => run(`/api/v1/patient/consents/${id}/checklist`, answers), [run]);
  const sign = useCallback((id, payload) => run(`/api/v1/patient/consents/${id}/sign`, payload), [run]);

  return { ...state, reload: load, submitChecklist, sign };
}
