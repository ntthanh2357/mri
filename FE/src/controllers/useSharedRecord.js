import { useEffect, useState } from 'react';
import { post } from '../services/api.service';

/**
 * UC-PAT-09 — Trang xem bệnh án qua QR (công khai).
 * ?q=<mã QR, sống 5 phút> → đổi lấy vé xem → URL chuyển sang ?v=<vé xem> (lưu dấu trang/tải lại vẫn xem được).
 */
export function useSharedRecord(route, navigation) {
  const q = route?.params?.q;
  const v = route?.params?.v;
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let alive = true;
    (async () => {
      setState({ loading: true, data: null, error: null });
      try {
        let viewerToken = v;
        if (!viewerToken && q) {
          const r = await post('/api/v1/shared-records/redeem', { qrToken: q });
          viewerToken = r?.data?.viewerToken;
          // Đổi URL sang vé xem, bỏ mã QR (mã QR sẽ hết hạn sau 5 phút)
          navigation.setParams({ q: undefined, v: viewerToken });
          return; // effect chạy lại với ?v=
        }
        if (!viewerToken) throw new Error('Liên kết không hợp lệ. Hãy quét lại mã QR của bệnh nhân.');
        const res = await post('/api/v1/shared-records/view', { viewerToken });
        if (alive) setState({ loading: false, data: res?.data || null, error: null });
      } catch (err) {
        if (alive) setState({ loading: false, data: null, error: err?.message || 'Không mở được bệnh án.' });
      }
    })();
    return () => { alive = false; };
  }, [q, v, navigation]);

  return state;
}
