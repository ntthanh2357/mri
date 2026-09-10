import { DicomStudy } from "./models/dicomStudy.model.js";
import { DicomSeries } from "./models/dicomSeries.model.js";
import { ImagingResult } from "./models/imagingResult.model.js";
import { Visit } from "../../models/visit.model.js";
import { AiJob } from "./models/aiJob.model.js";
import { successResponse, errorResponse } from "../../utils/response.util.js";
import { createNotificationInternal } from "../../controllers/notification.controller.js";

// ─── DICOM Series Type Classification (B.2) ───────────────────────────────────
const SERIES_TYPE_MAP = {
  't2_flair': 'T2_FLAIR',
  't2 flair': 'T2_FLAIR',
  'flair': 'T2_FLAIR',
  'dwi': 'DWI',
  'diffusion': 'DWI',
  'adc': 'ADC',
  'apparent diffusion': 'ADC',
  'tof': 'TOF_MRA',
  'mra': 'TOF_MRA',
  'time of flight': 'TOF_MRA',
  't1_flair': 'T1_FLAIR',
  't1 flair': 'T1_FLAIR',
  't2_cor': 'T2_CORONAL',
  't2 cor': 'T2_CORONAL',
  'coronal': 'T2_CORONAL',
  'ax_t1': 'AX_T1_FLAIR',
  'ax t1': 'AX_T1_FLAIR',
};

/**
 * Phân loại series theo DICOM metadata (B.2)
 * Ưu tiên: SeriesDescription tag > tên thư mục (gợi ý dự phòng)
 */
function classifySeriesType(seriesDescription = "", folderName = "") {
  const desc = (seriesDescription || folderName || "").toLowerCase().trim();
  for (const [keyword, type] of Object.entries(SERIES_TYPE_MAP)) {
    if (desc.includes(keyword)) return type;
  }
  return 'OTHER';
}

// ─── B.5 — Validate DICOM trước khi xử lý ────────────────────────────────────
function validateDicomSeries(seriesList = []) {
  const errors = [];
  const warnings = [];
  const seriesTypes = seriesList.map(s => s.seriesType);

  // Kiểm tra có ít nhất T2 FLAIR
  if (!seriesTypes.includes('T2_FLAIR')) {
    errors.push("Thiếu chuỗi T2 FLAIR — đây là chuỗi bắt buộc để phân tích u não.");
  }

  // Kiểm tra slice count
  for (const series of seriesList) {
    if (series.sliceCount < 10) {
      warnings.push(`Chuỗi ${series.seriesType} chỉ có ${series.sliceCount} slice — cần ít nhất 10 để phân tích chính xác.`);
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}

// ─── B.1/B.4 — Upload/Tạo DICOM Study ────────────────────────────────────────
// @route POST /api/v1/dicom/studies
// @access Private (Technician, Admin)
export const createDicomStudy = async (req, res) => {
  try {
    if (!["technician", "doctor", "admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ kỹ thuật viên mới có thể tạo bản ghi DICOM Study.", 403);
    }

    const hospitalId = req.user.hospitalId;
    if (!hospitalId) return errorResponse(res, "Bạn chưa được gán vào bệnh viện nào.", 403);

    const {
      visitId,
      studyDate,
      studyUID,
      accessionNumber,
      imagingType,
      description,
      seriesList = [],         // [{seriesType, seriesDescription, sliceCount, folderName, dicomFileUrls}]
    } = req.body;

    if (!visitId) return errorResponse(res, "Thiếu ID lượt khám.", 400);

    const visit = await Visit.findOne({ _id: visitId, hospitalId });
    if (!visit) return errorResponse(res, "Không tìm thấy lượt khám.", 404);

    // B.2 — Phân loại và validate series
    const classifiedSeries = seriesList.map(s => ({
      ...s,
      seriesType: classifySeriesType(s.seriesDescription, s.folderName)
    }));

    // B.5 — Validate
    const validation = validateDicomSeries(classifiedSeries);

    // Tạo DicomStudy
    const study = new DicomStudy({
      hospitalId,
      patientId: visit.patientId,
      visitId,
      studyDate: studyDate ? new Date(studyDate) : new Date(),
      studyUID: studyUID || "",
      accessionNumber: accessionNumber || "",
      imagingType: imagingType || "MRI",
      description: description || "",
      seriesCount: classifiedSeries.length,
      uploadedBy: req.user.id,
      uploadedAt: new Date(),
      status: validation.isValid ? 'upload_complete' : 'error',
      validationErrors: [...validation.errors, ...validation.warnings],
    });
    await study.save();

    // Tạo DicomSeries cho từng chuỗi
    const savedSeries = [];
    for (const s of classifiedSeries) {
      const series = new DicomSeries({
        studyId: study._id,
        hospitalId,
        seriesType: s.seriesType,
        seriesUID: s.seriesUID || "",
        seriesDescription: s.seriesDescription || s.folderName || "",
        sliceCount: s.sliceCount || 0,
        dicomFileUrls: s.dicomFileUrls || [],
        metadata: s.metadata || {},
        uploadStatus: 'completed',
      });
      await series.save();
      savedSeries.push(series);
    }

    // Cập nhật seriesCount chính xác
    study.seriesCount = savedSeries.length;
    if (validation.isValid) {
      study.validatedAt = new Date();
    }
    await study.save();

    if (!validation.isValid) {
      return successResponse(res, {
        study,
        series: savedSeries,
        validation,
      }, `DICOM study đã lưu nhưng có lỗi validation: ${validation.errors.join('; ')}. AI sẽ không được kích hoạt.`, 201);
    }

    // Cập nhật Visit status + liên kết study vào ImagingResult (nếu có)
    visit.status = 'chờ kết quả AI';
    await visit.save();

    // Tạo hoặc cập nhật ImagingResult với studyId
    if (visit.mriOrder?.imagingResultId) {
      await ImagingResult.findByIdAndUpdate(visit.mriOrder.imagingResultId, {
        studyId: study._id
      });
      study.imagingResultId = visit.mriOrder.imagingResultId;
      await study.save();
    }

    // Kích hoạt AI Job (C.8)
    const aiJob = new AiJob({
      hospitalId,
      visitId: visit._id,
      imagingResultId: visit.mriOrder?.imagingResultId || null,
      studyId: study._id,
      triggeredBy: req.user.id,
      priority: visit.priority === 'khẩn cấp' ? 1 : 5,
      status: 'queued',
      currentStep: "Đang chờ trong hàng đợi AI",
    });
    await aiJob.save();

    // Gửi thông báo cho bác sĩ chỉ định
    try {
      if (visit.doctorId) {
        await createNotificationInternal({
          hospitalId,
          recipientId: visit.doctorId,
          senderId: req.user.id,
          type: "dicom_uploaded",
          title: "🔬 DICOM đã upload xong",
          message: `KTV đã upload ${savedSeries.length} chuỗi DICOM. AI đang xử lý...`,
          relatedId: study._id,
        });
      }
    } catch (notifErr) {
      console.warn("⚠️ Không thể gửi thông báo upload DICOM:", notifErr.message);
    }

    return successResponse(res, {
      study,
      series: savedSeries,
      aiJob,
      validation,
    }, "Upload DICOM Study thành công. AI job đã được tạo.", 201);
  } catch (err) {
    console.error("Lỗi createDicomStudy:", err);
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── Lấy Study theo ID ────────────────────────────────────────────────────────
// @route GET /api/v1/dicom/studies/:id
// @access Private
export const getStudyById = async (req, res) => {
  try {
    const study = await DicomStudy.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    });
    if (!study) return errorResponse(res, "Không tìm thấy DICOM Study.", 404);

    const series = await DicomSeries.find({ studyId: study._id }).lean();
    return successResponse(res, { study, series }, "Lấy thông tin DICOM Study thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── Lấy Study theo visitId ────────────────────────────────────────────────────
// @route GET /api/v1/dicom/studies/by-visit/:visitId
// @access Private
export const getStudiesByVisit = async (req, res) => {
  try {
    const studies = await DicomStudy.find({
      visitId: req.params.visitId,
      hospitalId: req.user.hospitalId
    }).sort({ createdAt: -1 });

    const results = await Promise.all(studies.map(async (study) => {
      const series = await DicomSeries.find({ studyId: study._id }).lean();
      return { study, series };
    }));

    return successResponse(res, results, "Lấy DICOM Studies theo lượt khám thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── B.5 — Validate DICOM Study ──────────────────────────────────────────────
// @route POST /api/v1/dicom/studies/:id/validate
// @access Private (Technician, Admin)
export const validateStudy = async (req, res) => {
  try {
    const study = await DicomStudy.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    });
    if (!study) return errorResponse(res, "Không tìm thấy DICOM Study.", 404);

    const series = await DicomSeries.find({ studyId: study._id }).lean();
    const validation = validateDicomSeries(series);

    study.validationErrors = [...validation.errors, ...validation.warnings];
    study.status = validation.isValid ? 'upload_complete' : 'error';
    if (validation.isValid) study.validatedAt = new Date();
    await study.save();

    return successResponse(res, {
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings,
      study
    }, validation.isValid ? "DICOM hợp lệ, sẵn sàng xử lý AI." : "DICOM có lỗi, cần bổ sung trước khi xử lý.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── Lấy danh sách Studies của bệnh viện ─────────────────────────────────────
// @route GET /api/v1/dicom/studies
// @access Private (Doctor, Technician, Admin)
export const getAllStudies = async (req, res) => {
  try {
    if (req.user.role === "patient") return errorResponse(res, "Không có quyền.", 403);
    const hospitalId = req.user.hospitalId;

    const { status, limit = 20, page = 1 } = req.query;
    const filter = { hospitalId };
    if (status) filter.status = status;

    const total = await DicomStudy.countDocuments(filter);
    const studies = await DicomStudy.find(filter)
      .populate("patientId", "profile.name profile.fullName email")
      .populate("uploadedBy", "profile.name")
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    return successResponse(res, { studies, total, page: parseInt(page), limit: parseInt(limit) }, "Lấy danh sách DICOM Studies thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};
