/** Thoát ký tự đặc biệt để dùng chuỗi người dùng nhập trong RegExp như chuỗi thường (chống regex injection / ReDoS). */
export const escapeRegex = (value) => String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
