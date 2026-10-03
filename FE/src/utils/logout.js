/**
 * ============================================================================
 * LOGOUT TRUNG TÂM — NeuroScan AI
 * ============================================================================
 * Quy trình đăng xuất CHUẨN cho cả 2 cổng (Bệnh nhân / và Nội bộ /staff):
 *   1. Thông báo Backend hủy phiên (POST /auth/logout) để:
 *      - Xóa cookie HttpOnly refreshToken khỏi trình duyệt (FE không tự
 *        xóa được cookie HttpOnly bằng JS).
 *      - BE ghi nhận sự kiện đóng phiên.
 *      Best-effort: nếu BE không phản hồi / token đã hết hạn, vẫn tiếp tục
 *      bước 2 — local logout KHÔNG BAO GIỜ được phép thất bại.
 *   2. Xóa access token + refresh token khỏi localStorage (web) và
 *      AsyncStorage (native).
 *
 * Sau performLogout(), caller tự điều hướng về màn đăng nhập của cổng hiện tại
 * (xem portalLoginRoute() trong navigationRef.js).
 */
import { Platform } from 'react-native';
import Config from '../constants/config.js';
import { setAuthToken, getRefreshToken } from '../api/client.js';

/**
 * Chốt chặn gọi trùng: RN Web có thể kích hoạt onPress nhiều lần từ một chuỗi
 * sự kiện (pointerup + click) hoặc người dùng double-click nút Đăng xuất.
 * Các lời gọi trùng lặp trong 2 giây chia sẻ chung một promise — BE chỉ nhận
 * đúng 1 request /auth/logout, tránh trạng thái đua nhau khi dọn token.
 */
let lastLogoutPromise = null;
let lastLogoutAt = 0;
const LOGOUT_DEDUPE_MS = 2000;

export const performLogout = () => {
  const now = Date.now();
  if (lastLogoutPromise && now - lastLogoutAt < LOGOUT_DEDUPE_MS) {
    return lastLogoutPromise;
  }
  lastLogoutAt = now;
  lastLogoutPromise = (async () => {
    // 1) Best-effort: hủy phiên phía server (xóa cookie HttpOnly).
    try {
      const refreshToken = await getRefreshToken();
      await fetch(`${Config.API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(refreshToken ? { refreshToken } : {}),
      });
    } catch (e) {
      // Mất mạng / BE sập / token hết hạn — vẫn dọn dẹp local ở dưới.
      if (Platform.OS === 'web') {
        console.warn('[logout] Không thể báo BE hủy phiên (tiếp tục xóa local):', e?.message);
      }
    }

    // 2) Xóa toàn bộ token khỏi thiết bị này (access + refresh).
    try {
      await setAuthToken('');
    } catch (e) {
      console.warn('[logout] Lỗi xóa token local:', e?.message);
    }
  })();
  return lastLogoutPromise;
};

export default performLogout;
