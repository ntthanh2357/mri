import { useCallback, useEffect, useState } from 'react';
import { get, put } from '../services/api.service';

const BASE = '/api/v1/record-copies';

/** Lễ tân / quản lý bệnh viện duyệt yêu cầu bản sao bệnh án. `status`: pending | approved | rejected | all. */
export function useRecordCopyReview(status = 'pending') {
  const [state, setState] = useState({ loading: true, requests: [], error: null });
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await get(status === 'all' ? BASE : `${BASE}?status=${status}`);
      setState({ loading: false, requests: res?.data || [], error: null });
    } catch (err) {
      console.error('Lỗi tải yêu cầu bản sao:', err);
      setState((s) => ({ ...s, loading: false, error: 'Không tải được danh sách yêu cầu. Vui lòng thử lại.' }));
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const act = useCallback(async (id, path, body, fallback) => {
    setBusyId(id);
    try {
      const res = await put(`${BASE}/${id}/${path}`, body);
      await load();
      return { ok: true, message: res?.message };
    } catch (err) {
      await load(); // người khác vừa xử lý (409) thì danh sách cần cập nhật
      return { ok: false, message: err?.message || fallback };
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const approve = useCallback((id) => act(id, 'approve', {}, 'Không duyệt được yêu cầu. Vui lòng thử lại.'), [act]);
  const reject = useCallback((id, reason) => act(id, 'reject', { reason }, 'Không từ chối được yêu cầu. Vui lòng thử lại.'), [act]);

  return { ...state, busyId, approve, reject, reload: load };
}
