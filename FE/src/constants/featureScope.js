/**
 * Phạm vi chức năng của phiên bản đồ án (theo góp ý hội đồng: thu hẹp phạm vi HIS).
 * BHYT, quản lý giường bệnh và phân hệ Dược nằm NGOÀI phạm vi → giao diện ẩn các phần này.
 * Mã nguồn BE/FE vẫn giữ nguyên; bật lại toàn bộ bằng EXPO_PUBLIC_ENABLE_OUT_OF_SCOPE=true khi build.
 */
const ENABLE_OUT_OF_SCOPE = String(process.env.EXPO_PUBLIC_ENABLE_OUT_OF_SCOPE || '').toLowerCase() === 'true';

export const FEATURE_SCOPE = Object.freeze({
  bhyt: ENABLE_OUT_OF_SCOPE, // Khai báo/xác minh thẻ BHYT, tính đồng chi trả, xuất dữ liệu giám định
  beds: ENABLE_OUT_OF_SCOPE, // Sơ đồ và phân bổ giường nội trú
  // Phân hệ Dược: dược sĩ duyệt/phát thuốc, kho & hạn dùng, hậu kiểm, "Dược sĩ AI". Kê đơn trong bệnh án và
  // cảnh báo tương tác thuốc khi kê đơn vẫn giữ (thuộc EMR, bỏ đi sẽ mất cảnh báo an toàn).
  pharmacy: ENABLE_OUT_OF_SCOPE,
});

export const isFeatureEnabled = (key) => FEATURE_SCOPE[key] === true;

export const OUT_OF_SCOPE_NOTICE = 'Chức năng này nằm ngoài phạm vi phiên bản hiện tại.';

// Màn hình/tab thuộc phần ngoài phạm vi — dùng để lọc menu và điểm điều hướng.
const PHARMACY_ROUTES = new Set(['PharmacyQueue', 'PharmacyOversight', 'DrugManagement']);

/** Mục menu/điều hướng còn nằm trong phạm vi hay không. item: { route, params } */
export const isRouteInScope = (route, params = {}) => {
  if (PHARMACY_ROUTES.has(route)) return isFeatureEnabled('pharmacy');
  if (route === 'EMRDashboard' && params?.tab === 'beds') return isFeatureEnabled('beds');
  return true;
};

export const filterMenuInScope = (items = []) => items.filter((item) => item && isRouteInScope(item.route, item.params));
