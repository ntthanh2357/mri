import { useEffect, useState } from 'react';
import { get } from '../services/api.service';

/**
 * Dị ứng thuốc + người liên hệ khẩn cấp do bệnh nhân tự khai (UC-PAT-02), cho màn của bác sĩ/điều dưỡng.
 * BE kiểm tra quyền theo bệnh viện (checkPatientTenancy) và chỉ trả số thẻ/CCCD dạng che.
 */
export function usePatientSafety(patientId) {
  const [state, setState] = useState({ loading: Boolean(patientId), data: null, error: false });

  useEffect(() => {
    if (!patientId) { setState({ loading: false, data: null, error: false }); return undefined; }
    let alive = true;
    setState({ loading: true, data: null, error: false });
    get(`/api/v1/patient/profile/identity?patientId=${encodeURIComponent(patientId)}`)
      .then((res) => { if (alive) setState({ loading: false, data: res?.data || null, error: false }); })
      .catch((err) => {
        console.error('Lỗi tải dị ứng/liên hệ khẩn cấp:', err);
        if (alive) setState({ loading: false, data: null, error: true });
      });
    return () => { alive = false; };
  }, [patientId]);

  return state;
}
