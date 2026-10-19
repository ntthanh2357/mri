import { useEffect, useState } from 'react';
import { get } from '../services/api.service';

/**
 * UC-NUR-03 — kết quả sàng lọc dị ứng/chống chỉ định gần nhất do điều dưỡng ghi, hiện trong bệnh án.
 * `error` khác với "chưa sàng lọc": nhân sự không được hiểu nhầm là bệnh nhân không có nguy cơ.
 */
export function usePatientPreScreening(patientId, refreshKey = 0) {
  const [state, setState] = useState({ loading: Boolean(patientId), latest: null, history: [], error: false });

  useEffect(() => {
    if (!patientId) { setState({ loading: false, latest: null, history: [], error: false }); return undefined; }
    let alive = true;
    get(`/api/v1/visits/pre-screening/latest?patientId=${encodeURIComponent(patientId)}`)
      .then((res) => { if (alive) setState({ loading: false, latest: res?.latest || null, history: res?.history || [], error: false }); })
      .catch((err) => {
        console.error('Lỗi tải sàng lọc dị ứng:', err);
        if (alive) setState({ loading: false, latest: null, history: [], error: true });
      });
    return () => { alive = false; };
  }, [patientId, refreshKey]);

  return state;
}
