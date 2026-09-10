import { ImagingResult } from "../models/imagingResult.model.js";
import { AiJob } from "../models/aiJob.model.js";
import { Visit } from "../models/visit.model.js";
import { DicomStudy } from "../models/dicomStudy.model.js";
import { DicomSeries } from "../models/dicomSeries.model.js";
import { Assignment } from "../models/assignment.model.js";
import { User } from "../models/user.model.js";
import { successResponse, errorResponse } from "../utils/response.util.js";

// ─── G.1 — Trình xem DICOM — lấy danh sách series và signed URLs ─────────────
// @route GET /api/v1/clinical-view/imaging/:imagingResultId/dicom-viewer
// @access Private (Doctor, Technician, Admin)
export const getDicomViewerData = async (req, res) => {
  try {
    const allowedRoles = ["doctor", "technician", "admin", "hospital_admin", "nurse"];
    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(res, "Bạn không có quyền xem trình chiếu DICOM.", 403);
    }

    const { imagingResultId } = req.params;
    const imaging = await ImagingResult.findById(imagingResultId).lean();
    if (!imaging) return errorResponse(res, "Không tìm thấy kết quả MRI.", 404);

    // Lấy Study và Series liên kết
    const study = imaging.studyId
      ? await DicomStudy.findById(imaging.studyId).lean()
      : null;

    const seriesList = study
      ? await DicomSeries.find({ studyId: study._id }).lean()
      : [];

    // G.1 — Backend là proxy cấp URL (không expose Drive URL trực tiếp)
    // Trong thực tế: tạo Drive signed URL (time-limited) cho từng series
    const seriesWithUrls = seriesList.map((s) => ({
      seriesId: s._id,
      seriesType: s.seriesType,
      sliceCount: s.sliceCount,
      driveSeriesFolderId: s.driveSeriesFolderId,
      // URL sẽ được signed bởi backend trước khi trả về FE
      viewerUrl: s.driveSeriesFolderId
        ? `https://drive.google.com/drive/folders/${s.driveSeriesFolderId}`
        : null,
      metadata: s.dicomMetadata || {},
    }));

    return successResponse(res, {
      imagingResultId: imaging._id,
      studyInstanceUID: imaging.dicomMetadata?.studyInstanceUID || "",
      study: study
        ? {
            id: study._id,
            studyDate: study.studyDate,
            studyUID: study.studyUID,
            driveStudyFolderId: study.driveStudyFolderId,
          }
        : null,
      series: seriesWithUrls,
      // Thông tin bổ sung cho viewer
      patientName: imaging.patientName,
      orderDate: imaging.orderDate,
    }, "Lấy dữ liệu DICOM viewer thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── G.2 — Lấy AI overlays (bounding box, mask, heatmap) ─────────────────────
// @route GET /api/v1/clinical-view/imaging/:imagingResultId/ai-overlays
// @access Private (Doctor)
export const getAiOverlays = async (req, res) => {
  try {
    if (!["doctor", "admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ bác sĩ mới được xem overlay AI.", 403);
    }

    const { imagingResultId } = req.params;
    const imaging = await ImagingResult.findById(imagingResultId).lean();
    if (!imaging) return errorResponse(res, "Không tìm thấy kết quả MRI.", 404);

    const aiJob = imaging.aiJobId
      ? await AiJob.findById(imaging.aiJobId).lean()
      : null;

    // G.2 — Trả về tất cả overlay layers, FE bật/tắt từng layer
    return successResponse(res, {
      imagingResultId: imaging._id,
      overlays: {
        // C.1 — Mask phân đoạn T2 FLAIR
        segmentationMask: {
          available: !!imaging.segmentationUrl,
          url: imaging.segmentationUrl || null,
          label: "Vùng phân đoạn u (T2 FLAIR)",
        },
        // C.6 — 5 slice nguy hiểm nhất với bounding box
        topSlices: {
          available: imaging.top5SlicesUrls?.length > 0,
          urls: imaging.top5SlicesUrls || [],
          label: "5 slice nguy hiểm nhất",
        },
        // C.2 — Heatmap ADC
        adcHeatmap: {
          available: !!aiJob?.stepResults?.dwi?.adcHeatmapUrl,
          url: aiJob?.stepResults?.dwi?.adcHeatmapUrl || null,
          label: "Heatmap ADC (đánh giá ác tính)",
        },
        // C.7 — Ảnh đại diện
        representativeSlice: {
          available: !!imaging.representativeSliceUrl,
          url: imaging.representativeSliceUrl || null,
          label: "Ảnh đại diện (slice rõ nhất)",
        },
      },
      aiReport: imaging.aiReport || null,
    }, "Lấy AI overlays thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── G.3 — Hiển thị báo cáo AI tổng hợp đầy đủ (cho bác sĩ) ─────────────────
// @route GET /api/v1/clinical-view/imaging/:imagingResultId/ai-report
// @access Private (Doctor, Admin)
export const getFullAiReport = async (req, res) => {
  try {
    if (!["doctor", "admin", "hospital_admin", "technician"].includes(req.user.role)) {
      return errorResponse(res, "Bạn không có quyền xem báo cáo AI chi tiết.", 403);
    }

    const { imagingResultId } = req.params;
    const imaging = await ImagingResult.findById(imagingResultId)
      .populate("signedBy", "profile.name profile.specialty")
      .lean();
    if (!imaging) return errorResponse(res, "Không tìm thấy kết quả MRI.", 404);

    const aiJob = imaging.aiJobId
      ? await AiJob.findById(imaging.aiJobId).select("-errorLog").lean()
      : null;

    // G.3 — Dữ liệu đầy đủ cho bác sĩ (không lọc như bệnh nhân)
    const report = {
      imagingResultId: imaging._id,
      patientName: imaging.patientName,
      orderDate: imaging.orderDate,
      reportDate: imaging.reportDate,
      procedure: imaging.procedure,
      radiologist: imaging.radiologist,
      technique: imaging.technique,
      findings: imaging.findings,
      conclusion: imaging.conclusion,
      // Trạng thái ký duyệt
      isSigned: imaging.isSigned,
      signedBy: imaging.signedBy || null,
      signedAt: imaging.signedAt,
      // Kết quả AI chi tiết (G.3)
      aiReport: imaging.aiReport
        ? {
            ...imaging.aiReport,
            // Số liệu chính
            tumorVolumeCm3: imaging.aiReport.tumorVolumeCm3,
            midlineShiftMm: imaging.aiReport.midlineShiftMm,
            malignancyLevel: imaging.aiReport.malignancyLevel, // low/moderate/high
            adcMean: imaging.aiReport.adcMean,
            vesselInvasion: imaging.aiReport.vesselInvasion, // true/false
            anatomicalLocation: imaging.aiReport.anatomicalLocation, // temporal/frontal...
            confidenceScore: imaging.aiReport.confidenceScore,
          }
        : null,
      // URLs tài liệu AI
      urls: {
        segmentation: imaging.segmentationUrl,
        top5Slices: imaging.top5SlicesUrls,
        representativeSlice: imaging.representativeSliceUrl,
        model3d: imaging.model3dUrl,
      },
      // Thông tin AI job
      aiJob: aiJob
        ? {
            jobId: aiJob._id,
            status: aiJob.status,
            completedAt: aiJob.completedAt,
            processingTimeSeconds: aiJob.startedAt && aiJob.completedAt
              ? Math.round((new Date(aiJob.completedAt) - new Date(aiJob.startedAt)) / 1000)
              : null,
          }
        : null,
    };

    return successResponse(res, report, "Lấy báo cáo AI đầy đủ thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── G.4 — Lấy URL 3D model (cho Three.js/Babylon.js viewer) ─────────────────
// @route GET /api/v1/clinical-view/imaging/:imagingResultId/3d-model
// @access Private (Doctor)
export const get3dModelUrl = async (req, res) => {
  try {
    if (!["doctor", "admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Bạn không có quyền xem mô hình 3D.", 403);
    }

    const { imagingResultId } = req.params;
    const imaging = await ImagingResult.findById(imagingResultId)
      .select("model3dUrl patientName orderDate aiReport")
      .lean();
    if (!imaging) return errorResponse(res, "Không tìm thấy kết quả MRI.", 404);

    if (!imaging.model3dUrl) {
      return errorResponse(res, "Mô hình 3D chưa được tạo cho ca này. AI cần hoàn thành bước C.5.", 404);
    }

    return successResponse(res, {
      model3dUrl: imaging.model3dUrl,
      patientName: imaging.patientName,
      tumorVolumeCm3: imaging.aiReport?.tumorVolumeCm3 || null,
    }, "Lấy URL mô hình 3D thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── G.5 — Bác sĩ ký duyệt báo cáo + lưu feedback AI ───────────────────────
// @route POST /api/v1/clinical-view/imaging/:imagingResultId/sign
// @access Private (Doctor)
export const signImagingReport = async (req, res) => {
  try {
    if (req.user.role !== "doctor" && req.user.role !== "admin") {
      return errorResponse(res, "Chỉ bác sĩ mới có thể ký duyệt báo cáo.", 403);
    }

    const { imagingResultId } = req.params;
    const {
      finalConclusion, // Kết luận cuối của bác sĩ
      correctedBoundingBox, // G.5 Active Learning: bác sĩ chỉnh sửa
      correctedMask,        // G.5 Active Learning: vẽ lại mask
      isAiCorrection,       // true nếu bác sĩ thấy AI sai
      doctorNote,
    } = req.body;

    if (!finalConclusion) {
      return errorResponse(res, "Vui lòng nhập kết luận cuối của bác sĩ.", 400);
    }

    const imaging = await ImagingResult.findById(imagingResultId);
    if (!imaging) return errorResponse(res, "Không tìm thấy kết quả MRI.", 404);
    if (imaging.isSigned) {
      return errorResponse(res, "Kết quả này đã được ký duyệt.", 400);
    }

    // Cập nhật báo cáo
    imaging.conclusion = finalConclusion;
    imaging.isSigned = true;
    imaging.signedBy = req.user.id;
    imaging.signedAt = new Date();
    if (doctorNote) imaging.findings = imaging.findings + "\n\nGhi chú bác sĩ: " + doctorNote;

    // G.5 — Active Learning: lưu feedback bác sĩ nếu có chỉnh sửa
    if (isAiCorrection && (correctedBoundingBox || correctedMask)) {
      const feedbackEntry = {
        doctorId: req.user.id,
        timestamp: new Date(),
        correctedBoundingBox: correctedBoundingBox || null,
        correctedMask: correctedMask || null,
        is_correction: true,
        originalAiReport: imaging.aiReport,
      };
      // Lưu vào aiReport.feedback array
      if (!imaging.aiReport) imaging.aiReport = {};
      if (!imaging.aiReport.feedbacks) imaging.aiReport.feedbacks = [];
      imaging.aiReport.feedbacks.push(feedbackEntry);
      imaging.markModified("aiReport");
    }

    await imaging.save();

    // Cập nhật Visit → hoàn tất
    const visit = await Visit.findOne({ "mriOrder.imagingResultId": imagingResultId });
    if (visit) {
      visit.status = "hoàn tất";
      await visit.save();

      // H.6 — Gửi thông báo bệnh nhân (kết quả sẵn sàng)
      try {
        const { createNotificationInternal } = await import("./notification.controller.js");
        await createNotificationInternal({
          hospitalId: req.user.hospitalId,
          userId: visit.patientId,
          title: "Kết quả MRI của bạn đã sẵn sàng",
          body: "Bác sĩ đã ký duyệt kết quả chụp MRI. Hãy đăng nhập để xem chi tiết.",
          type: "result_ready",
          data: { visitId: visit._id, imagingResultId },
        });
      } catch (notifErr) {
        console.warn("[G.5 Sign] Lỗi gửi notification bệnh nhân:", notifErr.message);
      }
    }

    // Ghi AuditLog
    try {
      const { AuditLog } = await import("../models/auditLog.model.js");
      await AuditLog.create({
        action: "G5_DOCTOR_SIGN_REPORT",
        performedBy: req.user.id,
        targetId: imagingResultId,
        targetModel: "ImagingResult",
        note: `Bác sĩ ký duyệt báo cáo${isAiCorrection ? " (có hiệu chỉnh AI)" : ""}`,
        hospitalId: req.user.hospitalId,
      });
    } catch { /* optional */ }

    return successResponse(res, {
      imagingResultId: imaging._id,
      isSigned: imaging.isSigned,
      signedAt: imaging.signedAt,
      visitStatus: visit?.status || null,
    }, "Ký duyệt báo cáo thành công. Đã thông báo bệnh nhân.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── G.6 — So sánh nhiều lần chụp (Follow-up Comparison) ────────────────────
// @route GET /api/v1/clinical-view/patients/:patientId/followup-comparison
// @access Private (Doctor)
export const getFollowUpComparison = async (req, res) => {
  try {
    if (!["doctor", "admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Bạn không có quyền xem dữ liệu so sánh.", 403);
    }

    const { patientId } = req.params;
    const user = await User.findById(patientId).lean();
    if (!user) return errorResponse(res, "Không tìm thấy bệnh nhân.", 404);

    // Tìm tất cả ImagingResult của bệnh nhân (qua medicalId)
    const medicalId = user.profile?.medicalId;
    if (!medicalId) return errorResponse(res, "Bệnh nhân chưa có mã y tế.", 400);

    const results = await ImagingResult.find({ medicalId })
      .sort({ orderDate: 1 })
      .select("orderDate procedure aiReport representativeSliceUrl isSigned signedAt")
      .lean();

    if (results.length < 2) {
      return successResponse(res, {
        count: results.length,
        message: "Cần ít nhất 2 lần chụp để so sánh.",
        results,
      }, "Chưa đủ dữ liệu để so sánh.");
    }

    // G.6 — Tạo dữ liệu trend chart (thể tích u, midline shift theo thời gian)
    const trendData = results.map((r) => ({
      date: r.orderDate,
      imagingResultId: r._id,
      representativeSliceUrl: r.representativeSliceUrl,
      tumorVolumeCm3: r.aiReport?.tumorVolumeCm3 || null,
      midlineShiftMm: r.aiReport?.midlineShiftMm || null,
      malignancyLevel: r.aiReport?.malignancyLevel || null,
      isSigned: r.isSigned,
    }));

    return successResponse(res, {
      patientId,
      medicalId,
      count: results.length,
      trendData,
      // Cặp so sánh gần nhất
      latestPair: {
        first: results[results.length - 2],
        second: results[results.length - 1],
      },
    }, "Lấy dữ liệu so sánh follow-up thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── D.4 — Theo dõi caseload bác sĩ real-time ────────────────────────────────
// @route GET /api/v1/clinical-view/doctor-caseloads
// @access Private (Doctor, Admin — trưởng khoa)
export const getDoctorCaseloads = async (req, res) => {
  try {
    if (!["doctor", "admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Bạn không có quyền xem caseload.", 403);
    }

    const hospitalId = req.user.hospitalId;

    // Lấy tất cả bác sĩ trong bệnh viện đang trực
    const doctors = await User.find({
      hospitalId,
      role: "doctor",
      isLocked: false,
    }).select("profile.name profile.specialty profile.isOnCall profile.currentCaseload profile.maxCaseload").lean();

    const caseloads = doctors.map((d) => ({
      doctorId: d._id,
      name: d.profile?.name,
      specialty: d.profile?.specialty,
      isOnCall: d.profile?.isOnCall || false,
      currentCaseload: d.profile?.currentCaseload || 0,
      maxCaseload: d.profile?.maxCaseload || 10,
      isOverloaded: (d.profile?.currentCaseload || 0) > (d.profile?.maxCaseload || 10),
      utilizationPercent: d.profile?.maxCaseload
        ? Math.round(((d.profile?.currentCaseload || 0) / d.profile.maxCaseload) * 100)
        : 0,
    }));

    const overloadedDoctors = caseloads.filter((d) => d.isOverloaded);

    return successResponse(res, {
      total: caseloads.length,
      onCall: caseloads.filter((d) => d.isOnCall).length,
      overloaded: overloadedDoctors.length,
      caseloads,
      warnings: overloadedDoctors.map((d) => `Bác sĩ ${d.name} (${d.specialty}) đang quá tải: ${d.currentCaseload}/${d.maxCaseload} ca`),
    }, "Lấy caseload bác sĩ thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};
