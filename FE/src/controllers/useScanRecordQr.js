import { useCallback, useRef, useState } from 'react';
import { post } from '../services/api.service';
import { parseShareQr } from '../utils/recordShare';

/**
 * UC-PAT-09 (mở rộng) — Nhân viên quét mã QR chia sẻ bệnh án ngay trong app.
 * Mã được đổi lấy vé xem qua API có đăng nhập, nên bệnh nhân thấy tên người đã mở.
 */
export function useScanRecordQr(navigation) {
  const [state, setState] = useState({ busy: false, error: null });
  const busy = useRef(false); // camera đọc liên tục: chặn gửi trùng trong lúc đang mở

  /** `text`: chữ đọc từ mã QR hoặc liên kết người dùng dán vào. Trả true nếu đã mở được bệnh án. */
  const open = useCallback(async (text) => {
    if (busy.current) return false;
    const qrToken = parseShareQr(text);
    if (!qrToken) {
      setState({ busy: false, error: 'Đây không phải mã chia sẻ bệnh án của NeuroScan. Hãy quét mã trên màn hình "Chia sẻ bệnh án" của bệnh nhân.' });
      return false;
    }
    busy.current = true;
    setState({ busy: true, error: null });
    try {
      const res = await post('/api/v1/shared-records/redeem-staff', { qrToken });
      setState({ busy: false, error: null });
      navigation.navigate('SharedRecord', { v: res?.data?.viewerToken });
      return true;
    } catch (err) {
      setState({ busy: false, error: err?.message || 'Không mở được bệnh án. Vui lòng thử lại.' });
      return false;
    } finally {
      busy.current = false;
    }
  }, [navigation]);

  const fail = useCallback((message) => setState({ busy: false, error: message }), []);

  return { ...state, open, fail };
}
