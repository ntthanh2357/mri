import { useCallback, useEffect, useState } from 'react';
import { get, put } from '../services/api.service';

/** Chuẩn bị chụp MRI: hướng dẫn + phiếu sàng lọc an toàn bệnh nhân tự khai (null nếu không có lịch chụp nào chờ). */
export function useMriPrep() {
  const [state, setState] = useState({ loading: true, prep: null, error: null });

  const load = useCallback(async () => {
    try {
      const res = await get('/api/v1/patient/mri-prep');
      setState({ loading: false, prep: res?.data || null, error: null });
    } catch (err) {
      console.error('Lỗi tải hướng dẫn chụp MRI:', err);
      setState((s) => ({ ...s, loading: false, error: 'Không tải được thông tin chuẩn bị chụp MRI.' }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /** Lưu phiếu sàng lọc. Trả { ok, level } hoặc { ok: false, message }. */
  const saveScreening = useCallback(async (visitId, answers, details) => {
    try {
      const res = await put(`/api/v1/patient/mri-prep/${visitId}/screening`, { answers, details });
      await load();
      return { ok: true, level: res?.data?.level };
    } catch (err) {
      return { ok: false, message: err?.message || 'Không lưu được phiếu sàng lọc. Vui lòng thử lại.' };
    }
  }, [load]);

  return { ...state, reload: load, saveScreening };
}
