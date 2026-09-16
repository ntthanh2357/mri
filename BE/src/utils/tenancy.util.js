import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { TransferForm } from "../models/transferForm.model.js";
import { Visit } from "../models/visit.model.js";

/**
 * Kiểm tra phân quyền truy cập hồ sơ bệnh nhân đa cơ sở (Multi-Tenant Access Control)
 * Ngăn chặn tuyệt đối lỗ hổng BOLA / IDOR truy xuất chéo hồ sơ y tế giữa các bệnh viện.
 *
 * @param {string|Object} patientId - ID của bệnh nhân cần truy xuất
 * @param {Object|string} userOrHospitalId - Đối tượng req.user hoặc hospitalId
 * @param {string} [roleArg] - Vai trò người dùng (nếu truyền tham số rời rạc)
 * @param {string} [userIdArg] - ID người dùng (nếu truyền tham số rời rạc)
 * @returns {Promise<Object|null>} Trả về tài liệu bệnh nhân nếu hợp lệ, ngược lại trả về null (Forbidden)
 */
export const checkPatientTenancy = async (patientId, userOrHospitalId, roleArg, userIdArg) => {
  if (!patientId) return null;

  let userHospitalId = userOrHospitalId;
  let userRole = roleArg;
  let userId = userIdArg;

  // Hỗ trợ truyền req.user trực tiếp hoặc các tham số rời rạc
  if (userOrHospitalId && typeof userOrHospitalId === "object") {
    userHospitalId = userOrHospitalId.hospitalId;
    userRole = userOrHospitalId.role;
    userId = userOrHospitalId.id || userOrHospitalId._id || userOrHospitalId.userId;
  }

  // Hỗ trợ tìm bệnh nhân bằng ObjectId hoặc profile.medicalId chuỗi, tránh CastError
  let patient = null;
  if (mongoose.Types.ObjectId.isValid(patientId)) {
    patient = await User.findById(patientId);
  }
  if (!patient) {
    patient = await User.findOne({ "profile.medicalId": patientId });
  }
  if (!patient || patient.role !== "patient") return null;

  // 1. Quản trị viên cấp cao có quyền giám sát hệ thống
  if (userRole === "admin" || userRole === "system_admin") {
    return patient;
  }

  // 2. Chính bệnh nhân đang tự truy xuất hồ sơ của mình (Token cá nhân B2C)
  if (userId && patient._id.toString() === userId.toString()) {
    return patient;
  }

  // 2.1. Chặn đứng BOLA giữa các bệnh nhân: Nếu là tài khoản vai trò patient mà không phải chính mình,
  // tuyệt đối không được xem hồ sơ bệnh nhân khác (kể cả cùng cơ sở khám chữa bệnh)
  if (userRole === "patient") {
    return null;
  }

  // 3. Nhân viên y tế bắt buộc phải được gán vào bệnh viện
  if (!userHospitalId) {
    return null;
  }

  const patientHospId = patient.hospitalId ? patient.hospitalId.toString() : null;
  const currentHospId = userHospitalId.toString();

  // 4. Bệnh nhân thuộc cùng bệnh viện với nhân viên y tế
  if (patientHospId && patientHospId === currentHospId) {
    return patient;
  }

  // 5. Nếu bệnh nhân thuộc bệnh viện khác: BẮT BUỘC phải có Phiếu chuyển viện hợp lệ
  if (patientHospId && patientHospId !== currentHospId) {
    const activeTransfer = await TransferForm.findOne({
      patient_id: patient._id,
      $or: [
        { targetHospitalId: currentHospId },
        { to_hospital_id: currentHospId }
      ],
      status: { $in: ["pending", "accepted", "in_transit", "completed", "PENDING", "APPROVED", "ACCEPTED"] },
    })
      .setOptions({ bypassTenancy: true })
      .lean();

    if (activeTransfer) {
      return patient;
    }
    // Thuộc viện khác và không có phiếu chuyển viện -> Chặn IDOR trái phép
    return null;
  }

  // 6. Bệnh nhân tự do B2C (chưa gán viện - patientHospId == null):
  // Chỉ nhân viên y tế của bệnh viện mà bệnh nhân này ĐÃ CÓ lượt khám (Visit) tiếp đón mới được xem
  const activeVisit = await Visit.findOne({
    patientId: patient._id,
    hospitalId: currentHospId,
  })
    .setOptions({ bypassTenancy: true })
    .lean();

  if (activeVisit) {
    return patient;
  }

  // Bệnh nhân B2C chưa từng khám tại bệnh viện này -> Chặn tuyệt đối (Bảo vệ quyền riêng tư y bạ)
  return null;
};

export default checkPatientTenancy;
