import { useCallback, useEffect, useState } from 'react';
import { get } from '../services/api.service';

/** Hóa đơn viện phí của bệnh nhân (chỉ xem; thanh toán tại quầy thu ngân). */
export function usePatientInvoices() {
  const [state, setState] = useState({ loading: true, invoices: [], unpaidTotal: 0, error: null });

  const load = useCallback(async () => {
    try {
      const res = await get('/api/v1/patient/invoices');
      setState({ loading: false, invoices: res?.data?.invoices || [], unpaidTotal: res?.data?.unpaidTotal || 0, error: null });
    } catch (err) {
      console.error('Lỗi tải hóa đơn:', err);
      setState((s) => ({ ...s, loading: false, error: 'Không tải được hóa đơn. Vui lòng thử lại.' }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { ...state, reload: load };
}
