import { User } from "../models/user.model.js";
import { Hospital } from "../models/hospital.model.js";
import { Visit } from "../models/visit.model.js";

const MIN_REASON_LENGTH = 10;

// Ai được ký báo cáo CĐHA (NĐ 96/2023 Điều 40 k4, Điều 41):
// - radiologist: luôn được ký.
// - department_head: là trưởng khoa lâm sàng nên phải được viện cấp quyền riêng và ghi lý do ký thay.
// - doctor: chỉ khi viện không có bác sĩ CĐHA, viện đã bật chính sách, và đúng là bác sĩ chỉ định ca này.
//   Trường hợp còn lại bác sĩ lâm sàng dùng /acknowledge và /clinical-addendum.
export const evaluateImagingSignPermission = async ({ user, imaging }) => {
  const userId = String(user.id || user._id);

  if (user.role === "radiologist") {
    return { allowed: true, mode: "radiologist", requiresReason: false };
  }

  if (user.role === "department_head") {
    const account = await User.findById(userId).select("canSignImaging").lean();
    if (account?.canSignImaging !== true) {
      return {
        allowed: false,
        code: "IMAGING_SIGN_NOT_GRANTED",
        message: "Tài khoản Trưởng khoa chưa được bệnh viện cấp quyền ký báo cáo CĐHA.",
      };
    }
    return { allowed: true, mode: "acting_department_head", requiresReason: true };
  }

  if (user.role === "doctor") {
    const denied = {
      allowed: false,
      code: "IMAGING_SIGN_RADIOLOGY_ONLY",
      message: "Báo cáo CĐHA do Bác sĩ CĐHA ký. Bác sĩ lâm sàng dùng chức năng xác nhận đã đọc hoặc phụ lục lâm sàng.",
    };
    const hospital = await Hospital.findById(imaging.hospitalId).select("imagingPolicy").lean();
    if (hospital?.imagingPolicy?.allowOrderingDoctorSign !== true) return denied;

    const radiologists = await User.countDocuments({
      hospitalId: imaging.hospitalId,
      role: "radiologist",
      isLocked: { $ne: true },
      isDeleted: { $ne: true },
    });
    if (radiologists > 0) return denied;

    // Nhiều phim chỉ được liên kết một chiều từ lượt khám (mriOrder.imagingResultId)
    const visit = imaging.visitId
      ? await Visit.findById(imaging.visitId).select("doctorId").lean()
      : await Visit.findOne({ hospitalId: imaging.hospitalId, "mriOrder.imagingResultId": imaging._id }).select("doctorId").lean();
    if (!visit?.doctorId || String(visit.doctorId) !== userId) {
      return { ...denied, message: "Chỉ bác sĩ chỉ định ca chụp này mới được đọc và ký kết quả." };
    }
    return { allowed: true, mode: "ordering_doctor_exception", requiresReason: false };
  }

  return { allowed: false, code: "IMAGING_SIGN_FORBIDDEN", message: "Vai trò của bạn không được ký báo cáo CĐHA." };
};

export const validateSignReason = (permission, reason) => {
  if (!permission.requiresReason) return null;
  return String(reason || "").trim().length >= MIN_REASON_LENGTH
    ? null
    : `Trưởng khoa ký thay Bác sĩ CĐHA phải ghi rõ lý do, tối thiểu ${MIN_REASON_LENGTH} ký tự.`;
};
