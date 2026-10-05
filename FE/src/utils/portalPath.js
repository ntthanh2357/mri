/**
 * true khi URL thuộc Cổng Nội bộ: đúng "/staff" hoặc bắt đầu bằng "/staff/".
 * Không dùng indexOf('/staff') === 0 — sẽ khớp nhầm route của cổng chính như
 * "/staff-management", "/staff-scheduling" (tải lại trang bị đá sang cổng nội bộ).
 */
export const isStaffPortalPath = (pathname = '') => pathname === '/staff' || pathname.startsWith('/staff/');
