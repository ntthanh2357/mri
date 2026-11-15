/**
 * [P1-8] Quyết định quyền đọc tệp y tế trong /api/v1/storage/files/:fileId.
 *
 * Tách khỏi controller để test được không cần DB. Controller chịu trách nhiệm
 * tra hospitalId của bệnh nhân/người tải lên rồi truyền vào `ownerHospitalIds`.
 *
 * Nguyên tắc:
 *  - Bệnh nhân: CHỈ tệp có patientId là chính mình.
 *  - Nhân viên: phải cùng bệnh viện với bệnh nhân hoặc người tải tệp.
 *  - Thiếu chủ sở hữu / thiếu hospitalId → từ chối (fail-closed).
 */
export const canAccessStoredFile = (file, user, ownerHospitalIds = []) => {
  if (!file || !user?.id || !user?.role) return false;

  if (user.role === "patient") {
    return Boolean(file.patientId) && file.patientId.toString() === user.id.toString();
  }

  // Quản trị viên nền tảng (SaaS) được giám sát toàn hệ thống
  if (user.role === "admin") return true;

  if (!user.hospitalId) return false;

  return ownerHospitalIds.some(
    (hospitalId) => hospitalId && hospitalId.toString() === user.hospitalId.toString()
  );
};

export default canAccessStoredFile;
