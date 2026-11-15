/**
 * Vai trò chỉ phục vụ phần ngoài phạm vi đồ án (góp ý hội đồng: thu hẹp phạm vi HIS):
 * - cleaner: chỉ dùng cho bước "hoàn tất dọn giường" (quản lý giường đã tắt)
 * - pharmacist: phân hệ Dược (duyệt/phát thuốc, kho, "Dược sĩ AI") đã tắt
 * Tạm ẩn: không tạo mới tài khoản các vai trò này, không tính vào số nhân sự. Giữ nguyên enum trong User để tài khoản
 * và dữ liệu cũ vẫn hợp lệ; bật lại cùng cờ ENABLE_OUT_OF_SCOPE=true với BHYT và giường.
 * Đọc biến môi trường lúc gọi (không lúc import) để dotenv nạp muộn vẫn có hiệu lực.
 */
export const OUT_OF_SCOPE_ROLES = Object.freeze(["cleaner", "pharmacist"]);

export const outOfScopeEnabled = () => process.env.ENABLE_OUT_OF_SCOPE === "true";

export const isRoleInScope = (role) => outOfScopeEnabled() || !OUT_OF_SCOPE_ROLES.includes(role);

export const OUT_OF_SCOPE_ROLE_MESSAGE =
  "Vai trò này thuộc phần ngoài phạm vi phiên bản hiện tại (quản lý giường bệnh, phân hệ Dược), tạm thời không tạo tài khoản mới.";
