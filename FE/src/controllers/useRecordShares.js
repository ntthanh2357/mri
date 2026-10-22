import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { get, post, del } from '../services/api.service';
import Config from '../constants/config';
import { buildShareUrl, shareOrigin } from '../utils/recordShare';

const POLL_MS = 10000; // chưa có WebSocket: tải lại để thấy ai vừa quét mã

// Địa chỉ trang web công khai để đưa vào QR (người quét mở bằng trình duyệt)
const webOrigin = () => shareOrigin({
  webUrl: process.env.EXPO_PUBLIC_WEB_URL,
  location: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location : null,
  lanIp: process.env.EXPO_PUBLIC_LAN_IP, // update-ip.js ghi vào .env.local mỗi lần npm start/web
  apiUrl: Config.API_URL,
});

/** UC-PAT-09 — bệnh nhân tạo mã QR chia sẻ bệnh án (5 phút), xem ai đang xem, thu hồi. */
export function useRecordShares() {
  const [state, setState] = useState({ loading: true, shares: [], error: null });
  const [qr, setQr] = useState(null); // { shareId, url, expiresAt, sections, documentCount, itemCounts }

  const load = useCallback(async () => {
    try {
      const res = await get('/api/v1/patient/record-shares');
      setState({ loading: false, shares: res?.data || [], error: null });
    } catch (err) {
      console.error('Lỗi tải danh sách chia sẻ:', err);
      setState((s) => ({ ...s, loading: false, error: 'Không tải được danh sách chia sẻ.' }));
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  /** `payload` { sections, items }: nhóm được chia sẻ và các mục chọn riêng trong từng nhóm (utils/shareCatalog: sharePayload). */
  const create = useCallback(async (payload) => {
    try {
      const res = await post('/api/v1/patient/record-shares', { sections: payload.sections, items: payload.items });
      const d = res?.data;
      setQr({ shareId: d.shareId, url: buildShareUrl(webOrigin(), d.qrToken), expiresAt: d.qrExpiresAt, sections: d.sections, documentCount: d.documentCount, itemCounts: d.itemCounts });
      await load();
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err?.message || 'Không tạo được mã QR. Vui lòng thử lại.' };
    }
  }, [load]);

  const revoke = useCallback(async (shareId) => {
    try {
      await del(`/api/v1/patient/record-shares/${shareId}`);
      setQr((q) => (q?.shareId === shareId ? null : q));
      await load();
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err?.message || 'Không dừng chia sẻ được. Vui lòng thử lại.' };
    }
  }, [load]);

  return { ...state, qr, clearQr: () => setQr(null), create, revoke, reload: load };
}
