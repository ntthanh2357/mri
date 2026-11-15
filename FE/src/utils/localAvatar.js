import { initialsOf } from './initials.js';

/**
 * Ảnh đại diện chữ viết tắt tạo ngay trên máy (SVG data URI), KHÔNG gọi dịch vụ ngoài.
 * Trước đây dùng ui-avatars.com: tên/email của mọi tài khoản (kể cả bệnh nhân) bị gửi sang máy chủ bên thứ ba.
 */
export const localAvatarUri = (name) => {
  const text = initialsOf(name).replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#e2e8f0"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#475569">${text}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};
