import { ImagingResult } from "../models/imagingResult.model.js";
import { Visit } from "../models/visit.model.js";
import { User } from "../models/user.model.js";

/**
 * Service: Tạo kết quả chẩn đoán hình ảnh mới
 */
export const createImagingResultService = async ({ hospitalId, user, body }) => {
  const {
    medicalId,
    patientName,
    birthYear,
    gender,
    address,
    orderDate,
    orderingDoctor,
    orderingDepartment,
    medicalRecordNumber,
    diagnosis,
    procedure,
    technique,
    findings,
    conclusion,
    radiologist,
    reportDate,
    images,
    dicomMetadata,
    dicomZipUrl,
    dicomZipSize,
    dicomZipFilename,
    imagingType,
    visitId,
  } = body;

  // 1. Check roles
  if (user.role === "patient") {
    const userDoc = await User.findById(user.id);
    if (!userDoc || userDoc.profile?.medicalId !== medicalId) {
      const err = new Error("Bạn chỉ có thể tự lưu trữ kết quả cho chính mình.");
      err.statusCode = 403;
      throw err;
    }
  } else if (!["doctor", "admin", "technician"].includes(user.role)) {
    const err = new Error("Bạn không có quyền thực hiện hành động này.");
    err.statusCode = 403;
    throw err;
  }

  // 2. Validate required fields
  if (!medicalId || !patientName || !gender || !orderDate || !procedure || !findings || !conclusion || !radiologist || !reportDate || !imagingType) {
    const err = new Error("Vui lòng nhập đầy đủ các trường bắt buộc.");
    err.statusCode = 400;
    throw err;
  }

  // 3. Create record
  const newResult = new ImagingResult({
    hospitalId: user.hospitalId,
    medicalId,
    patientName,
    birthYear,
    gender,
    address,
    orderDate,
    orderingDoctor,
    orderingDepartment,
    medicalRecordNumber,
    diagnosis,
    procedure,
    technique,
    findings,
    conclusion,
    radiologist,
    reportDate,
    images: images || [],
    dicomMetadata: dicomMetadata || {},
    dicomZipUrl: dicomZipUrl || null,
    dicomZipSize: dicomZipSize || null,
    dicomZipFilename: dicomZipFilename || null,
    imagingType,
  });

  await newResult.save();

  if (visitId) {
    const visit = await Visit.findById(visitId);
    if (visit) {
      visit.mriOrder = visit.mriOrder || {};
      visit.mriOrder.imagingResultId = newResult._id;
      visit.status = visit.mriOrder.requestAiAnalysis ? "chờ kết quả AI" : "chờ bác sĩ đọc";
      await visit.save();
    }
  }

  return newResult;
};

/**
 * Service: Bác sĩ CĐHA thẩm định, đọc kết quả và ký số điện tử
 */
export const signAndFinalizeResultService = async ({ resultId, hospitalId, user, updateData }) => {
  const result = await ImagingResult.findById(resultId);
  if (!result) {
    const err = new Error("Không tìm thấy kết quả chẩn đoán.");
    err.statusCode = 404;
    throw err;
  }

  // Multi-tenant check
  if (result.hospitalId && result.hospitalId.toString() !== hospitalId.toString()) {
    const err = new Error("Bạn không có quyền chỉnh sửa kết quả phim chụp của bệnh viện khác.");
    err.statusCode = 403;
    throw err;
  }

  // Cập nhật các trường lâm sàng
  if (updateData.findings !== undefined) result.findings = updateData.findings;
  if (updateData.conclusion !== undefined) result.conclusion = updateData.conclusion;
  if (updateData.technique !== undefined) result.technique = updateData.technique;
  if (updateData.procedure !== undefined) result.procedure = updateData.procedure;
  if (updateData.diagnosis !== undefined) result.diagnosis = updateData.diagnosis;

  // Bác sĩ CĐHA ký duyệt số
  if (user.role === "doctor" || user.role === "admin") {
    result.radiologist = user.profile?.fullName || user.profile?.name || user.email;
    result.isSigned = true;
    result.signedAt = new Date();
    result.signedByDoctorId = user.id;
  }

  await result.save();

  // Cập nhật trạng thái ca khám liên kết nếu có
  const linkedVisit = await Visit.findOne({ "mriOrder.imagingResultId": result._id });
  if (linkedVisit && linkedVisit.status === "chờ bác sĩ đọc") {
    linkedVisit.status = "hoàn tất";
    await linkedVisit.save();
  }

  return result;
};
