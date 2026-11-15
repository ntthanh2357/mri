import { AiJob } from "./models/aiJob.model.js";
import { ImagingResult } from "./models/imagingResult.model.js";
import { Visit } from "../../models/visit.model.js";
import { EmergencyAlert } from "../../models/emergencyAlert.model.js";
import { Hospital } from "../../models/hospital.model.js";
import { successResponse, errorResponse } from "../../utils/response.util.js";
import { aiQueueManager } from "../../jobs/aiQueue.manager.js";
import { tenantStorage } from "../../middlewares/tenant.middleware.js";
import { executeAiPredictionInternal, AI_DOCTOR_READ_FROM_STATUSES } from "./imaging.controller.js";
import { buildAiReport, applyAiResultToImaging, markAiAnalysisFailed } from "./aiResult.util.js";
import { applyMultiSliceAiResultToImaging } from "./multiSliceAi.util.js";
import { analyzeMultipleSlicesInternal } from "./multiSliceRunner.service.js";

const isObjectId = (v) => /^[a-f\d]{24}$/i.test(String(v || ""));

/**
 * Đưa AI job vào hàng đợi xử lý (giới hạn luồng đồng thời, ưu tiên ca cấp cứu).
 * Dùng chung cho kích hoạt thủ công và upload DICOM (trước đây upload DICOM tạo job nhưng không bao giờ xếp hàng).
 */
export const enqueueAiPipelineJob = (aiJob) =>
  aiQueueManager.enqueue({
    jobId: aiJob._id.toString(),
    hospitalId: aiJob.hospitalId,
    priority: aiJob.priority || 5,
    executeFn: processAiJobAsync,
  });

// ─── C.8 — Kích hoạt AI Job (thường qua DICOM upload, hoặc thủ công) ─────────
// @route POST /api/v1/ai-pipeline/trigger
// @access Private (Technician, Doctor, Admin)
export const triggerAiJob = async (req, res) => {
  try {
    if (!["technician", "doctor", "admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Bạn không có quyền kích hoạt AI pipeline.", 403);
    }

    const hospitalId = req.user.hospitalId;
    const { visitId, studyId, imagingResultId, priority } = req.body;

    if (!visitId) return errorResponse(res, "Thiếu visitId.", 400);
    if (!isObjectId(visitId) || (imagingResultId && !isObjectId(imagingResultId))) {
      return errorResponse(res, "Mã lượt khám hoặc mã kết quả chụp không hợp lệ.", 400);
    }

    const visit = await Visit.findOne({ _id: visitId, hospitalId });
    if (!visit) return errorResponse(res, "Không tìm thấy lượt khám.", 404);

    // Kết quả chụp phải thuộc ĐÚNG lượt khám và viện này (trước đây nhận mã tùy ý: AI có thể ghi vào hồ sơ khác)
    const targetImagingId = imagingResultId || visit.mriOrder?.imagingResultId || null;
    const imaging = targetImagingId
      ? await ImagingResult.findOne({ _id: targetImagingId, hospitalId, visitId: visit._id }).select("images isSigned").lean()
      : null;
    if (!imaging) return errorResponse(res, "Lượt khám chưa có kết quả chụp để phân tích AI.", 404);
    if (!imaging.images?.length) return errorResponse(res, "Kết quả chụp chưa có ảnh lát cắt để phân tích AI.", 400);
    if (imaging.isSigned) return errorResponse(res, "Báo cáo đã ký: không chạy lại AI ghi vào báo cáo.", 409);

    // Kiểm tra đã có job đang chạy chưa
    const existingJob = await AiJob.findOne({
      visitId,
      status: { $in: ['queued', 'running'] }
    });
    if (existingJob) {
      return errorResponse(res, `AI job đang trong hàng đợi (${existingJob.status}). Không thể tạo job mới.`, 409);
    }

    const jobPriority = Number(priority) >= 1 && Number(priority) <= 5 ? Number(priority) : (visit.priority === 'khẩn cấp' ? 1 : 5);

    const aiJob = new AiJob({
      hospitalId,
      visitId,
      imagingResultId: imaging._id,
      studyId: studyId || null,
      triggeredBy: req.user.id,
      priority: jobPriority,
      status: 'queued',
      currentStep: "Đang chờ trong hàng đợi AI",
    });
    await aiJob.save();
    await ImagingResult.updateOne({ _id: imaging._id, hospitalId, isSigned: { $ne: true } }, { $set: { aiJobId: aiJob._id, aiStatus: "pending", aiError: "" } });

    // Cập nhật trạng thái Visit
    visit.status = 'chờ kết quả AI';
    await visit.save();

    enqueueAiPipelineJob(aiJob);

    return successResponse(res, { aiJob, queue: aiQueueManager.getStats() }, "AI job đã được tạo và đang chờ xử lý trong hàng đợi.", 201);
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── C.8 — Lấy tiến trình AI Job ─────────────────────────────────────────────
// @route GET /api/v1/ai-pipeline/jobs/:jobId/progress
// @access Private
export const getJobProgress = async (req, res) => {
  try {
    const job = await AiJob.findOne({
      _id: req.params.jobId,
      hospitalId: req.user.hospitalId
    });
    if (!job) return errorResponse(res, "Không tìm thấy AI job.", 404);

    return successResponse(res, {
      jobId: job._id,
      status: job.status,
      progress: job.progress,
      currentStep: job.currentStep,
      estimatedSecondsLeft: job.estimatedSecondsLeft,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      retryCount: job.retryCount,
      errorLog: job.errorLog,
    }, "Lấy tiến trình AI thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── C.4 — Lấy báo cáo AI tổng hợp ──────────────────────────────────────────
// @route GET /api/v1/ai-pipeline/jobs/:jobId/report
// @access Private (Doctor, Admin)
export const getAiReport = async (req, res) => {
  try {
    const job = await AiJob.findOne({
      _id: req.params.jobId,
      hospitalId: req.user.hospitalId
    });
    if (!job) return errorResponse(res, "Không tìm thấy AI job.", 404);
    if (job.status !== 'completed') {
      return errorResponse(res, `AI job chưa hoàn thành (trạng thái: ${job.status}).`, 400);
    }

    // Lấy kết quả từ ImagingResult
    const imagingResult = job.imagingResultId
      ? await ImagingResult.findById(job.imagingResultId)
      : null;

    return successResponse(res, {
      jobId: job._id,
      stepResults: job.stepResults,
      aiReport: imagingResult?.aiReport || null,
      representativeSliceUrl: imagingResult?.representativeSliceUrl || null,
      top5SlicesUrls: imagingResult?.top5SlicesUrls || [],
      segmentationUrl: imagingResult?.segmentationUrl || null,
      model3dUrl: imagingResult?.model3dUrl || null,
      completedAt: job.completedAt,
    }, "Lấy báo cáo AI thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── C.9 — Retry AI Job thất bại ─────────────────────────────────────────────
// @route POST /api/v1/ai-pipeline/jobs/:jobId/retry
// @access Private (Admin, Technician)
export const retryAiJob = async (req, res) => {
  try {
    if (!["technician", "doctor", "admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Bạn không có quyền retry AI job.", 403);
    }

    const job = await AiJob.findOne({
      _id: req.params.jobId,
      hospitalId: req.user.hospitalId
    });
    if (!job) return errorResponse(res, "Không tìm thấy AI job.", 404);
    if (job.status !== 'failed') {
      return errorResponse(res, "Chỉ có thể retry job đã thất bại.", 400);
    }
    if (job.retryCount >= job.maxRetries) {
      return errorResponse(res, `Job đã retry tối đa ${job.maxRetries} lần. Liên hệ admin.`, 400);
    }

    job.status = 'queued';
    job.retryCount += 1;
    job.currentStep = `Retry lần ${job.retryCount}/${job.maxRetries}`;
    job.progress = 0;
    job.lastErrorAt = new Date();
    await job.save();

    enqueueAiPipelineJob(job);

    return successResponse(res, { job }, `Đã tạo lại AI job (lần retry ${job.retryCount}).`);
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── Lấy danh sách AI Jobs của bệnh viện ────────────────────────────────────
// @route GET /api/v1/ai-pipeline/jobs
// @access Private (Admin, Doctor)
export const getAiJobs = async (req, res) => {
  try {
    if (req.user.role === 'patient') return errorResponse(res, "Không có quyền.", 403);
    const { status, limit = 20, page = 1 } = req.query;
    const filter = { hospitalId: req.user.hospitalId };
    if (status) filter.status = status;

    const total = await AiJob.countDocuments(filter);
    const jobs = await AiJob.find(filter)
      .populate("visitId", "patientId status")
      .sort({ queuedAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    return successResponse(res, { jobs, total }, "Lấy danh sách AI jobs thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── Lấy trạng thái giám sát hàng đợi AI Worker Queue ──────────────────────
// @route GET /api/v1/ai-pipeline/queue-stats
// @access Private
export const getAiQueueStats = (req, res) => {
  return successResponse(res, aiQueueManager.getStats(), "Lấy thống kê hàng đợi AI thành công.");
};

// ─── Internal — Xử lý AI Job thực tế (bridge tới Python FastAPI service) ─────
/**
 * Hàng đợi không giữ ngữ cảnh request (job có thể chạy trong ngữ cảnh của request/job khác): luôn chạy job trong
 * đúng ngữ cảnh viện của chính job, để mọi truy vấn có bộ lọc tenancy đúng viện.
 */
async function processAiJobAsync(jobId) {
  const meta = await AiJob.findById(jobId).setOptions({ bypassTenancy: true }).select("hospitalId triggeredBy").lean();
  if (!meta?.hospitalId) return;
  return tenantStorage.run(
    { hospitalId: String(meta.hospitalId), isSuperAdmin: false, role: "technician", userId: String(meta.triggeredBy || "") },
    () => runAiJob(jobId)
  );
}

/**
 * Nạp ảnh của hồ sơ CĐHA → AI service (Ensemble + YOLOv8) → ghi kết quả vào hồ sơ (chỉ khi chưa ký).
 * AI lỗi / không có ảnh → job FAILED (có tự thử lại), lượt khám "lỗi AI", báo bác sĩ ở lần thất bại cuối.
 * Trước đây mọi lỗi đều bị nuốt và job vẫn "completed" với kết quả mặc định "notumor" 0%.
 */
async function runAiJob(jobId) {
  let job;
  try {
    job = await AiJob.findById(jobId);
    if (!job) return;

    job.status = 'running';
    job.startedAt = new Date();
    job.currentStep = "Khởi tạo tiến trình phân tích AI";
    job.progress = 10;
    await job.save();

    // 1. Tìm kết quả hình ảnh của đúng viện
    const imagingResult = job.imagingResultId
      ? await ImagingResult.findOne({ _id: job.imagingResultId, hospitalId: job.hospitalId })
      : null;
    if (!imagingResult) throw new Error("Không tìm thấy kết quả chụp của lượt khám.");

    job.currentStep = "Nạp và kiểm tra dữ liệu hình ảnh MRI";
    job.progress = 25;
    await job.save();

    const targetUrls = (Array.isArray(imagingResult.images) ? imagingResult.images : [])
      .map((item) => (typeof item === "string" ? item : (item?.url || item?.filepath || null)))
      .filter(Boolean);
    if (targetUrls.length === 0) throw new Error("Chưa có ảnh lát cắt để phân tích AI.");

    // 2. Gửi toàn bộ lát cắt đã chọn sang AI service (Option A: Full Consensus đa lát cắt)
    job.currentStep = `Gửi ${targetUrls.length} lát cắt sang AI Engine (YOLOv8 & Ensemble CNN)`;
    job.progress = 50;
    await job.save();

    const actor = { id: String(job.triggeredBy || ""), hospitalId: String(job.hospitalId), role: "technician" };
    const aiReport = await analyzeMultipleSlicesInternal({
      imageUrls: targetUrls,
      user: actor,
      visitId: null,
      source: "pipeline",
      executeSingleFn: executeAiPredictionInternal,
    });
    if (!aiReport) throw new Error("Không phân tích được lát cắt nào trong bộ ảnh.");

    job.currentStep = "Lưu kết quả AI vào hồ sơ";
    job.progress = 80;
    await job.save();

    // 3. Ghi kết quả (chỉ khi hồ sơ chưa ký)
    const applied = await applyMultiSliceAiResultToImaging({
      imagingResultId: imagingResult._id,
      hospitalId: job.hospitalId,
      multiReport: aiReport,
    });

    job.stepResults = {
      ...job.stepResults,
      combined: {
        predictedClass: aiReport.class_name,
        confidence: aiReport.confidence,
        boundingBox: aiReport.bounding_box,
        appliedToReport: applied.applied,
        analyzedAt: new Date(),
      },
    };

    // Kiểm tra ngưỡng cấp cứu (E.1)
    await checkEmergencyThresholds(job, job.hospitalId);

    job.status = 'completed';
    job.progress = 100;
    job.completedAt = new Date();
    job.currentStep = applied.applied ? 'Hoàn tất phân tích AI' : 'Hoàn tất (báo cáo đã ký — không ghi kết quả AI vào báo cáo)';
    await job.save();

    // Lượt khám đang chờ AI (hoặc đã từng lỗi AI) → chờ bác sĩ đọc
    if (job.visitId) {
      await Visit.updateOne(
        { _id: job.visitId, hospitalId: job.hospitalId, status: { $in: AI_DOCTOR_READ_FROM_STATUSES } },
        { $set: { status: 'chờ bác sĩ đọc' } }
      );
    }
  } catch (err) {
    if (!job) return;
    job.status = 'failed';
    job.errorLog.push({ step: 'AI', message: err.message, timestamp: new Date() });
    job.lastErrorAt = new Date();
    job.currentStep = 'Phân tích AI thất bại';
    await job.save().catch(() => {});

    const willRetry = job.retryCount < job.maxRetries;
    const visit = job.visitId ? await Visit.findOne({ _id: job.visitId, hospitalId: job.hospitalId }).select("doctorId").lean() : null;
    await markAiAnalysisFailed({
      imagingResultId: job.imagingResultId,
      hospitalId: job.hospitalId,
      visitId: job.visitId,
      // Chỉ báo bác sĩ ở lần thất bại cuối (các lần tự thử lại không gửi thông báo trùng)
      doctorId: willRetry ? null : visit?.doctorId,
      reason: err.message,
    }).catch(() => {});

    // C.9 — Auto retry nếu chưa đạt max
    if (willRetry) {
      const delay = Math.pow(2, job.retryCount) * 15000;
      console.log(`[AiJob ${jobId}] Tự retry sau ${delay / 1000}s (lần ${job.retryCount + 1}/${job.maxRetries})...`);
      setTimeout(async () => {
        try {
          const fresh = await AiJob.findOne({ _id: jobId, hospitalId: job.hospitalId, status: 'failed' });
          if (!fresh) return;
          fresh.retryCount += 1;
          fresh.status = 'queued';
          fresh.progress = 0;
          await fresh.save();
          enqueueAiPipelineJob(fresh);
        } catch (retryErr) {
          console.error(`[AiJob ${jobId}] Retry thất bại:`, retryErr.message);
        }
      }, delay).unref?.();
    } else {
      console.error(`[AiJob ${jobId}] Đã hết ${job.maxRetries} lần retry. Job thất bại.`);
    }
  }
}

// ─── E.1 — Kiểm tra ngưỡng cấp cứu từ kết quả AI ─────────────────────────────
// Chỉ kích hoạt khi AI THẬT SỰ trả số đo (lệch đường giữa, thể tích u). Mô hình hiện tại chưa đo các chỉ số này
// nên hàm không tạo cảnh báo nào — không suy diễn số đo.
async function checkEmergencyThresholds(job, hospitalId) {
  try {
    const report = job.stepResults?.combined;
    const midlineShift = Number(report?.midlineShiftMm);
    const tumorVolume = Number(report?.tumorVolumeCm3);
    if (!Number.isFinite(midlineShift) && !Number.isFinite(tumorVolume)) return;

    const hospital = await Hospital.findById(hospitalId).lean();
    const thresholds = hospital?.aiThresholds || {};
    const midlineThreshold = thresholds.midlineShiftMm || 5;
    const volumeThreshold = thresholds.tumorVolumeCm3 || 50;

    if ((Number.isFinite(midlineShift) && midlineShift > midlineThreshold) || (Number.isFinite(tumorVolume) && tumorVolume > volumeThreshold)) {
      const alert = new EmergencyAlert({
        hospitalId,
        visitId: job.visitId,
        imagingResultId: job.imagingResultId,
        level: 'RED',
        triggeredBy: 'ai',
        midlineShiftMm: Number.isFinite(midlineShift) ? midlineShift : null,
        tumorVolumeCm3: Number.isFinite(tumorVolume) ? tumorVolume : null,
        triggerReason: `AI phát hiện: midline shift ${midlineShift}mm (ngưỡng ${midlineThreshold}mm), thể tích u ${tumorVolume}cm³ (ngưỡng ${volumeThreshold}cm³).`,
        status: 'active',
      });
      await alert.save();
      await Visit.updateOne({ _id: job.visitId, hospitalId }, { $set: { priority: 'khẩn cấp' } });
    }
  } catch (err) {
    console.warn("[E.1] Lỗi kiểm tra ngưỡng cấp cứu:", err.message);
  }
}
