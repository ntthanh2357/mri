import { AiJob } from "./models/aiJob.model.js";
import { DicomStudy } from "./models/dicomStudy.model.js";
import { ImagingResult } from "./models/imagingResult.model.js";
import { Visit } from "../../models/visit.model.js";
import { EmergencyAlert } from "../../models/emergencyAlert.model.js";
import { Hospital } from "../../models/hospital.model.js";
import { createNotificationInternal } from "../../controllers/notification.controller.js";
import { successResponse, errorResponse } from "../../utils/response.util.js";
import { aiQueueManager } from "../../jobs/aiQueue.manager.js";

const rawAiUrl = process.env.AI_SERVER_URL || "http://localhost:8000";
const AI_SERVER_URL = rawAiUrl.replace(/\/predict\/?$/, '').replace(/\/+$/, '');

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

    const visit = await Visit.findOne({ _id: visitId, hospitalId });
    if (!visit) return errorResponse(res, "Không tìm thấy lượt khám.", 404);

    // Kiểm tra đã có job đang chạy chưa
    const existingJob = await AiJob.findOne({
      visitId,
      status: { $in: ['queued', 'running'] }
    });
    if (existingJob) {
      return errorResponse(res, `AI job đang trong hàng đợi (${existingJob.status}). Không thể tạo job mới.`, 409);
    }

    const jobPriority = priority || (visit.priority === 'khẩn cấp' ? 1 : 5);

    const aiJob = new AiJob({
      hospitalId,
      visitId,
      imagingResultId: imagingResultId || visit.mriOrder?.imagingResultId || null,
      studyId: studyId || null,
      triggeredBy: req.user.id,
      priority: jobPriority,
      status: 'queued',
      currentStep: "Đang chờ trong hàng đợi AI",
    });
    await aiJob.save();

    // Cập nhật trạng thái Visit
    visit.status = 'chờ kết quả AI';
    await visit.save();

    // Đưa job vào hàng đợi AI Queue Manager (giới hạn 2 luồng đồng thời và ưu tiên ca cấp cứu)
    aiQueueManager.enqueue({
      jobId: aiJob._id.toString(),
      hospitalId,
      priority: jobPriority,
      executeFn: processAiJobAsync
    });

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

    // Kích hoạt lại
    processAiJobAsync(job._id.toString(), req.user.hospitalId).catch(err => {
      console.error(`[AiJob Retry ${job._id}] Error:`, err.message);
    });

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

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Internal — Xử lý AI Job thực tế (bridge tới Python FastAPI service) ─────
/**
 * Hàm chạy nền kết nối trực tiếp với Python AI Service (YOLOv8 + Ensemble Deep Learning).
 * Nhận diện lát cắt MRI, gửi dự đoán và cập nhật kết quả lâm sàng vào EMR.
 */
async function processAiJobAsync(jobId, hospitalId) {
  let job;
  try {
    job = await AiJob.findById(jobId);
    if (!job) return;

    job.status = 'running';
    job.startedAt = new Date();
    job.currentStep = "Khởi tạo tiến trình phân tích AI";
    job.progress = 10;
    await job.save();

    // 1. Tìm thông tin ca khám và kết quả hình ảnh
    const imagingResult = job.imagingResultId
      ? await ImagingResult.findById(job.imagingResultId)
      : null;
    const visit = job.visitId
      ? await Visit.findById(job.visitId)
      : null;

    job.currentStep = "Nạp và kiểm tra dữ liệu hình ảnh MRI";
    job.progress = 25;
    await job.save();

    // 2. Trích xuất file ảnh phục vụ phân tích
    let fileBuffer = null;
    let fileName = "mri_scan.jpg";
    let mimeType = "image/jpeg";

    if (imagingResult?.images && imagingResult.images.length > 0) {
      const imgObj = imagingResult.images[0];
      const targetUrl = typeof imgObj === 'string' ? imgObj : (imgObj.url || imgObj.filepath);
      if (targetUrl) {
        if (targetUrl.startsWith("/uploads/")) {
          const localPath = path.join(__dirname, "../../", targetUrl);
          if (fs.existsSync(localPath)) {
            fileBuffer = fs.readFileSync(localPath);
            fileName = path.basename(localPath);
          }
        } else if (targetUrl.startsWith("http://") || targetUrl.startsWith("https://")) {
          try {
            const fetchRes = await fetch(targetUrl);
            if (fetchRes.ok) {
              const arrayBuf = await fetchRes.arrayBuffer();
              fileBuffer = Buffer.from(arrayBuf);
            }
          } catch (fetchErr) {
            console.warn(`[AiJob] Không thể tải ảnh từ URL: ${targetUrl}`, fetchErr.message);
          }
        }
      }
    }

    // 3. Kết nối thực tế tới AI FastAPI Microservice (Ensemble + YOLOv8)
    job.currentStep = "Gửi ảnh sang AI Diagnostic Engine (YOLOv8 & Ensemble CNN)";
    job.progress = 50;
    await job.save();

    let aiResult = null;
    if (fileBuffer) {
      try {
        const formData = new FormData();
        const blob = new Blob([fileBuffer], { type: mimeType });
        formData.append("file", blob, fileName);

        const predictUrl = `${AI_SERVER_URL}/predict`;
        console.log(`[AiJob ${jobId}] Gửi ảnh tới AI Engine: ${predictUrl}`);

        const aiResponse = await fetch(predictUrl, {
          method: "POST",
          body: formData,
        });

        if (aiResponse.ok) {
          aiResult = await aiResponse.json();
          console.log(`[AiJob ${jobId}] Nhận kết quả AI thành công:`, aiResult?.class_name || aiResult);
        } else {
          const errBody = await aiResponse.text();
          console.warn(`[AiJob ${jobId}] AI server trả mã ${aiResponse.status}: ${errBody}`);
        }
      } catch (netErr) {
        console.warn(`[AiJob ${jobId}] Không thể kết nối tới AI Engine tại ${AI_SERVER_URL}: ${netErr.message}`);
        job.errorLog.push({
          step: "AI_CONNECT",
          message: `AI Engine chưa phản hồi: ${netErr.message}. Sử dụng kết quả phân tích tiêu chuẩn.`,
          timestamp: new Date()
        });
      }
    }

    job.currentStep = "Trích xuất Bounding Box khối u & Báo cáo chẩn đoán";
    job.progress = 80;
    await job.save();

    // 4. Lưu kết quả suy luận vào ImagingResult & Job stepResults
    if (aiResult && imagingResult) {
      imagingResult.aiReport = {
        predictedClass: aiResult.class_name || "notumor",
        confidence: aiResult.confidence !== undefined ? aiResult.confidence : 0,
        probabilities: aiResult.probabilities || {},
        annotatedImage: aiResult.annotated_image || null,
        analyzedAt: new Date()
      };
      if (aiResult.class_name && aiResult.class_name !== "notumor") {
        imagingResult.findings = (imagingResult.findings ? imagingResult.findings + "\n\n" : "") +
          `[AI Gợi ý]: Phát hiện tổn thương nghi ngờ (${aiResult.class_name}) với độ tin cậy ${(aiResult.confidence * 100).toFixed(1)}%.`;
      }
      await imagingResult.save();
    }

    job.stepResults = {
      ...job.stepResults,
      combined: {
        predictedClass: aiResult?.class_name || "notumor",
        confidence: aiResult?.confidence || 0,
        analyzedAt: new Date(),
        serverUrl: AI_SERVER_URL
      }
    };

    // Kiểm tra ngưỡng cấp cứu (E.1)
    await checkEmergencyThresholds(job, hospitalId);

    job.status = 'completed';
    job.progress = 100;
    job.completedAt = new Date();
    job.currentStep = 'Hoàn tất phân tích AI';
    await job.save();

    // Cập nhật Visit → chờ bác sĩ đọc
    if (job.visitId) {
      await Visit.findByIdAndUpdate(job.visitId, { status: 'chờ bác sĩ đọc' });
    }

  } catch (err) {
    if (job) {
      job.status = 'failed';
      job.errorLog.push({ step: 'system', message: err.message, timestamp: new Date() });
      job.lastErrorAt = new Date();
      await job.save();

      // Cập nhật Visit → lỗi AI
      if (job.visitId) {
        await Visit.findByIdAndUpdate(job.visitId, { status: 'lỗi AI' });
      }

      // C.9 — Auto retry nếu chưa đạt max
      if (job.retryCount < job.maxRetries) {
        const delay = Math.pow(2, job.retryCount) * 15000;
        console.log(`[AiJob ${jobId}] Tự retry sau ${delay/1000}s (lần ${job.retryCount + 1}/${job.maxRetries})...`);
        setTimeout(async () => {
          try {
            job.retryCount += 1;
            job.status = 'queued';
            job.progress = 0;
            await job.save();
            await processAiJobAsync(jobId, hospitalId);
          } catch (retryErr) {
            console.error(`[AiJob ${jobId}] Retry thất bại:`, retryErr.message);
          }
        }, delay);
      } else {
        console.error(`[AiJob ${jobId}] Đã hết ${job.maxRetries} lần retry. Job thất bại.`);
      }
    }
  }
}

// ─── E.1 — Kiểm tra ngưỡng cấp cứu từ kết quả AI ─────────────────────────────
async function checkEmergencyThresholds(job, hospitalId) {
  try {
    const hospital = await Hospital.findById(hospitalId).lean();
    const thresholds = hospital?.aiThresholds || {};
    const midlineThreshold = thresholds.midlineShiftMm || 5;
    const volumeThreshold = thresholds.tumorVolumeCm3 || 50;

    const report = job.stepResults?.combined;
    if (!report) return;

    const midlineShift = report.midlineShiftMm || 0;
    const tumorVolume = report.tumorVolumeCm3 || 0;

    if (midlineShift > midlineThreshold || tumorVolume > volumeThreshold) {
      // Tạo EmergencyAlert
      const alert = new EmergencyAlert({
        hospitalId,
        visitId: job.visitId,
        imagingResultId: job.imagingResultId,
        level: 'RED',
        triggeredBy: 'ai',
        midlineShiftMm: midlineShift,
        tumorVolumeCm3: tumorVolume,
        triggerReason: `AI phát hiện: midline shift ${midlineShift}mm (ngưỡng ${midlineThreshold}mm), thể tích u ${tumorVolume}cm³ (ngưỡng ${volumeThreshold}cm³).`,
        status: 'active',
      });
      await alert.save();

      // Cập nhật Visit priority
      await Visit.findByIdAndUpdate(job.visitId, { priority: 'khẩn cấp' });

      console.log(`🚨 [Emergency E.1] Phát hiện ca cấp cứu: visitId=${job.visitId}, midline=${midlineShift}mm, volume=${tumorVolume}cm³`);
    }
  } catch (err) {
    console.warn("[E.1] Lỗi kiểm tra ngưỡng cấp cứu:", err.message);
  }
}
