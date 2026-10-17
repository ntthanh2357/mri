import { Platform } from "react-native";
import { createNavigationContainerRef } from "@react-navigation/native";
import { isStaffPortalPath } from "./portalPath";

export const navigationRef = createNavigationContainerRef();

export function navigateTo(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

export function resetTo(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.reset({
      index: 0,
      routes: [{ name, params }],
    });
  }
}

/**
 * ============================================================================
 * PORTAL-AWARE NAVIGATION HELPERS (Web: 2 cổng / và /staff)
 * ============================================================================
 * Sau khi tách đôi Cổng Bệnh nhân (/) và Cổng Nội bộ (/staff), mỗi cổng có
 * màn hình đăng nhập riêng ('Welcome' vs 'StaffLogin') trong navigator riêng.
 * Mọi luồng "thoát phiên" (logout, 401/403, session timeout) PHẢI điều hướng
 * về đúng màn đăng nhập của cổng đang đứng — nếu reset sang màn hình không
 * tồn tại trong navigator hiện tại, React Navigation sẽ lặng lẽ từ chối và
 * giao diện bị kẹt nguyên tại chỗ (lỗi "đăng xuất không thoát").
 */

/** true khi đang chạy trên web tại vùng URL /staff/* (Cổng Nội bộ). */
export const isStaffPortalWeb = () =>
  Platform.OS === "web" &&
  typeof window !== "undefined" &&
  typeof window.location !== "undefined" &&
  isStaffPortalPath(window.location.pathname);

/**
 * Tên màn hình đăng nhập của CỔNG ĐANG TRUY CẬP:
 *   /staff* → 'StaffLogin'  |  còn lại → 'Welcome'
 * Dùng cho mọi navigation.reset/navigateTo sau khi hết phiên hoặc đăng xuất.
 */
export const portalLoginRoute = () => (isStaffPortalWeb() ? "StaffLogin" : "Welcome");

/**
 * Về màn đăng nhập của cổng hiện tại — DÙNG CHO CÁC LUỒNG HẾT PHIÊN (401/403).
 *
 * ⚠️ GUARD CHỐNG VÒNG LẶP REMOUNT: màn đăng nhập (Welcome/StaffLogin) có
 * auto-check /auth/me khi mount. Nếu request đó 401 mà ta vẫn reset về chính
 * màn đó → màn hình remount → auto-check lại → 401 lại → reset lại… vô hạn
 * (kẹt vĩnh viễn ở spinner "Đang kiểm tra phiên làm việc"). Vì vậy khi đã
 * ĐANG đứng ở màn đăng nhập thì bỏ qua reset — chính màn đó tự xử lý trạng
 * thái thất bại (hiện form đăng nhập).
 */
export const goToPortalLogin = () => {
  const target = portalLoginRoute();
  try {
    if (navigationRef.isReady()) {
      const current = navigationRef.getCurrentRoute()?.name;
      if (current === target) return; // đã ở màn đăng nhập — không reset nữa
      resetTo(target);
    }
  } catch (e) {
    // Navigator chưa sẵn sàng / không tìm thấy route — im lặng bỏ qua
  }
};
