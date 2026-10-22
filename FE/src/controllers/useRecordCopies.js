import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { get, post, put } from '../services/api.service';
import Config from '../constants/config';

const BASE = '/api/v1/patient/record-copies';

/** Bệnh nhân xin bản sao bệnh án: gửi yêu cầu, theo dõi trạng thái, huỷ, tải PDF khi bệnh viện đã duyệt. */
export function useRecordCopies() {
  const [state, setState] = useState({ loading: true, requests: [], error: null });
  const [busyId, setBusyId] = useState(null); // yêu cầu đang huỷ / tải; 'new' = đang gửi yêu cầu mới

  const load = useCallback(async () => {
    try {
      const res = await get(BASE);
      setState({ loading: false, requests: res?.data || [], error: null });
    } catch (err) {
      console.error('Lỗi tải yêu cầu bản sao:', err);
      setState((s) => ({ ...s, loading: false, error: 'Không tải được danh sách yêu cầu. Vui lòng thử lại.' }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = useCallback(async (id, fn, fallback) => {
    setBusyId(id);
    try {
      const res = await fn();
      await load();
      return { ok: true, message: res?.message, data: res?.data };
    } catch (err) {
      return { ok: false, message: err?.message || fallback };
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const create = useCallback(({ sections, reason }) =>
    run('new', () => post(BASE, { sections, reason }), 'Không gửi được yêu cầu. Vui lòng thử lại.'), [run]);

  const cancel = useCallback((id) =>
    run(id, () => put(`${BASE}/${id}/cancel`, {}), 'Không huỷ được yêu cầu. Vui lòng thử lại.'), [run]);

  /** Lấy link tải ngắn hạn rồi mở: web tải thẳng (file trả về dạng tải xuống), điện thoại mở bằng trình duyệt. */
  const download = useCallback(async (id) => {
    setBusyId(id);
    try {
      const res = await post(`${BASE}/${id}/download`, {});
      const url = res?.data?.pdfPath ? `${Config.API_URL}${res.data.pdfPath}` : null;
      if (!url) return { ok: false, message: 'Chưa lấy được file bản sao. Vui lòng thử lại.' };
      if (Platform.OS === 'web') window.location.assign(url);
      else await Linking.openURL(url);
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err?.message || 'Chưa tải được bản sao. Vui lòng thử lại.' };
    } finally {
      setBusyId(null);
    }
  }, []);

  return { ...state, busyId, create, cancel, download, reload: load };
}
