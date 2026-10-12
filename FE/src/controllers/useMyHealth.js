import { useCallback, useEffect, useState } from 'react';
import { get, put } from '../services/api.service';

const EMPTY = { loading: true, items: [], error: null };

/**
 * "Sức khỏe của tôi": sinh hiệu, phiếu xét nghiệm, đơn thuốc của chính bệnh nhân.
 * BE chỉ cho bệnh nhân đọc hồ sơ có patientId = id của mình (checkSelfOrRoles).
 * Mỗi nguồn tải độc lập — một API lỗi không làm trống cả trang.
 */
export function useMyHealth() {
  const [vitals, setVitals] = useState(EMPTY);
  const [labs, setLabs] = useState(EMPTY);
  const [prescriptions, setPrescriptions] = useState(EMPTY);

  const load = useCallback(async () => {
    setVitals(EMPTY); setLabs(EMPTY); setPrescriptions(EMPTY);
    let userId;
    try {
      const me = await get('/auth/me');
      userId = me?.user?._id || me?.user?.id;
    } catch (err) {
      console.error('Lỗi lấy thông tin tài khoản:', err);
    }
    const fail = { loading: false, items: [], error: 'Không tải được dữ liệu. Vui lòng thử lại.' };
    if (!userId) { setVitals(fail); setLabs(fail); setPrescriptions(fail); return; }

    const fetchInto = async (path, setter) => {
      try {
        const res = await get(`/api/patients/${userId}/${path}`);
        setter({ loading: false, items: res?.success && Array.isArray(res.data) ? res.data : [], error: null });
      } catch (err) {
        console.error(`Lỗi tải ${path}:`, err);
        setter(fail);
      }
    };
    await Promise.all([
      fetchInto('vitals', setVitals),
      fetchInto('lab-orders', setLabs),
      fetchInto('prescriptions', setPrescriptions),
    ]);
  }, []);

  useEffect(() => { load(); }, [load]);

  // UC-PAT-02 — hồ sơ & BHYT tự khai (BE mã hoá CCCD/số thẻ, chỉ trả dạng che)
  const [identity, setIdentity] = useState({ loading: true, data: null, error: null });
  const loadIdentity = useCallback(async () => {
    setIdentity((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await get('/api/v1/patient/profile/identity');
      setIdentity({ loading: false, data: res?.data || null, error: null });
    } catch (err) {
      console.error('Lỗi tải hồ sơ cá nhân:', err);
      setIdentity({ loading: false, data: null, error: 'Không tải được hồ sơ. Vui lòng thử lại.' });
    }
  }, []);
  useEffect(() => { loadIdentity(); }, [loadIdentity]);

  /** Lưu thay đổi; trả về { ok, message } để màn hiển thị lỗi định dạng ngay dưới form. */
  const saveIdentity = useCallback(async (payload) => {
    try {
      const res = await put('/api/v1/patient/profile/identity', payload);
      setIdentity({ loading: false, data: res?.data || null, error: null });
      return { ok: true, message: res?.message || 'Đã lưu thông tin.' };
    } catch (err) {
      return { ok: false, message: err?.message || 'Không lưu được thông tin. Vui lòng thử lại.' };
    }
  }, []);

  return { vitals, labs, prescriptions, reload: load, identity, reloadIdentity: loadIdentity, saveIdentity };
}
