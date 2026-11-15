/**
 * Đường dẫn tệp nội bộ (ảnh phim, tệp DICOM): chỉ "/uploads/..." hoặc "/api/v1/storage/files/<id>".
 * Link đã ký được middleware xác minh và bỏ chữ ký trước khi tới đây (link chưa ký/hết hạn bị từ chối 403).
 * Bỏ origin nếu client gửi URL tuyệt đối: chữ ký chỉ gắn với phần đường dẫn, nên "https://<host lạ>/uploads/x.jpg"
 * không được lưu nguyên (nếu không, AI sẽ tải ảnh từ host lạ thay vì tệp của hệ thống).
 */
const INTERNAL_FILE_PATH = /^(?:https?:\/\/[^/?#]+)?(\/uploads\/[^?#]+|\/api\/v1\/storage\/files\/[^/?#]+)$/i;

export const toInternalFilePath = (value) => {
  if (typeof value !== "string") return null;
  const match = value.trim().split("#")[0].match(INTERNAL_FILE_PATH);
  if (!match) return null;
  // Không cho ".." thoát thư mục /uploads
  return match[1].includes("..") ? null : match[1];
};

export const isInternalFileUrl = (value) => toInternalFilePath(value) !== null;
