import { User } from "../../models/user.model.js";
import { DicomStudy } from "./models/dicomStudy.model.js";
import { DicomSeries } from "./models/dicomSeries.model.js";
import { ImagingResult } from "./models/imagingResult.model.js";
import { Visit } from "../../models/visit.model.js";
import { AiJob } from "./models/aiJob.model.js";
import { successResponse, errorResponse } from "../../utils/response.util.js";
import { createNotificationInternal } from "../../controllers/notification.controller.js";
import { enqueueAiPipelineJob } from "./aiPipeline.controller.js";
import { computeEffectiveSliceOverlay } from "./multiSliceAi.util.js";

// ─── DICOM Series Type Classification (B.2) ───────────────────────────────────
const SERIES_TYPE_MAP = {
  't1c': 'T1C+',
  't1+c': 'T1C+',
  't1_ce': 'T1C+',
  't1 ce': 'T1C+',
  'contrast': 'T1C+',
  'gad': 'T1C+',
  // Kiểm tra T1 FLAIR trước từ khóa 'flair' chung để không nhầm Sag_T1_FLAIR / AX_T1_FLAIR thành T2_FLAIR
  't1_flair': 'T1_FLAIR',
  't1 flair': 'T1_FLAIR',
  't2_flair': 'T2_FLAIR',
  't2 flair': 'T2_FLAIR',
  'flair': 'T2_FLAIR',
  'dwi': 'DWI',
  'diffusion': 'DWI',
  'adc': 'ADC',
  'apparent diffusion': 'ADC',
  'swi': 'SWI',
  'tof': 'TOF_MRA',
  'mra': 'TOF_MRA',
  'time of flight': 'TOF_MRA',
  't2_cor': 'T2_CORONAL',
  't2 cor': 'T2_CORONAL',
  'coronal': 'T2_CORONAL',
  'ax_t1': 'AX_T1_FLAIR',
  'ax t1': 'AX_T1_FLAIR',
  't1w': 'T1W',
  't2w': 'T2W',
};

export const MRI_BRAIN_TUMOR_PROTOCOLS = {
  BRAIN_TUMOR_STANDARD: {
    code: 'BRAIN_TUMOR_STANDARD',
    name: 'Protocol U não Tiêu chuẩn (T1W, T2W, T2-FLAIR, DWI/ADC, T1C+)',
    requiredSeries: ['T2_FLAIR'],
    recommendedSeries: ['T1W', 'T2_FLAIR', 'DWI', 'ADC', 'T1C+']
  },
  PRE_OP_NAVIGATION: {
    code: 'PRE_OP_NAVIGATION',
    name: 'Protocol Định vị Phẫu thuật Thần kinh (3D T1C+ mỏng 1mm, T2-FLAIR, TOF-MRA)',
    requiredSeries: ['T2_FLAIR'],
    recommendedSeries: ['T2_FLAIR', 'T1C+', 'TOF_MRA']
  },
  POST_OP_72H: {
    code: 'POST_OP_72H',
    name: 'Protocol Đánh giá Tồn dư U Hậu phẫu sớm <= 72h (T1W, T1C+, DWI/ADC, T2-FLAIR)',
    requiredSeries: ['T2_FLAIR'],
    recommendedSeries: ['T1W', 'T1C+', 'DWI', 'ADC', 'T2_FLAIR']
  },
  RANO_FOLLOWUP: {
    code: 'RANO_FOLLOWUP',
    name: 'Protocol Theo dõi Đáp ứng Điều trị RANO (T2-FLAIR, T1C+, DWI)',
    requiredSeries: ['T2_FLAIR'],
    recommendedSeries: ['T2_FLAIR', 'T1C+', 'DWI']
  }
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

    // Tạo hoặc cập nhật ImagingResult với studyId
    let imaging = null;
    if (visit.mriOrder?.imagingResultId) {
      imaging = await ImagingResult.findOne({ _id: visit.mriOrder.imagingResultId, hospitalId });
      if (imaging) {
        imaging.studyId = study._id;
        if (!imaging.images?.length) {
          const seriesUrls = savedSeries.flatMap(s => s.dicomFileUrls || []).filter(Boolean);
          if (seriesUrls.length) {
            imaging.images = seriesUrls;
            imaging.representativeSliceUrl = seriesUrls[0];
          }
        }
        await imaging.save();
        study.imagingResultId = imaging._id;
        await study.save();
      }
    }

    const hasImagesToAnalyze = Boolean(imaging?.images?.length);
    const canRunAi = hasImagesToAnalyze && imaging?.isSigned !== true;

    let aiJob = null;
    if (canRunAi) {
      // Kiểm tra đã có job đang chạy chưa
      const existingJob = await AiJob.findOne({
        visitId: visit._id,
        status: { $in: ['queued', 'running'] }
      });
      if (existingJob) {
        aiJob = existingJob;
      } else {
        aiJob = new AiJob({
          hospitalId,
          visitId: visit._id,
          imagingResultId: imaging._id,
          studyId: study._id,
          triggeredBy: req.user.id,
          priority: visit.priority === 'khẩn cấp' ? 1 : 5,
          status: 'queued',
          currentStep: "Đang chờ trong hàng đợi AI",
        });
        await aiJob.save();
        await ImagingResult.updateOne(
          { _id: imaging._id, hospitalId, isSigned: { $ne: true } },
          { $set: { aiJobId: aiJob._id, aiStatus: "pending", aiError: "" } }
        );
        enqueueAiPipelineJob(aiJob);
      }
      visit.status = 'chờ kết quả AI';
      await visit.save();
    } else {
      visit.status = 'chờ bác sĩ đọc';
      await visit.save();
    }

    // Gửi thông báo cho bác sĩ chỉ định
    try {
      if (visit.doctorId) {
        await createNotificationInternal({
          hospitalId,
          recipientId: visit.doctorId,
          senderId: req.user.id,
          type: "dicom_uploaded",
          title: "🔬 DICOM đã upload xong",
          message: canRunAi
            ? `KTV đã upload ${savedSeries.length} chuỗi DICOM. AI đang xử lý...`
            : `KTV đã upload ${savedSeries.length} chuỗi DICOM. Đang chờ bác sĩ đọc kết quả.`,
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
    }, canRunAi ? "Upload DICOM Study thành công. AI job đã được đưa vào hàng đợi." : "Upload DICOM Study thành công. Đang chờ bác sĩ đọc kết quả.", 201);
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

// ─── Manifest Trình xem Web Mini-PACS (Web DICOM Viewer Manifest) ──────────────
// @route GET /api/v1/dicom/studies/:id/viewer-manifest
// @access Private
export const getViewerManifest = async (req, res) => {
  try {
    const { id } = req.params;
    const hospitalId = req.user.hospitalId;

    // Model CĐHA không có patientId nên bộ lọc tenancy của bệnh nhân không khớp; bên dưới kiểm tra đúng phim của họ
    const imagingQuery = req.user.role === "patient" ? { bypassTenancy: true } : undefined;

    // Cho phép truyền studyId hoặc imagingResultId
    let study = await DicomStudy.findById(id, null, imagingQuery).lean();
    let imagingResult = null;

    if (!study) {
      imagingResult = await ImagingResult.findById(id, null, imagingQuery).lean();
      if (imagingResult?.studyId) {
        study = await DicomStudy.findById(imagingResult.studyId, null, imagingQuery).lean();
      }
    } else {
      imagingResult = study.imagingResultId
        ? await ImagingResult.findById(study.imagingResultId, null, imagingQuery).lean()
        : await ImagingResult.findOne({ studyId: study._id }, null, imagingQuery).lean();
    }

    if (!study && !imagingResult) {
      return errorResponse(res, "Không tìm thấy hồ sơ DICOM Study hoặc kết quả phim chụp.", 404);
    }

    // Bệnh nhân không gắn viện nên không qua được kiểm tra bên dưới: phải kiểm tra đúng phim của mình
    if (req.user.role === "patient") {
      const owner = await User.findById(req.user.id).select("profile.medicalId").lean();
      const ownsStudy =
        String(study?.patientId || "") === String(req.user.id) ||
        (Boolean(imagingResult?.medicalId) && owner?.profile?.medicalId === imagingResult.medicalId);
      if (!ownsStudy || imagingResult?.isSigned !== true) {
        return errorResponse(res, "Bạn không có quyền xem phim chụp này.", 403);
      }
    }

    const targetHospitalId = study?.hospitalId || imagingResult?.hospitalId;
    if (req.user.role !== "admin" && hospitalId && targetHospitalId && String(hospitalId) !== String(targetHospitalId)) {
      return errorResponse(res, "Không có quyền truy cập phim chụp của bệnh viện khác.", 403);
    }

    const dbSeries = study ? await DicomSeries.find({ studyId: study._id }).lean() : [];
    const fallbackImages = imagingResult?.images?.length ? imagingResult.images : [];
    const top5Slices = imagingResult?.top5SlicesUrls?.length ? imagingResult.top5SlicesUrls : [];

    // Chuẩn hóa danh sách chuỗi xung cho Web Viewer (nếu chưa có DicomSeries riêng thì dựng từ ImagingResult)
    const viewerSeries = dbSeries.length > 0
      ? dbSeries.map((s, idx) => ({
          seriesId: String(s._id),
          seriesType: s.seriesType || (idx === 0 ? "T2_FLAIR" : "T1C+"),
          seriesDescription: s.seriesDescription || s.seriesType,
          sliceCount: s.sliceCount || (s.dicomFileUrls?.length || fallbackImages.length || 1),
          pixelSpacing: s.metadata?.pixelSpacing?.length === 2 ? s.metadata.pixelSpacing : [0.5, 0.5],
          sliceThickness: s.metadata?.sliceThickness || 3.0,
          slices: (s.dicomFileUrls?.length
            ? s.dicomFileUrls
            : s.sliceFileIds?.length
              ? s.sliceFileIds.map((fileId) => `/api/v1/storage/files/${fileId}`)
              : fallbackImages).map((url, sIdx) => ({
            sliceIndex: sIdx + 1,
            imageUrl: url,
            isRepresentative: url === imagingResult?.representativeSliceUrl
          }))
        }))
      : (fallbackImages.length > 0 || top5Slices.length > 0)
        ? (/rano/i.test(imagingResult?.procedure || "")
            ? [
                {
                  seriesId: "series-t2-flair",
                  seriesType: "T2_FLAIR",
                  seriesDescription: "Ax T2 FLAIR 3mm (Phù quanh u & Thâm nhiễm)",
                  sliceCount: Math.max(fallbackImages.length, top5Slices.length, 1),
                  pixelSpacing: [0.5, 0.5],
                  sliceThickness: 3.0,
                  slices: (fallbackImages.length ? fallbackImages : top5Slices).map((url, sIdx) => ({
                    sliceIndex: sIdx + 1,
                    imageUrl: url,
                    isRepresentative: sIdx === 0
                  }))
                },
                {
                  seriesId: "series-t1c-post",
                  seriesType: "T1C+",
                  seriesDescription: "Ax T1W +Contrast Gadolinium (Đo lõi u ngấm thuốc RANO)",
                  sliceCount: Math.max(fallbackImages.length, 1),
                  pixelSpacing: [0.5, 0.5],
                  sliceThickness: 1.5,
                  slices: fallbackImages.map((url, sIdx) => ({
                    sliceIndex: sIdx + 1,
                    imageUrl: url,
                    isRepresentative: sIdx === 0
                  }))
                }
              ]
            : [
                {
                  seriesId: "series-default",
                  seriesType: imagingResult?.procedure?.includes("T1") ? "T1W" : "T2_FLAIR",
                  seriesDescription: imagingResult?.procedure || "Ảnh chụp MRI",
                  sliceCount: (fallbackImages.length ? fallbackImages : top5Slices).length,
                  pixelSpacing: [0.5, 0.5],
                  sliceThickness: 3.0,
                  slices: (fallbackImages.length ? fallbackImages : top5Slices).map((url, sIdx) => ({
                    sliceIndex: sIdx + 1,
                    imageUrl: url,
                    isRepresentative: sIdx === 0 || url === imagingResult?.representativeSliceUrl
                  }))
                }
              ])
        : [];

    // Tìm phim chụp kỳ trước (Prior Study) của cùng bệnh nhân để bật chế độ So sánh dọc thời gian (Dual Viewport)
    let priorResult = null;
    if (imagingResult?.medicalId) {
      priorResult = await ImagingResult.findOne({
        _id: { $ne: imagingResult._id },
        hospitalId: targetHospitalId,
        medicalId: imagingResult.medicalId,
        isSigned: true
      })
        .sort({ reportDate: -1, createdAt: -1 })
        .select("_id reportDate procedure images representativeSliceUrl structuredReport findings conclusion")
        .lean();
    }

    // Xây dựng danh sách overlay từng lát cắt (ưu tiên doctorOverride nếu bác sĩ đã chỉnh sửa ROI/loại u)
    const sliceOverlays = Array.isArray(imagingResult?.aiReport?.sliceResults)
      ? imagingResult.aiReport.sliceResults.map(computeEffectiveSliceOverlay).filter(Boolean)
      : [];

    let finalViewerSeries = viewerSeries;
    if (dbSeries.length === 0 && sliceOverlays.length > 1) {
      const groupMap = new Map();
      for (let i = 0; i < sliceOverlays.length; i += 1) {
        const s = sliceOverlays[i];
        if (!s.imageUrl) continue;
        const key = s.seriesName && s.seriesName !== "Uploaded_Study" ? s.seriesName : "Chuỗi MRI";
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            seriesName: key,
            seriesType: s.sequenceType && s.sequenceType !== "OTHER" ? s.sequenceType : classifySeriesType(key, key),
            slices: [],
          });
        }
        groupMap.get(key).slices.push({
          sliceIndex: groupMap.get(key).slices.length + 1,
          globalSliceIndex: Number.isInteger(s.sliceIndex) ? s.sliceIndex : i,
          imageUrl: s.imageUrl,
          isRepresentative: s.imageUrl === imagingResult?.representativeSliceUrl,
        });
      }
      if (groupMap.size >= 2) {
        let gIdx = 0;
        finalViewerSeries = Array.from(groupMap.values()).map((grp) => ({
          seriesId: `series-group-${gIdx++}`,
          seriesType: grp.seriesType || "T2_FLAIR",
          seriesDescription: grp.seriesName,
          sliceCount: grp.slices.length,
          pixelSpacing: [0.5, 0.5],
          sliceThickness: 3.0,
          slices: grp.slices,
        }));
      }
    }

    const repOverlay = sliceOverlays.find((s) => s.imageUrl === imagingResult?.representativeSliceUrl) || sliceOverlays[0] || null;
    const doctorCorrection = imagingResult?.aiReport?.doctorCorrection || null;
    const effectiveTopClass = repOverlay?.className || doctorCorrection?.correctClass || imagingResult?.aiReport?.class_name || null;
    const effectiveTopBox = effectiveTopClass === "notumor"
      ? null
      : (repOverlay
          ? repOverlay.boundingBox
          : (doctorCorrection?.bounding_box ?? imagingResult?.aiReport?.bounding_box ?? null));

    const manifest = {
      studyId: study?._id || null,
      imagingResultId: imagingResult?._id || null,
      medicalId: imagingResult?.medicalId || "",
      patientName: imagingResult?.patientName || "",
      studyDate: study?.studyDate || imagingResult?.orderDate || imagingResult?.reportDate || new Date(),
      modality: "MR",
      protocols: Object.values(MRI_BRAIN_TUMOR_PROTOCOLS),
      windowPresets: [
        { id: "brain_standard", label: "Não chuẩn (W:80 L:40)", ww: 80, wl: 40, brightness: 100, contrast: 100 },
        { id: "tumor_flair", label: "U não / Phù FLAIR (W:140 L:50)", ww: 140, wl: 50, brightness: 108, contrast: 125 },
        { id: "t1_contrast", label: "T1C+ Ngấm thuốc (W:120 L:60)", ww: 120, wl: 60, brightness: 96, contrast: 140 },
        { id: "stroke_dwi", label: "DWI Khuếch tán (W:60 L:30)", ww: 60, wl: 30, brightness: 112, contrast: 150 }
      ],
      series: finalViewerSeries,
      aiOverlay: {
        available: Boolean(imagingResult?.aiReport || imagingResult?.representativeSliceUrl || imagingResult?.segmentationUrl),
        representativeSliceUrl: imagingResult?.representativeSliceUrl || null,
        segmentationUrl: imagingResult?.segmentationUrl || null,
        top5SlicesUrls: top5Slices,
        className: effectiveTopClass,
        confidence: imagingResult?.aiReport?.confidence || null,
        boundingBox: effectiveTopBox,
        doctorCorrection,
        sliceOverlays,
        summary: imagingResult?.aiReport?.summary || null,
      },
      structuredReport: imagingResult?.structuredReport || null,
      priorStudy: priorResult
        ? {
            imagingResultId: priorResult._id,
            reportDate: priorResult.reportDate,
            procedure: priorResult.procedure,
            images: priorResult.images || [],
            representativeSliceUrl: priorResult.representativeSliceUrl || (priorResult.images?.[0] || null),
            measurements: priorResult.structuredReport?.measurements || null,
            rano: priorResult.structuredReport?.rano || null,
            conclusion: priorResult.conclusion || ""
          }
        : null
    };

    return successResponse(res, manifest, "Lấy manifest trình xem DICOM Web thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ khi tạo viewer manifest: " + err.message, 500);
  }
};
