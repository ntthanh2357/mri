import { ImagingResult } from "./models/imagingResult.model.js";
import { aiFetch, aiServiceUrl } from "../../utils/aiClient.util.js";
import { getImageDimensions } from "../../utils/imageDimensions.util.js";
import { toInternalFilePath } from "../../utils/internalFile.util.js";
import { checkPatientTenancy } from "../../utils/tenancy.util.js";
import {
  AI_CLASS_NAMES,
  normalizeBoundingBox,
  buildAiReport,
  aiSuggestionText,
  applyAiResultToImaging,
  markAiAnalysisFailed,
} from "./aiResult.util.js";
import {
  applyDoctorSliceOverride,
  applyMultiSliceAiResultToImaging,
} from "./multiSliceAi.util.js";
import { analyzeMultipleSlicesInternal } from "./multiSliceRunner.service.js";
import { buildImagingSignatureMetadata } from "../../utils/imagingSignature.util.js";
import { User } from "../auth/models/user.model.js";
import { Visit } from "../../models/visit.model.js";
import { successResponse, errorResponse } from "../../utils/response.util.js";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createNotificationInternal } from "../../controllers/notification.controller.js";
import { recordAuditLog, AUDIT_ACTIONS } from "../../services/auditLog.service.js";
import { evaluateImagingSignPermission, validateSignReason } from "../../services/imagingSignPolicy.service.js";
import storageService from "../../services/storage/storageService.js";
import { enqueueAiTask } from "../../services/storage/pacsQueue.service.js";
import { loadImageBuffer } from "../../utils/imageSource.util.js";
import { resolveClientImageUrl } from "../../middlewares/uploadSignature.middleware.js";

import { inputErrorStatus } from "../../utils/inputError.util.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Model CĐHA không có patientId nên bộ lọc tenancy của bệnh nhân không bao giờ khớp. Bệnh nhân đọc
// theo medicalId và mọi nơi dùng tùy chọn này phải tự kiểm tra đúng phim của người đang đăng nhập.
const PATIENT_IMAGING_QUERY = { bypassTenancy: true };

const CLINICAL_CONTENT_FIELDS = [
  "findings", "conclusion", "diagnosis", "technique", "structuredReport", "aiReport", "aiAgreement",
  "criticalFinding", "addenda", "attendingAcknowledgment", "acknowledgmentHistory", "images", "top5SlicesUrls",
];
const hideClinicalContentFor = (user, data) => {
  if (user?.role !== "receptionist" || !data) return data;
  const strip = (doc) => {
    const plain = typeof doc?.toObject === "function" ? doc.toObject() : { ...doc };
    for (const field of CLINICAL_CONTENT_FIELDS) delete plain[field];
    return plain;
  };
  return Array.isArray(data) ? data.map(strip) : strip(data);
};

// @desc    Get all imaging results for the logged in patient
// @route   GET /api/v1/imaging/my-results
// @access  Private
export const getPatientResults = async (req, res) => {
  try {
    // 1. Fetch user to get the medicalId
    const user = await User.findById(req.user.id);
    if (!user) {
      return errorResponse(res, "Người dùng không tồn tại.", 404);
    }

    const medicalId = user.profile?.medicalId;
    if (!medicalId) {
      return successResponse(res, [], "Tài khoản chưa được liên kết với Mã y tế (Medical ID) nào.");
    }

    // 2. Query results matching medicalId
    if (req.user.role === "patient") {
      const ownResults = await ImagingResult.find({ medicalId, isSigned: true }, null, PATIENT_IMAGING_QUERY).sort({ reportDate: -1 });
      return successResponse(res, ownResults, "Lấy danh sách kết quả chẩn đoán hình ảnh thành công.");
    }
    const results = await ImagingResult.find(req.user.hospitalId && !["admin", "system_admin", "patient"].includes(req.user.role) ? { medicalId, hospitalId: req.user.hospitalId } : { medicalId }).sort({ reportDate: -1 });
    return successResponse(res, results, "Lấy danh sách kết quả chẩn đoán hình ảnh thành công.");
  } catch (error) {
    console.error("Lỗi khi lấy danh sách kết quả chẩn đoán hình ảnh:", error);
    return errorResponse(res, "Có lỗi xảy ra khi tải dữ liệu.", inputErrorStatus(res, error));
  }
};

// Bác sĩ đọc kết quả để điều trị. Bác sĩ CĐHA là người ký nên không thuộc nhóm này.
const CLINICAL_READER_ROLES = ["doctor", "department_head"];

// @desc    Get detailed imaging result by ID
// @route   GET /api/v1/imaging/:id
// @access  Private
export const getResultById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await ImagingResult.findById(id, null, req.user.role === "patient" ? PATIENT_IMAGING_QUERY : undefined);
    if (!result) {
      return errorResponse(res, "Không tìm thấy kết quả chẩn đoán hình ảnh.", 404);
    }

    // Authorization check: Bệnh nhân chỉ xem kết quả của chính mình; Nhân viên chỉ xem trong cùng viện
    if (req.user.role === "patient") {
      const user = await User.findById(req.user.id);
      if (!user || user.profile?.medicalId !== result.medicalId) {
        return errorResponse(res, "Bạn không có quyền xem kết quả chẩn đoán này.", 403);
      }
      if (result.isSigned !== true) {
        return errorResponse(res, "Kết quả này chưa được bác sĩ ký duyệt.", 403);
      }
    } else if (req.user.role !== "admin") {
      if (req.user.hospitalId && result.hospitalId && req.user.hospitalId.toString() !== result.hospitalId.toString()) {
        return errorResponse(res, "Bạn không có quyền xem kết quả chẩn đoán của cơ sở y tế khác.", 403);
      }
    }

    return successResponse(res, hideClinicalContentFor(req.user, result), "Lấy chi tiết kết quả chẩn đoán hình ảnh thành công.");
  } catch (error) {
    console.error("Lỗi khi lấy chi tiết kết quả chẩn đoán hình ảnh:", error);
    return errorResponse(res, "Có lỗi xảy ra khi tải dữ liệu.", inputErrorStatus(res, error));
  }
};

const buildTriageAiReport = ({ triageAiPreview, metaSlices = [], imageList = [], primaryIdx = 0 }) => {
  const rawPreviewSlices = Array.isArray(triageAiPreview?.sliceResults)
    ? triageAiPreview.sliceResults
    : metaSlices;
  const hasSliceAi = rawPreviewSlices.some((s) => s && (s.class_name || s.predictedClass || s.yoloClass));
  if (!hasSliceAi || imageList.length === 0) return null;

  const normalizeSliceUrl = (url) => (url ? (toInternalFilePath(url) || url) : null);
  const sliceResults = rawPreviewSlices.map((s, idx) => {
    const cls = s.class_name || (s.yoloDetected && s.yoloClass && s.yoloClass !== "notumor" ? s.yoloClass : s.predictedClass) || "notumor";
    const box = cls === "notumor" ? null : (s.bounding_box || s.boundingBox || null);
    return {
      sliceIndex: Number.isInteger(s.sliceIndex) ? s.sliceIndex : idx,
      imageUrl: normalizeSliceUrl(s.imageUrl) || imageList[idx] || "",
      seriesName: s.seriesName || "",
      sequenceType: s.sequenceType || "OTHER",
      plane: s.plane || "unknown",
      sliceNumber: s.sliceNumber ?? null,
      class_name: cls,
      confidence: Number.isFinite(Number(s.confidence)) ? Number(s.confidence) : 0,
      probabilities: s.probabilities || null,
      bounding_box: box,
      heatmapStreamUrl: normalizeSliceUrl(s.heatmapStreamUrl),
      consensus_message: s.consensus_message || s.consensusMessage || null,
      clinical_report: s.clinical_report || s.clinicalReport || null,
      privacy_guard: s.privacy_guard || null,
      clarityScore: s.clarityScore ?? null,
      yoloDetected: Boolean(s.yoloDetected),
      aiTier: s.aiTier || (s.heatmapStreamUrl || s.consensus_message ? "3-tier" : "triage"),
    };
  });

  const tumorSlices = sliceResults.filter((s) => s.class_name && s.class_name !== "notumor");
  const studyDiag = triageAiPreview?.studyDiagnosisSummary || null;
  const folderDomCls =
    studyDiag?.dominantClass && studyDiag.dominantClass !== "notumor" ? studyDiag.dominantClass : null;
  const domMatches = folderDomCls ? tumorSlices.filter((s) => s.class_name === folderDomCls) : [];
  const primaryS = sliceResults[primaryIdx] || tumorSlices[0] || sliceResults[0];
  const bestTumor = (domMatches.length > 0 ? domMatches : tumorSlices).reduce(
    (b, c) => (!b || (c.confidence || 0) > (b.confidence || 0) ? c : b),
    null
  );
  const dom =
    (primaryS && (!folderDomCls || primaryS.class_name === folderDomCls) && primaryS.class_name !== "notumor"
      ? primaryS
      : null) ||
    bestTumor ||
    primaryS;
  const isDeepAi = Boolean(triageAiPreview?.deepAiCompleted || sliceResults.some((s) => s.aiTier === "3-tier"));

  return {
    fromTriage: !isDeepAi,
    deepAiCompleted: isDeepAi,
    class_name: folderDomCls || dom?.class_name || "notumor",
    confidence: dom?.confidence ?? studyDiag?.dominantAvgConfidence ?? 0,
    probabilities: dom?.probabilities || null,
    bounding_box: dom?.bounding_box || null,
    heatmapStreamUrl: dom?.heatmapStreamUrl || null,
    consensus_message: dom?.consensus_message || null,
    clinical_report: dom?.clinical_report || null,
    tumorSliceCount: tumorSlices.length,
    totalSlices: sliceResults.length,
    studyDiagnosisSummary: studyDiag,
    totalAnalyzedInFolder: studyDiag?.totalAnalyzed || triageAiPreview?.totalAnalyzedInFolder || null,
    sliceResults,
    model_info:
      triageAiPreview?.model_info ||
      (isDeepAi
        ? "3-Tier Consensus AI (CNN Ensemble + YOLOv8 + Gemini VLM)"
        : "Full Study AI (3-CNN Ensemble + BayTTA + YOLOv8 + Bounded Gemini VLM)"),
  };
};

// @desc    Create a new imaging result
// @route   POST /api/v1/imaging
// @access  Private (Doctor, Admin only)
export const createImagingResult = async (req, res) => {
  try {
    // [BUG-08 FIX] Destructure req.body TRƯỜC khi dùng medicalId trong role check
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
      triageAiPreview,
    } = req.body;

    // 1. Check roles — kết quả CĐHA là tài liệu y khoa, bệnh nhân không bao giờ được tự tạo (P0-3).
    // Bệnh nhân chỉ được tải tài liệu cá nhân qua module scanned-documents.
    if (!["doctor", "radiologist", "department_head", "technician"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ bác sĩ hoặc kỹ thuật viên hình ảnh mới được tạo kết quả chẩn đoán hình ảnh.", 403);
    }

    // 2. Validate required fields
    if (!medicalId || !patientName || !orderDate || !procedure || !findings || !conclusion || !radiologist || !reportDate || !imagingType) {
      return errorResponse(res, "Vui lòng nhập đầy đủ các trường bắt buộc.", 400);
    }

    // [BUG-KTV-06 FIX]: Tự động khớp lượt khám đang hoạt động nếu visitId không được gửi lên
    let effectiveVisitId = visitId;
    if (!effectiveVisitId && medicalId) {
      const patientUser = await User.findOne({ "profile.medicalId": medicalId });
      if (patientUser) {
        const activeVisit = await Visit.findOne({
          hospitalId: req.user.hospitalId,
          patientId: patientUser._id,
          status: { $in: ["đang chụp", "chờ chụp", "chờ chụp lại", "chờ kết quả AI", "chờ bác sĩ đọc", "đang khám"] }
        }).sort({ createdAt: -1 });
        if (activeVisit) {
          effectiveVisitId = activeVisit._id;
        }
      }
    }

    const imageList = Array.isArray(images) ? images : [];
    const metaSlices = Array.isArray(dicomMetadata?.sliceSeriesMeta) ? dicomMetadata.sliceSeriesMeta : [];
    const primaryIdx = Number.isInteger(dicomMetadata?.primarySliceIndex)
      ? Math.min(Math.max(0, dicomMetadata.primarySliceIndex), Math.max(0, imageList.length - 1))
      : 0;
    const builtTriageAiReport = buildTriageAiReport({
      triageAiPreview,
      metaSlices,
      imageList,
      primaryIdx,
    });

    // 3. Create record
    const newResult = new ImagingResult({
      hospitalId: req.user.hospitalId,
      visitId: effectiveVisitId || null,
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
      images: imageList,
      representativeSliceUrl: imageList[primaryIdx] || imageList[0] || null,
      dicomMetadata: dicomMetadata || {},
      dicomZipUrl: dicomZipUrl || null,
      dicomZipSize: dicomZipSize || null,
      dicomZipFilename: dicomZipFilename || null,
      imagingType,
      ...(builtTriageAiReport ? { aiReport: builtTriageAiReport, aiStatus: "completed" } : {}),
    });

    await newResult.save();

    if (effectiveVisitId) {
      const visit = await Visit.findById(effectiveVisitId);
      if (visit) {
        if (!visit.mriOrder) visit.mriOrder = {};
        visit.mriOrder.imagingResultId = newResult._id;
        visit.status = visit.mriOrder.requestAiAnalysis ? "chờ kết quả AI" : "chờ bác sĩ đọc";
        await visit.save();
      }
    }

    return successResponse(res, newResult, "Tạo kết quả chẩn đoán hình ảnh mới thành công.", 201);
  } catch (error) {
    console.error("Lỗi khi tạo kết quả chẩn đoán hình ảnh:", error);
    return errorResponse(res, "Có lỗi xảy ra khi tạo dữ liệu.", inputErrorStatus(res, error));
  }
};

// @desc    Get imaging results by patient User ID (ObjectId) — fallback for patients without medicalId
// @route   GET /api/v1/imaging/by-patient/:patientId
// @access  Private (Doctor, Admin, Technician, Nurse)
export const getResultsByPatientUserId = async (req, res) => {
  try {
    if (!["doctor", "radiologist", "department_head", "admin", "hospital_admin", "technician", "lab_technician", "nurse", "receptionist", "pharmacist"].includes(req.user.role)) {
      return errorResponse(res, "Bạn không có quyền thực hiện hành động này.", 403);
    }
    const { patientId } = req.params;
    if (!patientId) {
      return errorResponse(res, "Thiếu ID bệnh nhân.", 400);
    }

    // 1. Tìm tất cả visits của bệnh nhân này có imagingResultId
    const visits = await Visit.find({
      patientId,
      "mriOrder.imagingResultId": { $exists: true, $ne: null }
    }).select("mriOrder.imagingResultId").lean();

    if (!visits || visits.length === 0) {
      return successResponse(res, [], "Bệnh nhân chưa có phim chụp nào.");
    }

    const resultIds = visits
      .map(v => v.mriOrder?.imagingResultId)
      .filter(Boolean);

    // 2. Lấy các ImagingResult tương ứng
    const results = await ImagingResult.find({ _id: { $in: resultIds } }).sort({ reportDate: -1 });
    return successResponse(res, results, `Lấy danh sách phim chụp theo patientId thành công.`);
  } catch (error) {
    console.error("Lỗi khi lấy phim theo patientId:", error);
    return errorResponse(res, "Có lỗi xảy ra khi tải dữ liệu.", inputErrorStatus(res, error));
  }
};

// @desc    Get all imaging results for a specific patient by medical ID
// @route   GET /api/v1/imaging/patient/:medicalId
// @access  Private (Doctor, Admin only)
export const getPatientResultsByMedicalId = async (req, res) => {
  try {
    if (!["doctor", "radiologist", "department_head", "admin", "hospital_admin", "technician", "lab_technician", "nurse", "receptionist", "pharmacist"].includes(req.user.role)) {
      return errorResponse(res, "Bạn không có quyền thực hiện hành động này.", 403);
    }
    const { medicalId } = req.params;
    if (!medicalId) {
      return errorResponse(res, "Thiếu Mã y tế bệnh nhân.", 400);
    }
    const results = await ImagingResult.find(req.user.hospitalId && !["admin", "system_admin", "patient"].includes(req.user.role) ? { medicalId, hospitalId: req.user.hospitalId } : { medicalId }).sort({ reportDate: -1 });
    return successResponse(res, hideClinicalContentFor(req.user, results), `Lấy danh sách phim chụp của bệnh nhân mã ${medicalId} thành công.`);
  } catch (error) {
    console.error("Lỗi khi lấy phim của bệnh nhân theo medicalId:", error);
    return errorResponse(res, "Có lỗi xảy ra khi tải dữ liệu.", inputErrorStatus(res, error));
  }
};

// @desc    Upload imaging scan image or DICOM archive (Multipart stream or Base64)
// @route   POST /api/v1/imaging/upload
// @access  Private
// Loại tệp theo đuôi đã được middleware tải lên kiểm tra (danh sách cho phép + magic bytes)
const IMAGE_MIME_BY_EXT = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".bmp": "image/bmp", ".tif": "image/tiff", ".tiff": "image/tiff",
};
const ARCHIVE_MIME_BY_EXT = {
  ".zip": "application/zip", ".rar": "application/vnd.rar", ".7z": "application/x-7z-compressed",
  ".tar": "application/x-tar", ".gz": "application/gzip",
};
// Tải ảnh dạng base64 (ứng dụng di động): chỉ ảnh, đuôi tệp lấy theo loại ảnh thật chứ không theo tên client gửi
const BASE64_IMAGE_TYPES = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/bmp": ".bmp" };
const MAX_BASE64_IMAGE_BYTES = 30 * 1024 * 1024;

export const uploadImagingImage = async (req, res) => {
  // Tệp tạm multer (nằm trong /uploads, bản rõ) luôn bị xóa: thành công thì đã chuyển vào kho mã hóa, lỗi thì bỏ
  let tempPath = req.file?.path || null;
  try {
    // Bệnh nhân gắn kèm tệp phải thuộc phạm vi truy cập của người tải lên
    let patientId = null;
    if (req.body?.patientId) {
      const patient = await checkPatientTenancy(req.body.patientId, req.user);
      if (!patient) return errorResponse(res, "Không tìm thấy bệnh nhân hoặc không có quyền gắn tệp cho bệnh nhân này.", 404);
      patientId = patient._id;
    }
    const common = {
      category: "pacs",
      studyId: req.body?.studyId || req.body?.medicalId || null,
      uploadedBy: req.user?.id,
      hospitalId: req.user?.hospitalId || null,
      patientId,
    };

    let saved;
    let originalName;
    let fileSize;
    let isArchive = false;

    if (req.file) {
      // ── 1. multipart/form-data (multer đã kiểm tra đuôi + magic bytes) ──
      originalName = req.file.originalname;
      fileSize = req.file.size;
      const ext = path.extname(originalName).toLowerCase();
      isArchive = Boolean(ARCHIVE_MIME_BY_EXT[ext]);
      const mimeType = ARCHIVE_MIME_BY_EXT[ext] || IMAGE_MIME_BY_EXT[ext] || "application/octet-stream";
      saved = await storageService.putFromPath({ ...common, fileName: originalName, sourceFilePath: req.file.path, moveFile: true, mimeType });
      tempPath = null;
    } else {
      // ── 2. Base64 JSON (req.body.fileData) — chỉ ảnh ──
      const { fileData, fileName } = req.body || {};
      if (!fileData || typeof fileData !== "string") {
        return errorResponse(res, "Thiếu dữ liệu tệp tin. Vui lòng tải lên tệp tin hợp lệ.", 400);
      }
      const matches = fileData.match(/^data:([A-Za-z0-9.+/-]+);base64,([\s\S]+)$/);
      if (!matches) {
        return errorResponse(res, "Định dạng ảnh Base64 không hợp lệ.", 400);
      }
      const mimeType = matches[1].toLowerCase();
      const ext = BASE64_IMAGE_TYPES[mimeType];
      if (!ext) {
        return errorResponse(res, "Chỉ nhận ảnh JPEG, PNG, WebP hoặc BMP khi tải lên dạng Base64.", 400);
      }
      const imageBuffer = Buffer.from(matches[2], "base64");
      if (imageBuffer.length === 0) return errorResponse(res, "Dữ liệu ảnh trống.", 400);
      if (imageBuffer.length > MAX_BASE64_IMAGE_BYTES) return errorResponse(res, "Ảnh vượt quá dung lượng cho phép (tối đa 30MB).", 413);
      // Nội dung phải đúng là ảnh (đọc được kích thước từ header), không tin loại client khai
      if (!getImageDimensions(imageBuffer)) {
        return errorResponse(res, "Nội dung tệp không phải ảnh hợp lệ.", 400);
      }
      const stem = path.basename(String(fileName || "scan"), path.extname(String(fileName || ""))).replace(/[^a-zA-Z0-9._-]/g, "_") || "scan";
      originalName = `${stem}${ext}`;
      fileSize = imageBuffer.length;
      saved = await storageService.put({ ...common, fileName: originalName, buffer: imageBuffer, mimeType });
    }

    // Đường dẫn chuẩn là tệp trong kho (bản chính mã hóa). Không còn bản rõ trong /uploads hay link công khai Firebase.
    const fileUrl = `/api/v1/storage/files/${saved.fileId}`;
    return successResponse(
      res,
      {
        imageUrl: fileUrl,
        fileUrl,
        streamUrl: fileUrl,
        fileId: saved.fileId,
        sha256: saved.sha256,
        filename: originalName,
        size: fileSize,
        isArchive,
        driveUrl: null,
      },
      isArchive ? "Tải tệp nén DICOM lên thành công." : "Tải ảnh cắt lớp lên thành công."
    );
  } catch (error) {
    console.error("Lỗi khi tải ảnh/tệp lên:", error.message);
    return errorResponse(res, "Có lỗi xảy ra khi lưu tệp tin.", inputErrorStatus(res, error));
  } finally {
    if (tempPath) fs.promises.unlink(tempPath).catch(() => {});
  }
};

// @desc    Helper to execute AI prediction on an image
// Các trạng thái được chuyển sang "chờ bác sĩ đọc" theo ALLOWED_TRANSITIONS của lượt khám
export const AI_DOCTOR_READ_FROM_STATUSES = ["chờ chụp sau phẫu thuật", "đang chụp", "chờ kết quả AI", "lỗi AI"];

const moveVisitToDoctorRead = (visitId, hospitalId) =>
  Visit.updateOne(
    { _id: visitId, hospitalId, status: { $in: AI_DOCTOR_READ_FROM_STATUSES } },
    { $set: { status: "chờ bác sĩ đọc" } }
  );

export const executeAiPredictionInternal = async (imageUrl, user, visitId, options = {}) => {
  const { seriesName = null, skipVisitTransition = false } = options || {};
  // 1. Nạp ảnh qua bộ lọc an toàn: chặn path traversal + SSRF (P0-5)
  const { buffer: fileBuffer, fileName, mimeType } = await loadImageBuffer(imageUrl);
  // Kích thước thật của ảnh gửi đi: AI trả tọa độ khối u theo pixel của chính ảnh này
  const dims = getImageDimensions(fileBuffer);

  // 2. Forward to Python FastAPI server using native fetch and FormData
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append("file", blob, fileName);
  if (seriesName) {
    formData.append("series_hint", String(seriesName));
  }

  const aiPredictUrl = aiServiceUrl("/predict");
  console.log(`📡 Đang gửi ảnh tới AI server (${aiPredictUrl}) ...`);

  const aiResponse = await aiFetch(aiPredictUrl, {
    method: "POST",
    body: formData,
  });

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text();
    console.error("Lỗi từ AI Server:", errorText);
    throw new Error(`AI Server trả về lỗi ${aiResponse.status}: ${errorText || "Mất kết nối hoặc dịch vụ AI chưa chạy."}`);
  }

  const aiData = await aiResponse.json();
  if (!aiData || !AI_CLASS_NAMES.includes(aiData.class_name)) {
    // AI service trả {"error": "..."} kèm HTTP 200 khi từ chối ảnh (sai định dạng, mô hình chưa sẵn sàng): nêu rõ lý do
    const err = new Error(
      aiData?.error
        ? `Dịch vụ AI không phân tích được ảnh: ${String(aiData.error).slice(0, 200)}`
        : "Dịch vụ AI trả kết quả không hợp lệ (thiếu nhóm phân loại)."
    );
    err.statusCode = 502;
    throw err;
  }

  // ── Ảnh vùng nghi ngờ (heatmap) AI trả về dạng base64 → lưu vào kho (bản chính mã hóa), trả đường dẫn kho.
  // Trước đây ghi bản rõ vào /uploads, đẩy bản rõ lên Drive, và có nhánh makePublic() trên Firebase.
  if (typeof aiData.annotated_image === "string" && aiData.annotated_image.startsWith("data:image")) {
    const base64Match = aiData.annotated_image.match(/^data:([A-Za-z0-9.+/-]+);base64,([\s\S]+)$/);
    aiData.annotated_image = null;
    if (base64Match) {
      try {
        const imageBuffer = Buffer.from(base64Match[2], "base64");
        const savedHeatmap = await storageService.put({
          category: "pacs",
          studyId: visitId ? String(visitId) : `ai_${Date.now()}`,
          fileName: `ai_heatmap_${aiData.class_name}.jpg`,
          buffer: imageBuffer,
          mimeType: "image/jpeg",
          uploadedBy: user?.id,
          hospitalId: user?.hospitalId || null,
          // Bệnh nhân tự phân tích: ảnh kết quả thuộc về chính bệnh nhân đó
          patientId: user?.role === "patient" ? user.id : null,
        });
        aiData.storageHeatmapFileId = savedHeatmap.fileId;
        aiData.heatmapStreamUrl = `/api/v1/storage/files/${savedHeatmap.fileId}`;
        aiData.annotated_image = aiData.heatmapStreamUrl;
      } catch (storageErr) {
        console.warn("⚠️ [Storage Service] Không thể lưu heatmap AI:", storageErr.message);
        aiData.heatmapError = "Không lưu được ảnh vùng nghi ngờ của AI.";
      }
    }
  }

  // Khung khối u: tọa độ pixel AI trả về → tỉ lệ 0..1 theo kích thước ảnh. Không có tọa độ thì không có khung.
  aiData.image_dimensions = dims;
  aiData.bounding_box = aiData.class_name !== "notumor" ? normalizeBoundingBox(aiData.tumor_location, dims) : null;

  // Gọi thêm dịch vụ sinh báo cáo lâm sàng để mô tả chi tiết kích thước, vị trí và lý thuyết u
  if (aiData.class_name !== "notumor") {
    try {
      const reportResponse = await aiFetch(aiServiceUrl("/generate_clinical_report"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resnet_data: {
            class_name: aiData.class_name,
            confidence: aiData.confidence,
            tumor_location: aiData.tumor_location,
            consensus_message: aiData.consensus_message
          }
        })
      });
      if (reportResponse.ok) {
        const reportData = await reportResponse.json();
        aiData.clinical_report = reportData.draft_report || "";
      }
    } catch (reportErr) {
      console.warn("⚠️ Lỗi sinh báo cáo chi tiết từ FastAPI:", reportErr.message);
    }
  }

  // Bệnh nhân tự phân tích chỉ để tham khảo, không làm thay đổi tiến trình lượt khám
  if (!skipVisitTransition && visitId && user?.hospitalId && user.role !== "patient") {
    await moveVisitToDoctorRead(visitId, user.hospitalId);
  }

  return aiData;
};

// Đường dẫn tệp nội bộ (bỏ origin, chữ ký, query) để so ảnh gửi phân tích với ảnh của hồ sơ
const internalFilePath = (url) => toInternalFilePath(String(url || "").split("?")[0]) || String(url || "");

// @desc    Analyze imaging scan using AI (FastAPI microservice proxy)
// @route   POST /api/v1/imaging/analyze-ai
// @access  Private (Doctor, Technician, Admin only)
export const analyzeImagingResultAI = async (req, res) => {
  try {
    // 1. Check roles
    if (!["doctor", "radiologist", "department_head", "admin", "hospital_admin", "technician", "patient"].includes(req.user.role)) {
      return errorResponse(res, "Bạn không có quyền thực hiện hành động này.", 403);
    }

    const { imageUrl, visitId, imagingResultId } = req.body;
    if (!imageUrl) {
      return errorResponse(res, "Thiếu đường dẫn hình ảnh cần phân tích.", 400);
    }

    if (visitId && !/^[a-f\d]{24}$/i.test(String(visitId))) {
      return errorResponse(res, "Mã lượt khám không hợp lệ.", 400);
    }
    if (imagingResultId && !/^[a-f\d]{24}$/i.test(String(imagingResultId))) {
      return errorResponse(res, "Mã hồ sơ CĐHA không hợp lệ.", 400);
    }

    const resolvedImageUrl = resolveClientImageUrl(req, imageUrl);

    // Nhân viên phân tích ảnh của một hồ sơ CĐHA: máy chủ tự lưu kết quả AI vào hồ sơ (không nhận kết quả AI từ client).
    // Hồ sơ phải cùng viện và ảnh phải thuộc hồ sơ đó. Bệnh nhân tự phân tích chỉ để tham khảo, không lưu.
    let target = null;
    if (imagingResultId && req.user.role !== "patient") {
      target = await ImagingResult.findOne({ _id: imagingResultId, hospitalId: req.user.hospitalId }).select("images isSigned").lean();
      if (!target) return errorResponse(res, "Không tìm thấy hồ sơ CĐHA.", 404);
      const ownImages = new Set((target.images || []).map(internalFilePath));
      if (!ownImages.has(internalFilePath(resolvedImageUrl))) {
        return errorResponse(res, "Ảnh cần phân tích không thuộc hồ sơ CĐHA này.", 400);
      }
    }

    const seriesHint = typeof req.body?.seriesName === "string" ? req.body.seriesName : null;
    const aiData = await executeAiPredictionInternal(resolvedImageUrl, req.user, visitId, { seriesName: seriesHint });

    if (target) {
      if (target.isSigned) {
        aiData.persisted = false;
        aiData.persistNote = "Báo cáo đã ký: kết quả AI không được ghi vào hồ sơ.";
      } else {
        const singleReport = buildAiReport(aiData, { dims: aiData.image_dimensions, source: "manual", analyzedBy: req.user.id });
        let reportToPersist = singleReport;
        let repUrlToPersist = aiData.heatmapStreamUrl || null;

        // Giữ nguyên danh sách sliceResults nếu hồ sơ đã phân tích nhiều lát cắt, chỉ cập nhật lát đang chạy lại.
        const existingSlices = Array.isArray(target.aiReport?.sliceResults) ? target.aiReport.sliceResults : null;
        if (existingSlices && existingSlices.length > 0) {
          const targetPath = internalFilePath(resolvedImageUrl);
          const clonedReport = JSON.parse(JSON.stringify(target.aiReport));
          let matchIdx = clonedReport.sliceResults.findIndex((s) => internalFilePath(s?.imageUrl) === targetPath);
          if (matchIdx < 0 && Number.isInteger(Number(req.body?.sliceIndex))) {
            const reqIdx = Number(req.body.sliceIndex);
            if (reqIdx >= 0 && reqIdx < clonedReport.sliceResults.length) matchIdx = reqIdx;
          }
          const updatedSlice = {
            ...(matchIdx >= 0 ? clonedReport.sliceResults[matchIdx] : {}),
            sliceIndex: matchIdx >= 0 ? (clonedReport.sliceResults[matchIdx]?.sliceIndex ?? matchIdx) : clonedReport.sliceResults.length,
            imageUrl: targetPath,
            class_name: singleReport.class_name,
            confidence: singleReport.confidence,
            probabilities: singleReport.probabilities || null,
            tumor_location: singleReport.class_name === "notumor" ? null : (singleReport.tumor_location || null),
            bounding_box: singleReport.class_name === "notumor" ? null : (singleReport.bounding_box || null),
            heatmapStreamUrl: singleReport.heatmapStreamUrl || null,
            clinical_report: singleReport.clinical_report || null,
            consensus_message: singleReport.consensus_message || null,
            privacy_guard: singleReport.privacy_guard || null,
            error: null,
          };
          if (matchIdx >= 0) {
            clonedReport.sliceResults[matchIdx] = updatedSlice;
          } else {
            clonedReport.sliceResults.push(updatedSlice);
          }
          reportToPersist = clonedReport;
          repUrlToPersist = target.representativeSliceUrl || singleReport.heatmapStreamUrl || null;
        }

        const applied = await applyAiResultToImaging({
          imagingResultId: target._id,
          hospitalId: req.user.hospitalId,
          aiReport: reportToPersist,
          representativeSliceUrl: repUrlToPersist,
        });
        aiData.persisted = applied.applied;
        if (!applied.applied) aiData.persistNote = "Báo cáo đã ký: kết quả AI không được ghi vào hồ sơ.";
      }
    }
    return successResponse(res, aiData, "Phân tích AI hoàn tất thành công.");
  } catch (error) {
    if (error.statusCode) return errorResponse(res, error.message, error.statusCode);
    console.error("Lỗi khi phân tích AI:", error);
    return errorResponse(
      res,
      `Không thể hoàn thành phân tích AI: ${error.message}. Hãy đảm bảo dịch vụ AI FastAPI đã được khởi chạy trên cổng 8000.`,
      500
    );
  }
};

// @desc    Submit doctor feedback on AI results (glioma, meningioma, pituitary, no_tumor)
// @route   POST /api/v1/imaging/feedback-ai
// @access  Private (Doctor, Technician, Admin only)
export const feedbackImagingResultAI = async (req, res) => {
  try {
    if (!["doctor", "radiologist", "department_head", "admin", "hospital_admin", "technician"].includes(req.user.role)) {
      return errorResponse(res, "Bạn không có quyền thực hiện hành động này.", 403);
    }

    const {
      imageUrl,
      correct_class,
      x,
      y,
      w,
      h,
      normalizedBox = null,
      imagingResultId = null,
      sliceIndex = null,
      note = "",
      agreementStatus = "modified",
    } = req.body;
    if (!imageUrl || !correct_class) {
      return errorResponse(res, "Thiếu thông tin hình ảnh hoặc kết quả chẩn đoán điều chỉnh.", 400);
    }
    if (!AI_CLASS_NAMES.includes(correct_class)) {
      return errorResponse(res, `Nhóm phân loại không hợp lệ. Chỉ nhận: ${AI_CLASS_NAMES.join(", ")}.`, 400);
    }

    const hasResultId = Boolean(imagingResultId && /^[a-f\d]{24}$/i.test(String(imagingResultId)));
    let targetRecord = null;
    if (imagingResultId) {
      if (!hasResultId) {
        return errorResponse(res, "Mã hồ sơ CĐHA không hợp lệ.", 400);
      }
      targetRecord = await ImagingResult.findOne({
        _id: imagingResultId,
        hospitalId: req.user.hospitalId,
      })
        .select("isSigned aiReport aiAgreement images representativeSliceUrl")
        .setOptions({ bypassTenancy: true })
        .lean();

      if (!targetRecord) {
        return errorResponse(res, "Không tìm thấy hồ sơ CĐHA thuộc cơ sở hiện tại.", 404);
      }
      if (targetRecord.isSigned) {
        return errorResponse(res, "Hồ sơ đã được ký số xác nhận, không thể chỉnh sửa kết quả AI.", 409);
      }
    }

    // Nạp ảnh qua bộ lọc an toàn: chặn path traversal + SSRF (P0-5)
    let loaded;
    try {
      loaded = await loadImageBuffer(resolveClientImageUrl(req, imageUrl));
    } catch (loadErr) {
      return errorResponse(res, loadErr.message, loadErr.statusCode || 400);
    }
    const { buffer: fileBuffer, fileName, mimeType } = loaded;
    const ext = path.extname(fileName || "").toLowerCase() || (mimeType === "image/png" ? ".png" : ".jpg");
    const dims = getImageDimensions(fileBuffer);
    const imgW = dims?.width > 0 ? dims.width : 512;
    const imgH = dims?.height > 0 ? dims.height : 512;

    let coords = [x, y, w, h].map((v) => (v === undefined || v === null || v === "" ? 0 : Number(v)));
    if (!coords.every((v) => Number.isInteger(v) && v >= 0 && v <= 100000)) {
      return errorResponse(res, "Tọa độ vùng khoanh không hợp lệ.", 400);
    }

    let normBox = null;
    if (correct_class === "notumor") {
      coords = [0, 0, 0, 0];
      normBox = null;
    } else if (normalizedBox && typeof normalizedBox === "object") {
      const nb = {
        x: Number(normalizedBox.x),
        y: Number(normalizedBox.y),
        w: Number(normalizedBox.width !== undefined ? normalizedBox.width : normalizedBox.w),
        h: Number(normalizedBox.height !== undefined ? normalizedBox.height : normalizedBox.h),
      };
      if (
        !Number.isFinite(nb.x) || !Number.isFinite(nb.y) || !Number.isFinite(nb.w) || !Number.isFinite(nb.h) ||
        nb.x < 0 || nb.y < 0 || nb.w <= 0 || nb.h <= 0 || nb.x + nb.w > 1.02 || nb.y + nb.h > 1.02
      ) {
        return errorResponse(res, "Tọa độ chuẩn hóa vùng khối u không hợp lệ.", 400);
      }
      normBox = {
        x: Number(Math.max(0, Math.min(1, nb.x)).toFixed(4)),
        y: Number(Math.max(0, Math.min(1, nb.y)).toFixed(4)),
        w: Number(Math.max(0.005, Math.min(1 - Math.max(0, nb.x), nb.w)).toFixed(4)),
        h: Number(Math.max(0.005, Math.min(1 - Math.max(0, nb.y), nb.h)).toFixed(4)),
      };
      if (coords[2] === 0 || coords[3] === 0) {
        coords = [
          Math.round(normBox.x * imgW),
          Math.round(normBox.y * imgH),
          Math.max(1, Math.round(normBox.w * imgW)),
          Math.max(1, Math.round(normBox.h * imgH)),
        ];
      }
    } else if (coords[2] > 0 && coords[3] > 0) {
      const nx = Math.max(0, Math.min(0.999, coords[0] / imgW));
      const ny = Math.max(0, Math.min(0.999, coords[1] / imgH));
      const nw = Math.max(0.005, Math.min(1 - nx, coords[2] / imgW));
      const nh = Math.max(0.005, Math.min(1 - ny, coords[3] / imgH));
      normBox = {
        x: Number(nx.toFixed(4)),
        y: Number(ny.toFixed(4)),
        w: Number(nw.toFixed(4)),
        h: Number(nh.toFixed(4)),
      };
    }

    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append("file", blob, fileName);
    formData.append("correct_class", correct_class);
    formData.append("x", String(coords[0]));
    formData.append("y", String(coords[1]));
    formData.append("w", String(coords[2]));
    formData.append("h", String(coords[3]));

    let aiData = {};
    let aiFeedbackSynced = false;
    try {
      const aiResponse = await aiFetch(aiServiceUrl("/feedback"), { method: "POST", body: formData });
      if (aiResponse.ok) {
        aiData = await aiResponse.json();
        aiFeedbackSynced = true;
      } else {
        const errorText = await aiResponse.text().catch(() => "");
        console.warn("⚠️ Lỗi gửi feedback tới AI Server:", errorText);
        if (!targetRecord) {
          return errorResponse(
            res,
            `AI Server trả về lỗi: ${aiResponse.status} - ${errorText || "Mất kết nối hoặc dịch vụ AI chưa chạy."}`,
            502
          );
        }
      }
    } catch (aiConnErr) {
      console.warn("⚠️ Dịch vụ AI /feedback tạm thời không phản hồi:", aiConnErr.message);
      if (!targetRecord) {
        return errorResponse(res, `Không thể gửi phản hồi tới AI: ${aiConnErr.message}`, 502);
      }
    }

    // Lưu ảnh hiệu chỉnh của bác sĩ vào kho (bản chính mã hóa, bản sao Drive mã hóa).
    // Trước đây còn đẩy bản RÕ lên Drive (03_Doctor_Revisions) và tọa độ + email bác sĩ (05_Metadata_Backups).
    try {
      const corrMime = ext === ".png" ? "image/png" : "image/jpeg";
      await storageService.put({
        category: "pacs",
        studyId: req.body.studyId || req.body.medicalId || `correction_${Date.now()}`,
        fileName: `doctor_correction_${correct_class}${ext}`,
        buffer: fileBuffer,
        mimeType: corrMime,
        uploadedBy: req.user?.id,
        hospitalId: req.user?.hospitalId || null,
      });
    } catch (storageErr) {
      console.warn("⚠️ [Storage Service] Không thể lưu doctor correction vào Hybrid PACS:", storageErr.message);
    }

    let persisted = false;
    let overrideMeta = null;
    if (targetRecord && req.user.hospitalId) {
      const resolvedUrl = internalFilePath(imageUrl);
      const { updatedReport, matchedSliceIndex, doctorOverride } = applyDoctorSliceOverride({
        existingReport: targetRecord.aiReport,
        sliceIndex,
        imageUrl: resolvedUrl,
        correctClass: correct_class,
        correctedBox: normBox,
        note,
        userId: req.user.id,
      });

      const agreedStatus = agreementStatus === "rejected" ? "rejected" : "modified";
      const agreementNote = String(note || "").trim() || `Hiệu chỉnh lát #${matchedSliceIndex + 1}: ${correct_class}`;
      const nextAgreement = { status: agreedStatus, note: agreementNote };

      const upd = await ImagingResult.updateOne(
        { _id: imagingResultId, hospitalId: req.user.hospitalId, isSigned: { $ne: true } },
        { $set: { aiReport: updatedReport, aiAgreement: nextAgreement } }
      ).setOptions({ bypassTenancy: true });

      persisted = upd.modifiedCount > 0 || upd.matchedCount > 0;
      overrideMeta = {
        sliceIndex: matchedSliceIndex,
        doctorOverride,
        updatedAiReport: updatedReport,
        aiAgreement: nextAgreement,
      };
    }

    return successResponse(
      res,
      {
        ...aiData,
        aiFeedbackSynced,
        persisted,
        ...(overrideMeta || {}),
      },
      persisted
        ? (aiFeedbackSynced
            ? "Đã lưu hiệu chỉnh của bác sĩ lên lát cắt và đồng bộ huấn luyện AI."
            : "Đã lưu hiệu chỉnh của bác sĩ vào hồ sơ (AI active learning đang ngoại tuyến).")
        : "Ghi nhận phản hồi AI thành công."
    );
  } catch (error) {
    console.error("Lỗi khi gửi phản hồi AI:", error);
    return errorResponse(
      res,
      `Không thể gửi phản hồi tới AI: ${error.message}`,
      500
    );
  }
};

// @desc    Doctor approves AI result as correct (no correction needed)
// @route   POST /api/v1/imaging/approve-ai
// @access  Private (Doctor, Technician, Admin only)
export const approveImagingResultAI = async (req, res) => {
  try {
    if (!["doctor", "radiologist", "department_head", "admin", "hospital_admin", "technician"].includes(req.user.role)) {
      return errorResponse(res, "Bạn không có quyền thực hiện hành động này.", 403);
    }

    const { filename, predicted_class, confidence } = req.body;
    if (!filename || !predicted_class) {
      return errorResponse(res, "Thiếu thông tin tên file hoặc kết quả phân loại AI.", 400);
    }
    if (!AI_CLASS_NAMES.includes(predicted_class)) {
      return errorResponse(res, `Nhóm phân loại không hợp lệ. Chỉ nhận: ${AI_CLASS_NAMES.join(", ")}.`, 400);
    }
    const conf = Number(confidence ?? 0);
    if (!Number.isFinite(conf) || conf < 0 || conf > 100) {
      return errorResponse(res, "Độ tin cậy không hợp lệ.", 400);
    }

    const formData = new FormData();
    formData.append("filename", path.basename(String(filename).split(/[?#]/)[0]));
    formData.append("predicted_class", predicted_class);
    formData.append("confidence", String(conf));

    const aiResponse = await aiFetch(aiServiceUrl("/approve"), { method: "POST", body: formData });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Lỗi gửi approve tới AI Server:", errorText);
      return errorResponse(
        res,
        `AI Server trả về lỗi: ${aiResponse.status} - ${errorText || "Mất kết nối hoặc dịch vụ AI chưa chạy."}`,
        502
      );
    }

    const aiData = await aiResponse.json();
    return successResponse(res, aiData, "Ghi nhận xác nhận kết quả AI đúng thành công.");
  } catch (error) {
    console.error("Lỗi khi gửi xác nhận approve AI:", error);
    return errorResponse(
      res,
      `Không thể gửi xác nhận tới AI: ${error.message}`,
      500
    );
  }
};

// @desc    Explain imaging result in simple, Hippocratic terms for patient
// @route   POST /api/v1/imaging/:id/explain-ai
// @access  Private (Patient, Doctor, Admin)
export const explainImagingResultAI = async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[a-f\d]{24}$/i.test(String(id))) {
      return errorResponse(res, "Không tìm thấy kết quả chẩn đoán.", 404);
    }
    const isPatient = req.user.role === "patient";
    const result = await ImagingResult.findById(id, null, isPatient ? PATIENT_IMAGING_QUERY : undefined);
    if (!result) {
      return errorResponse(res, "Không tìm thấy kết quả chẩn đoán.", 404);
    }

    if (isPatient) {
      const user = await User.findById(req.user.id);
      if (!user || !result.medicalId || user.profile?.medicalId !== result.medicalId) {
        return errorResponse(res, "Bạn không có quyền truy cập hồ sơ này.", 403);
      }
      // Giống GET /imaging/:id: bệnh nhân chỉ xem (và xin giải thích) báo cáo bác sĩ ĐÃ KÝ.
      // Trước đây bản nháp chưa ký (kể cả gợi ý AI chưa được bác sĩ xác nhận) bị gửi đi giải thích cho bệnh nhân.
      if (result.isSigned !== true) {
        return errorResponse(res, "Kết quả này chưa được bác sĩ ký duyệt.", 403);
      }
    } else {
      // Nhân viên y tế phải cùng bệnh viện
      if (result.hospitalId && result.hospitalId.toString() !== req.user.hospitalId?.toString()) {
        return errorResponse(res, "Bạn không có quyền giải thích kết quả phim chụp của bệnh viện khác.", 403);
      }
    }

    const clinicalText = `
      Loại phim chụp: ${result.imagingType}
      Chỉ định dịch vụ: ${result.procedure}
      Mô tả hình ảnh (Findings): ${result.findings}
      Kết luận chẩn đoán (Conclusion): ${result.conclusion}
    `;

    const aiResponse = await aiFetch(aiServiceUrl("/translate_for_patient"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        clinical_report: clinicalText
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Lỗi từ AI Translate Server:", errorText);
      return errorResponse(res, `Không thể dịch kết quả: AI Server phản hồi lỗi ${aiResponse.status}`, 502);
    }

    const aiData = await aiResponse.json();
    if (!aiData?.translated_report) {
      return errorResponse(res, "Dịch vụ AI không trả về bản giải thích. Vui lòng thử lại sau.", 502);
    }
    return successResponse(res, { explanation: aiData.translated_report }, "Giải thích kết quả AI thành công.");
  } catch (error) {
    console.error("Lỗi giải thích kết quả AI:", error);
    return errorResponse(res, `Không thể phân tích hồ sơ: ${error.message}`, inputErrorStatus(res, error));
  }
};

// @desc    Get all imaging results for dashboard
// @route   GET /api/v1/imaging
// @access  Private (Doctor, Admin, Nurse, Technician, Receptionist)
export const getAllImagingResults = async (req, res) => {
  try {
    if (req.user.role === "patient") {
      return errorResponse(res, "Bạn không có quyền truy cập thông tin này.", 403);
    }
    // [BUG-07 FIX] Lọc theo hospitalId — không trả kết quả của bệnh viện khác
    if (!req.user.hospitalId) {
      return errorResponse(res, "Bạn chưa được gán vào bệnh viện nào.", 403);
    }
    const results = await ImagingResult.find({ hospitalId: req.user.hospitalId }).sort({ reportDate: -1 });
    return successResponse(res, results, "Lấy tất cả kết quả chẩn đoán hình ảnh thành công.");
  } catch (error) {
    console.error("Lỗi khi lấy tất cả kết quả chẩn đoán hình ảnh:", error);
    return errorResponse(res, "Có lỗi xảy ra khi tải dữ liệu.", inputErrorStatus(res, error));
  }
};

// @desc    Kỹ thuật viên upload kết quả phim chụp (tạo bản ghi phim chụp và liên kết visit)
// @route   POST /api/v1/imaging-results
// @access  Private (Technician, Admin)
export const createKtvImagingResult = async (req, res) => {
  try {
    if (!["technician", "radiologist", "doctor", "department_head", "hospital_admin"].includes(req.user?.role)) {
      return res.status(403).json({ message: "Chỉ Kỹ thuật viên hoặc Bác sĩ mới được phép tạo kết quả chụp." });
    }

    const {
      visitId,
      patientId,
      imageUrl,
      images,
      techNotes,
      region,
      requestAiAnalysis,
      dicomZipUrl,
      dicomZipSize,
      dicomZipFilename,
      sliceSeriesMeta = [],
      primarySliceIndex = null,
      triageAiPreview = null,
    } = req.body;

    const imageList = Array.isArray(images) && images.length > 0
      ? images.slice(0, 15)
      : (imageUrl ? [imageUrl] : []);

    const normalizedSeriesMeta = Array.isArray(sliceSeriesMeta)
      ? sliceSeriesMeta.map((item) => {
          if (!item || typeof item !== "object") return item;
          const cleanUrl = item.imageUrl ? (toInternalFilePath(item.imageUrl) || item.imageUrl) : item.imageUrl;
          return { ...item, imageUrl: cleanUrl };
        })
      : [];

    if (!visitId || imageList.length === 0) {
      return res.status(400).json({ message: "Thiếu thông tin lượt khám hoặc đường dẫn hình ảnh." });
    }
    // Ảnh phim phải là tệp hệ thống đã tải lên (link đã ký do máy chủ cấp, middleware đã xác minh) — không nhận URL ngoài
    const normalizedImages = imageList.map(toInternalFilePath);
    const normalizedZipUrl = dicomZipUrl ? toInternalFilePath(dicomZipUrl) : null;
    if (normalizedImages.some((u) => !u) || (dicomZipUrl && !normalizedZipUrl)) {
      return res.status(400).json({ message: "Ảnh phim phải là tệp đã tải lên hệ thống." });
    }

    // Lấy thông tin lượt khám
    const visit = await Visit.findById(visitId);
    if (!visit) {
      return res.status(404).json({ message: "Không tìm thấy lượt khám tương ứng." });
    }

    // [SECURITY FIX BUG-IMG-001]: Kiểm tra cô lập bệnh viện (Tenancy check)
    if (!req.user.hospitalId || String(visit.hospitalId) !== String(req.user.hospitalId)) {
      return res.status(403).json({ message: "Không có quyền tạo kết quả chụp cho ca khám của bệnh viện khác." });
    }

    // Bệnh nhân luôn theo lượt khám. Trước đây nhận patientId tùy ý từ client: kết quả chụp của lượt khám này
    // có thể mang tên/mã của một bệnh nhân khác (kể cả viện khác).
    const effectivePatientId = visit.patientId?._id || visit.patientId;
    if (!effectivePatientId) {
      return res.status(400).json({ message: "Không tìm thấy thông tin bệnh nhân trong lượt khám." });
    }
    if (patientId && String(patientId) !== String(effectivePatientId)) {
      return res.status(400).json({ message: "Bệnh nhân không khớp với lượt khám." });
    }

    const patient = await User.findById(effectivePatientId);
    if (!patient) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ người dùng bệnh nhân." });
    }

    // Lấy thông tin bác sĩ chỉ định từ visit
    const doctor = await User.findById(visit.doctorId);
    const doctorName = doctor?.profile?.fullName || doctor?.profile?.name || doctor?.email || "Bác sĩ chỉ định";

    // [FIX-BUG3] Ưu tiên medicalId từ profile, chỉ tự sinh khi thực sự không có
    const patientMedicalId = patient.profile?.medicalId
      || `BN${patient._id.toString().slice(-6).toUpperCase()}`;

    const safePrimaryIdx = Number.isInteger(primarySliceIndex)
      ? Math.min(Math.max(0, primarySliceIndex), Math.max(0, normalizedImages.length - 1))
      : 0;
    const builtTriageAiReport = buildTriageAiReport({
      triageAiPreview,
      metaSlices: normalizedSeriesMeta,
      imageList: normalizedImages,
      primaryIdx: safePrimaryIdx,
    });
    const shouldQueueBgAi = Boolean(requestAiAnalysis && normalizedImages.length > 0 && !builtTriageAiReport);

    // Tạo bản ghi ImagingResult mới với các trường bắt buộc
    const imagingResult = new ImagingResult({
      hospitalId: req.user.hospitalId || visit.hospitalId,
      visitId: visit._id,
      medicalId: patientMedicalId,
      patientName: patient.profile?.fullName || patient.profile?.name || patient.email,
      birthYear: patient.profile?.birthYear || undefined, // chưa có thì để trống
      gender: ["Nam", "Nữ", "Khác"].includes(patient.profile?.gender) ? patient.profile.gender : "", // chưa rõ thì để trống
      address: patient.profile?.address || "",
      orderDate: visit.mriOrder?.orderedAt || new Date(),
      orderingDoctor: doctorName,
      orderingDepartment: "", // khoa chỉ định do bác sĩ chỉ định ghi, không tự gán
      medicalRecordNumber: "BA" + visit._id.toString().substring(18),
      diagnosis: visit.reason || "",
      procedure: "Chụp MRI vùng " + (region || visit.mriOrder?.region || "Não bộ"),
      technique: "Cộng hưởng từ (MRI) " + (region || visit.mriOrder?.region || "Não bộ") + ".", // có/không cản quang do bác sĩ CĐHA ghi
      findings: techNotes ? `Kỹ thuật viên ghi chú: ${techNotes}` : "Chờ bác sĩ đọc mô tả hình ảnh.",
      conclusion: "Chờ kết quả chẩn đoán từ bác sĩ.",
      radiologist: "Chờ bác sĩ CĐHA đọc & ký duyệt",
      isSigned: false,
      reportDate: new Date(),
      images: normalizedImages,
      representativeSliceUrl: normalizedImages[safePrimaryIdx] || normalizedImages[0] || null,
      dicomMetadata: {
        sliceSeriesMeta: normalizedSeriesMeta,
        primarySliceIndex: safePrimaryIdx,
      },
      dicomZipUrl: normalizedZipUrl,
      dicomZipSize: dicomZipSize || null,
      dicomZipFilename: dicomZipFilename || null,
      imagingType: "MRI",
      aiStatus: builtTriageAiReport ? "completed" : (shouldQueueBgAi ? "pending" : ""),
      ...(builtTriageAiReport ? { aiReport: builtTriageAiReport } : {}),
    });

    await imagingResult.save();

    // Liên kết với visit và cập nhật trạng thái an toàn
    if (!visit.mriOrder) visit.mriOrder = {};
    visit.mriOrder.imagingResultId = imagingResult._id;
    visit.status = shouldQueueBgAi ? "chờ kết quả AI" : "chờ bác sĩ đọc";
    await visit.save();

    // ── Gửi thông báo tới Bác sĩ chỉ định ─────────────────────────────────────
    try {
      const patientName = patient.profile?.name || patient.profile?.fullName || "Bệnh nhân";
      await createNotificationInternal({
        hospitalId: visit.hospitalId,
        recipientId: visit.doctorId,
        senderId: req.user.id,
        type: "ai_ready",
        title: "📸 Phim chụp MRI sẵn sàng",
        message: `Phim chụp MRI vùng ${region || "Não bộ"} của bệnh nhân ${patientName} đã được tải lên (${normalizedImages.length} ảnh). ${shouldQueueBgAi ? 'Đang chạy phân tích AI...' : 'Sẵn sàng để bác sĩ đọc kết quả.'}`,
        relatedId: visit._id,
      });
    } catch (notifErr) {
      console.warn("⚠️ Không thể gửi thông báo cho Bác sĩ khi KTV hoàn tất scan:", notifErr.message);
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Tự động chạy phân tích AI ngầm nếu KTV chưa chạy xong ở bước sàng lọc
    if (shouldQueueBgAi) {
      enqueueAiTask({
        priority: visit.priority === "khẩn cấp" ? 1 : 5,
        visitId: visit._id,
        label: `Auto AI Scan (${visit._id})`,
        taskFn: async () => {
        try {
          console.log(`🤖 [Auto AI] Kích hoạt phân tích AI đa lát cắt (${normalizedImages.length} ảnh) cho kết quả ${imagingResult._id}...`);
          const multiReport = await analyzeMultipleSlicesInternal({
            imageUrls: normalizedImages,
            user: req.user,
            visitId: visit._id,
            sliceSeriesMeta: normalizedSeriesMeta,
            primarySliceIndex,
            source: "ktv_auto",
            executeSingleFn: executeAiPredictionInternal,
          });
          if (!multiReport) {
            throw new Error("Không phân tích được lát cắt MRI nào trong bộ ảnh đã chọn.");
          }
          const text = aiSuggestionText(multiReport);
          const tumorCount = multiReport.summary?.tumorDetectedSlices ?? 0;
          const totalAnalyzed = multiReport.summary?.analyzedSlices ?? normalizedImages.length;
          const multiSummaryNote = totalAnalyzed > 1
            ? `\n[Sàng lọc đa lát cắt] Đã phân tích ${totalAnalyzed}/${normalizedImages.length} lát cắt (${tumorCount} lát ghi nhận tín hiệu bất thường).`
            : "";
          const draftFindings = (
            techNotes
              ? `KTV: ${techNotes}\n${text.findingsLine}${multiSummaryNote}\n${multiReport.clinical_report || ""}`
              : `${text.findingsLine}${multiSummaryNote}\n${multiReport.clinical_report || ""}`
          ).trim();
          // Chỉ ghi khi hồ sơ CHƯA KÝ; mô tả/kết luận chỉ điền khi bác sĩ chưa sửa (còn đúng chữ giữ chỗ lúc tạo).
          const applied = await applyMultiSliceAiResultToImaging({
            imagingResultId: imagingResult._id,
            hospitalId: visit.hospitalId,
            multiReport,
            fillDraft: { findings: draftFindings, expectedFindings: imagingResult.findings, conclusion: text.conclusion },
          });
          if (visit.hospitalId && req.user?.role !== "patient") {
            await moveVisitToDoctorRead(visit._id, visit.hospitalId);
          }
          if (applied.applied) {
            console.log(`✅ [Auto AI] Phân tích hoàn tất cho ca ${visit._id}.`);
          } else {
            console.warn(`⚠️ [Auto AI] Kết quả AI về sau khi hồ sơ đã ký (${applied.reason}) — không ghi vào báo cáo.`);
          }
        } catch (autoAiErr) {
          // AI lỗi: ghi nhận trung thực (hồ sơ aiStatus=failed, lượt khám "lỗi AI" vẫn hiện trong hàng đợi, báo bác sĩ)
          console.warn(`⚠️ [Auto AI] Phân tích ngầm không thành công (${autoAiErr.message}).`);
          await markAiAnalysisFailed({
            imagingResultId: imagingResult._id,
            hospitalId: visit.hospitalId,
            visitId: visit._id,
            doctorId: visit.doctorId,
            senderId: req.user.id,
            reason: autoAiErr.message,
          });
        }
        },
      }).catch(() => {});
    }

    res.status(201).json({
      success: true,
      message: "Tạo kết quả phim chụp thành công",
      data: imagingResult
    });
  } catch (error) {
    console.error("Lỗi khi KTV tạo kết quả chụp:", error);
    res.status(inputErrorStatus(res, error)).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

/**
 * Helper: Tính toán tiêu chuẩn RANO (Response Assessment in Neuro-Oncology)
 * dựa trên tích hai đường kính vuông góc lớn nhất (d1 x d2 mm²)
 */
export const computeRanoEvaluation = ({
  d1Mm = 0,
  d2Mm = 0,
  priorCrossProductMm2 = null,
  priorResultId = null,
  radiotherapyEndDate = null
}) => {
  const d1 = Math.max(0, Number(d1Mm) || 0);
  const d2 = Math.max(0, Number(d2Mm) || 0);
  const crossProductMm2 = Math.round(d1 * d2 * 100) / 100;

  let changePercent = null;
  let category = "N/A";

  if (priorCrossProductMm2 !== null && priorCrossProductMm2 !== undefined && Number(priorCrossProductMm2) > 0) {
    const prior = Number(priorCrossProductMm2);
    if (crossProductMm2 === 0) {
      changePercent = -100;
      category = "CR"; // Complete Response
    } else {
      changePercent = Math.round(((crossProductMm2 - prior) / prior) * 1000) / 10;
      if (changePercent <= -50) {
        category = "PR"; // Partial Response (giảm >= 50%)
      } else if (changePercent >= 25) {
        category = "PD"; // Progressive Disease (tăng >= 25%)
      } else {
        category = "SD"; // Stable Disease
      }
    }
  }

  // Kiểm tra giả tiến triển (Pseudoprogression) nếu PD xuất hiện trong vòng 12 tuần (84 ngày) sau xạ trị
  let isPseudoprogressionSuspected = false;
  if (category === "PD" && radiotherapyEndDate) {
    const rtDate = new Date(radiotherapyEndDate);
    if (!isNaN(rtDate.getTime())) {
      const diffDays = (Date.now() - rtDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays >= 0 && diffDays <= 84) {
        isPseudoprogressionSuspected = true;
      }
    }
  }

  return {
    crossProductMm2,
    rano: {
      priorResultId: priorResultId || null,
      priorCrossProductMm2: priorCrossProductMm2 !== null && priorCrossProductMm2 !== undefined ? Number(priorCrossProductMm2) : null,
      changePercent,
      category,
      isPseudoprogressionSuspected,
      radiotherapyEndDate: radiotherapyEndDate ? new Date(radiotherapyEndDate) : null
    }
  };
};

// @desc    Cập nhật kết quả chẩn đoán phim chụp (Bác sĩ đọc phim)
// @route   PUT /api/v1/imaging/:id
// @access  Private (Doctor, Radiologist, Department Head)
export const updateImagingResult = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      findings,
      conclusion,
      radiologist,
      technique,
      images,
      structuredReport,
      aiAgreement,
      criticalFinding,
      actingRadiologistReason
    } = req.body;

    const result = await ImagingResult.findById(id);
    if (!result) {
      return res.status(404).json({ message: "Không tìm thấy kết quả phim chụp." });
    }

    // Tenancy Check
    if (!req.user.hospitalId || (result.hospitalId && result.hospitalId.toString() !== req.user.hospitalId.toString())) {
      return res.status(403).json({ message: "Bạn không có quyền sửa đổi kết quả chụp này." });
    }

    // [P0-2] Báo cáo đã ký là bản ghi pháp lý bất biến: không ghi đè, không "ký lại".
    // Muốn bổ sung phải dùng addendum (bản bổ sung có version riêng).
    if (result.isSigned) {
      return res.status(409).json({
        message: "Báo cáo này đã được ký duyệt và không thể sửa trực tiếp. Vui lòng tạo bản bổ sung (addendum) nếu cần đính chính."
      });
    }

    // [Q-V4-01, Q-V4-11] Đường ký chính của FE: áp cùng thẩm quyền với /clinical-view/.../sign.
    const permission = await evaluateImagingSignPermission({ user: req.user, imaging: result });
    if (!permission.allowed) {
      return res.status(403).json({ code: permission.code, message: permission.message });
    }
    const reasonError = validateSignReason(permission, actingRadiologistReason);
    if (reasonError) return res.status(400).json({ message: reasonError });

    // Bản nháp có sẵn chữ giữ chỗ ("Chờ bác sĩ đọc"), nên kết luận phải có trong chính lần ký này
    if (!String(conclusion || "").trim()) {
      return res.status(400).json({ message: "Vui lòng nhập kết luận trước khi ký báo cáo." });
    }

    // Kiểm tra danh sách ảnh TRƯỚC khi giành quyền ký (lỗi sau bước giành quyền sẽ để lại báo cáo "đã ký" với nội dung cũ).
    // Ảnh đã có trong hồ sơ giữ nguyên (kể cả dữ liệu cũ); ảnh MỚI phải là tệp hệ thống đã tải lên (không nhận URL ngoài).
    let validatedImages = null;
    if (images !== undefined) {
      if (!Array.isArray(images)) {
        return res.status(400).json({ message: "Danh sách ảnh phim không hợp lệ." });
      }
      const existingImages = new Set((result.images || []).map(String));
      validatedImages = [];
      for (const image of images) {
        if (existingImages.has(String(image))) {
          validatedImages.push(image);
          continue;
        }
        const internal = toInternalFilePath(image);
        if (!internal) {
          return res.status(400).json({ message: "Ảnh phim phải là tệp đã tải lên hệ thống." });
        }
        validatedImages.push(internal);
      }
    }

    // Giành quyền ký atomic: 2 bác sĩ ký cùng lúc thì người sau nhận 409, không ghi đè kết luận của người trước
    const claimed = await ImagingResult.updateOne(
      { _id: result._id, isSigned: { $ne: true } },
      { $set: { isSigned: true, signedBy: req.user.id, signedByDoctorId: req.user.id } }
    );
    if (claimed.modifiedCount !== 1) {
      return res.status(409).json({ message: "Báo cáo vừa được ký bởi người khác. Vui lòng tải lại và tạo bản bổ sung nếu cần đính chính." });
    }
    result.isSigned = true;
    result.signMode = permission.mode;
    if (permission.requiresReason) result.actingRadiologistReason = String(actingRadiologistReason).trim();

    // Tên bác sĩ trên báo cáo luôn lấy từ tài khoản đang đăng nhập, không lấy từ body (chống mạo danh).
    const signingDoctorName = req.user.profile?.fullName || req.user.profile?.name || req.user.email || "Bác sĩ CĐHA";
    if (findings !== undefined) result.findings = findings;
    if (conclusion !== undefined) result.conclusion = conclusion;
    // `radiologist` do client gửi lên bị bỏ qua có chủ đích (P0-2).
    result.radiologist = signingDoctorName;
    if (technique !== undefined) result.technique = technique;
    if (validatedImages) result.images = validatedImages;

    // ── Lưu Báo cáo CĐHA u não có cấu trúc (Structured Brain Tumor Report) & tự động tính RANO ──
    if (structuredReport && typeof structuredReport === "object") {
      const d1Mm = Number(structuredReport.measurements?.d1Mm ?? 0);
      const d2Mm = Number(structuredReport.measurements?.d2Mm ?? 0);
      const d3Mm = Number(structuredReport.measurements?.d3Mm ?? 0);

      let priorResultId = structuredReport.rano?.priorResultId || null;
      let priorCrossProductMm2 = structuredReport.rano?.priorCrossProductMm2 ?? null;

      // Nếu chưa truyền priorCrossProductMm2 nhưng có priorResultId hoặc bệnh nhân có phim cũ đã ký -> tự tra cứu
      if (priorCrossProductMm2 === null) {
        try {
          let priorDoc = null;
          if (priorResultId) {
            priorDoc = await ImagingResult.findById(priorResultId).lean();
          } else if (result.medicalId) {
            priorDoc = await ImagingResult.findOne({
              _id: { $ne: result._id },
              hospitalId: result.hospitalId,
              medicalId: result.medicalId,
              isSigned: true
            }).sort({ reportDate: -1, createdAt: -1 }).lean();
          }
          if (priorDoc && priorDoc.structuredReport?.measurements?.crossProductMm2 > 0) {
            priorResultId = priorDoc._id;
            priorCrossProductMm2 = priorDoc.structuredReport.measurements.crossProductMm2;
          }
        } catch { /* ignore */ }
      }

      const { crossProductMm2, rano } = computeRanoEvaluation({
        d1Mm,
        d2Mm,
        priorCrossProductMm2,
        priorResultId,
        radiotherapyEndDate: structuredReport.rano?.radiotherapyEndDate || null
      });

      result.structuredReport = {
        hemisphere: structuredReport.hemisphere || "none",
        lobe: structuredReport.lobe || "none",
        axialLocation: structuredReport.axialLocation || "none",
        measurements: {
          d1Mm,
          d2Mm,
          d3Mm,
          crossProductMm2,
          sliceIndex: Number(structuredReport.measurements?.sliceIndex ?? 0),
          seriesType: structuredReport.measurements?.seriesType || "T1C+"
        },
        enhancement: structuredReport.enhancement || "none",
        peritumoralEdema: structuredReport.peritumoralEdema || "none",
        necrosis: Boolean(structuredReport.necrosis),
        hemorrhage: Boolean(structuredReport.hemorrhage),
        midlineShiftMm: Number(structuredReport.midlineShiftMm ?? 0),
        herniation: structuredReport.herniation || "none",
        hydrocephalus: Boolean(structuredReport.hydrocephalus),
        rano
      };
    }

    // ── Lưu đánh giá đồng thuận AI (AI-Radiologist Concordance) ──
    if (aiAgreement && typeof aiAgreement === "object") {
      result.aiAgreement = {
        status: ["agreed", "modified", "rejected", "unrated"].includes(aiAgreement.status) ? aiAgreement.status : "unrated",
        note: String(aiAgreement.note || "").trim()
      };
    }

    // ── Kiểm tra & kích hoạt Cảnh báo Đỏ CĐHA (Critical Finding Alert - ACR Guideline) ──
    const sr = result.structuredReport || {};
    const autoCriticalReasons = [];
    if (Number(sr.midlineShiftMm) >= 5) {
      autoCriticalReasons.push(`Đẩy lệch đường giữa ${sr.midlineShiftMm} mm (>= 5mm)`);
    }
    if (sr.herniation && sr.herniation !== "none") {
      autoCriticalReasons.push(`Thoát vị não (${sr.herniation})`);
    }
    if (sr.hydrocephalus) {
      autoCriticalReasons.push("Giãn não thất cấp (Hydrocephalus)");
    }
    if (sr.hemorrhage) {
      autoCriticalReasons.push("Xuất huyết nội sọ / trong u cấp tính");
    }

    const isCriticalFlag = Boolean(criticalFinding?.isCritical) || autoCriticalReasons.length > 0;
    if (isCriticalFlag) {
      const reasonText = String(criticalFinding?.reason || autoCriticalReasons.join("; ") || "Phát hiện CĐHA nguy kịch cần xử trí khẩn").trim();
      result.criticalFinding = {
        isCritical: true,
        reason: reasonText,
        notifiedAt: new Date(),
        acknowledgedBy: null,
        acknowledgedByName: "",
        acknowledgedAt: null,
        escalatedAt: null
      };
    }

    result.reportDate = new Date();
    result.isSigned = true;
    result.signedBy = req.user.id;
    result.signedByDoctorId = req.user.id;
    result.signedAt = new Date();

    // [P0-2] Hệ thống hiện chỉ có hạch toàn vẹn nội bộ (SHA-256), KHÔNG phải chữ ký PKI/PAdES.
    result.digitalSignatureMetadata = buildImagingSignatureMetadata({
      imagingId: result._id, medicalId: result.medicalId, patientName: result.patientName, findings: result.findings,
      conclusion: result.conclusion, signedAt: result.signedAt, signerId: req.user.id, signerName: signingDoctorName,
    });
    const signedHash = result.digitalSignatureMetadata.signedHash;

    try {
      await result.save();
    } catch (saveErr) {
      // Lưu nội dung thất bại thì trả lại quyền ký, tránh báo cáo bị khóa với nội dung chưa hoàn chỉnh
      await ImagingResult.updateOne({ _id: result._id }, { $set: { isSigned: false, signedBy: null, signedByDoctorId: null } });
      throw saveErr;
    }

    await recordAuditLog({
      action: AUDIT_ACTIONS.IMAGING_REPORT_SIGNED,
      actorId: req.user.id,
      actorRole: req.user.role,
      hospitalId: result.hospitalId || req.user.hospitalId,
      targetModel: "ImagingResult",
      targetId: String(result._id),
      metadata: {
        signMode: permission.mode,
        actingRadiologistReason: permission.requiresReason ? result.actingRadiologistReason : undefined,
        signedHash,
      },
    });

    // Đồng bộ trạng thái mriOrder.mriStatus và gửi Cảnh báo Đỏ CĐHA nếu có
    const linkedVisit = await (result.visitId
      ? Visit.findById(result.visitId)
      : Visit.findOne({ hospitalId: result.hospitalId, "mriOrder.imagingResultId": result._id })).catch(() => null);
    if (linkedVisit || isCriticalFlag) {
      try {
        const visit = linkedVisit;
        if (visit) {
          if (visit.mriOrder) visit.mriOrder.mriStatus = "completed"; const isPdOrCritical = isCriticalFlag || result.structuredReport?.rano?.category === "PD"; if (isPdOrCritical && !["hoàn tất", "đã đóng", "đã hủy", "chờ nhập viện"].includes(visit.status)) { visit.status = "chờ hội chẩn"; } else if (["chờ chụp", "đang chụp", "chờ kết quả AI", "chờ chụp lại", "lỗi AI", "chờ chụp sau phẫu thuật"].includes(visit.status)) { visit.status = "chờ bác sĩ đọc"; }
          await visit.save();
        }
        if (isCriticalFlag) {
          const recipients = new Set();
          if (visit?.doctorId) recipients.add(String(visit.doctorId));
          const deptHeads = await User.find({
            hospitalId: result.hospitalId,
            role: "department_head"
          }).select("_id").lean();
          deptHeads.forEach(dh => recipients.add(String(dh._id)));

          for (const recipientId of recipients) {
            await createNotificationInternal({
              hospitalId: result.hospitalId,
              recipientId,
              senderId: req.user.id,
              type: "mri_order",
              title: "🚨 CẢNH BÁO ĐỎ CĐHA (CRITICAL FINDING)",
              message: `Bệnh nhân ${result.patientName} (${result.medicalId}): ${result.criticalFinding.reason}. Yêu cầu Bác sĩ điều trị / Trưởng khoa xác nhận đã đọc (Acknowledge) khẩn cấp!`,
              relatedId: result._id,
            });
          }
        }
      } catch (critErr) {
        console.warn("⚠️ Không thể gửi thông báo Critical Finding:", critErr.message);
      }
    }

    // Sao lưu báo cáo chẩn đoán vào kho (bản chính mã hóa; bản sao Drive mã hóa qua hàng đợi đồng bộ).
    // Trước đây còn đẩy JSON BẢN RÕ (tên bệnh nhân, mô tả, kết luận, email người sửa) lên Google Drive
    // (04_Patient_Reports, 05_Metadata_Backups) mỗi lần lưu báo cáo.
    try {
      const reportBackup = {
        imagingResultId: result._id,
        medicalId: result.medicalId,
        patientName: result.patientName,
        findings: result.findings,
        conclusion: result.conclusion,
        technique: result.technique,
        radiologist: result.radiologist,
        reportDate: result.reportDate.toISOString(),
        updatedBy: req.user.id,
        updatedByEmail: req.user.email
      };
      const reportJson = Buffer.from(JSON.stringify(reportBackup, null, 2), "utf-8");
      const savedReport = await storageService.put({
        category: "report",
        studyId: result.medicalId || result._id.toString(),
        fileName: `report_${result.medicalId}.json`,
        buffer: reportJson,
        mimeType: "application/json",
        patientId: result.patientId || null,
        uploadedBy: req.user?.id,
        hospitalId: result.hospitalId || req.user?.hospitalId || null,
      });
      result.storageReportFileId = savedReport.fileId;
      await result.save();
    } catch (storageErr) {
      console.warn("⚠️ [Storage Service] Không thể lưu báo cáo vào kho:", storageErr.message);
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật kết quả phim chụp thành công",
      data: result
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật kết quả phim chụp:", error);
    res.status(inputErrorStatus(res, error)).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

// @desc    Get imaging result by visit ID (Kèm tính năng tự hàn gắn / auto-heal liên kết với Visit)
// @route   GET /api/v1/imaging/by-visit/:visitId
// @access  Private (Doctor, Admin, Technician, Nurse)
export const getImagingResultByVisitId = async (req, res) => {
  try {
    const { visitId } = req.params;
    if (!visitId) {
      return errorResponse(res, "Thiếu ID lượt khám.", 400);
    }

    const isPatient = req.user.role === "patient";
    const imagingQuery = isPatient ? PATIENT_IMAGING_QUERY : undefined;
    let result = await ImagingResult.findOne({ visitId }, null, imagingQuery).sort({ createdAt: -1 });
    const visit = await Visit.findById(visitId);

    if (isPatient && String(visit?.patientId || "") !== String(req.user.id)) {
      return errorResponse(res, "Bạn không có quyền xem kết quả chẩn đoán này.", 403);
    }

    if (!result && visit?.mriOrder?.imagingResultId) {
      result = await ImagingResult.findById(visit.mriOrder.imagingResultId, null, imagingQuery);
    }

    if (!result) {
      return errorResponse(res, "Không tìm thấy kết quả phim chụp cho lượt khám này.", 404);
    }
    if (isPatient) {
      if (result.isSigned !== true) return errorResponse(res, "Kết quả này chưa được bác sĩ ký duyệt.", 403);
      return successResponse(res, result, "Lấy thông tin phim chụp theo lượt khám thành công.");
    }

    // Auto-heal: Đồng bộ liên kết nếu visit.mriOrder.imagingResultId bị thiếu
    if (visit && (!visit.mriOrder?.imagingResultId || visit.mriOrder.imagingResultId.toString() !== result._id.toString())) {
      if (!visit.mriOrder) visit.mriOrder = {};
      visit.mriOrder.imagingResultId = result._id;
      await visit.save();
    }

    return successResponse(res, hideClinicalContentFor(req.user, result), "Lấy thông tin phim chụp theo lượt khám thành công.");
  } catch (error) {
    console.error("Lỗi khi lấy phim theo visitId:", error);
    return errorResponse(res, "Có lỗi xảy ra khi tải dữ liệu phim chụp.", inputErrorStatus(res, error));
  }
};

// @desc    Xác nhận đã nhận & đọc Cảnh báo Đỏ CĐHA (Critical Finding Acknowledgment - ACR Guideline)
// @route   POST /api/v1/imaging/:id/acknowledge-critical
// @access  Private (Doctor, Department Head, Radiologist, Admin, Hospital Admin)
export const acknowledgeCriticalFinding = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await ImagingResult.findById(id);
    if (!result) {
      return res.status(404).json({ message: "Không tìm thấy kết quả phim chụp." });
    }
    // Tài khoản không gắn viện không được xác nhận thay bác sĩ của viện (trước đây bỏ qua kiểm tra khi thiếu hospitalId)
    if (!req.user.hospitalId || (result.hospitalId && String(result.hospitalId) !== String(req.user.hospitalId))) {
      return res.status(403).json({ message: "Không có quyền thao tác kết quả chụp của bệnh viện khác." });
    }
    if (!result.criticalFinding?.isCritical) {
      return res.status(400).json({ message: "Kết quả CĐHA này không có Cảnh báo Đỏ (Critical Finding)." });
    }

    const ackName = req.user.profile?.fullName || req.user.profile?.name || req.user.email || "Bác sĩ lâm sàng";
    result.criticalFinding.acknowledgedBy = req.user.id;
    result.criticalFinding.acknowledgedByName = ackName;
    result.criticalFinding.acknowledgedAt = new Date();
    await result.save();

    return res.status(200).json({
      success: true,
      message: "Đã xác nhận tiếp nhận Cảnh báo Đỏ CĐHA (Critical Finding).",
      criticalFinding: result.criticalFinding,
      data: result
    });
  } catch (error) {
    return res.status(inputErrorStatus(res, error)).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

// @desc    Người đang đăng nhập có được ký báo cáo này không (FE dùng để hiện form ký và ô lý do)
// @route   GET /api/v1/imaging/:id/sign-permission
// @access  Private (Doctor, Radiologist, Department Head)
export const getImagingSignPermission = async (req, res) => {
  try {
    const result = await ImagingResult.findById(req.params.id).select("hospitalId visitId isSigned").lean();
    if (!result) return res.status(404).json({ message: "Không tìm thấy kết quả phim chụp." });
    if (!req.user.hospitalId || (result.hospitalId && String(result.hospitalId) !== String(req.user.hospitalId))) {
      return res.status(403).json({ message: "Không có quyền thao tác kết quả chụp của bệnh viện khác." });
    }
    const permission = await evaluateImagingSignPermission({ user: req.user, imaging: result });
    return res.status(200).json({
      success: true,
      data: {
        canSign: permission.allowed && result.isSigned !== true,
        requiresReason: Boolean(permission.requiresReason),
        mode: permission.mode || null,
        message: permission.message || null,
      },
    });
  } catch (error) {
    return res.status(inputErrorStatus(res, error)).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

// @desc    Tạo bản đính chính / bổ sung báo cáo đã ký số (Addendum - bất biến bản gốc theo TT 13/2025/TT-BYT)
// @route   POST /api/v1/imaging/:id/addendum
// @access  Private (Radiologist, Doctor, Department Head)
export const addImagingAddendum = async (req, res) => {
  try {
    if (!["doctor", "radiologist", "department_head"].includes(req.user?.role)) {
      return res.status(403).json({ message: "Chỉ Bác sĩ mới có quyền tạo phụ lục (Addendum) báo cáo CĐHA." });
    }
    const { id } = req.params;
    const { content, reason } = req.body;

    if (!content || !String(content).trim()) {
      return res.status(400).json({ message: "Vui lòng nhập nội dung bản bổ sung / đính chính (addendum)." });
    }

    const result = await ImagingResult.findById(id);
    if (!result) {
      return res.status(404).json({ message: "Không tìm thấy kết quả phim chụp." });
    }
    if (!req.user.hospitalId || (result.hospitalId && String(result.hospitalId) !== String(req.user.hospitalId))) {
      return res.status(403).json({ message: "Không có quyền bổ sung báo cáo của bệnh viện khác." });
    }
    if (!result.isSigned) {
      return res.status(400).json({ message: "Báo cáo chưa ký duyệt, có thể cập nhật trực tiếp mà chưa cần tạo Addendum." });
    }

    const authorName = req.user.profile?.fullName || req.user.profile?.name || req.user.email || "Bác sĩ CĐHA";
    const addedAt = new Date();
    const hashPayload = `${result._id}|${String(content).trim()}|${String(reason || "").trim()}|${addedAt.toISOString()}|${req.user.id}`;
    const signatureHash = crypto.createHash("sha256").update(hashPayload).digest("hex");

    // Loại phụ lục suy từ vai trò: bác sĩ lâm sàng chỉ tạo được phụ lục lâm sàng, không đính chính được kết luận CĐHA.
    const addendumType = req.user.role === "radiologist"
      ? "radiology_amendment"
      : req.user.role === "department_head" && req.body.addendumType !== "clinical_correlation"
        ? "radiology_amendment"
        : "clinical_correlation";

    const addendumItem = {
      content: String(content).trim(),
      reason: String(reason || "").trim(),
      addendumType,
      authorRole: req.user.role || "",
      addedBy: req.user.id,
      addedByName: authorName,
      addedAt,
      signatureHash
    };

    if (!Array.isArray(result.addenda)) result.addenda = [];
    result.addenda.push(addendumItem);
    await result.save();

    await recordAuditLog({
      action: AUDIT_ACTIONS.CLINICAL_ADDENDUM_CREATED,
      actorId: req.user.id,
      actorRole: req.user.role,
      hospitalId: result.hospitalId || req.user.hospitalId,
      targetModel: "ImagingResult",
      targetId: String(result._id),
      metadata: { addendumType, signatureHash },
    });

    return res.status(201).json({
      success: true,
      message: "Đã phát hành bản bổ sung (Addendum) có chữ ký toàn vẹn, giữ nguyên bản gốc báo cáo.",
      addendum: result.addenda[result.addenda.length - 1],
      addenda: result.addenda,
      data: result
    });
  } catch (error) {
    return res.status(inputErrorStatus(res, error)).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

// @desc    [Q-CLINICAL-01] Bác sĩ lâm sàng xác nhận đã đọc báo cáo CĐHA (Attending Acknowledgment)
// @route   POST /api/v1/imaging/:id/acknowledge
// @access  Private (Doctor, Department Head)
export const acknowledgeImagingReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { clinicalNote = "" } = req.body || {};

    if (!CLINICAL_READER_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ message: "Chỉ bác sĩ lâm sàng hoặc Trưởng khoa mới được xác nhận đã đọc báo cáo CĐHA." });
    }

    const result = await ImagingResult.findById(id);
    if (!result) {
      return res.status(404).json({ message: "Không tìm thấy kết quả phim chụp." });
    }
    if (!req.user.hospitalId || (result.hospitalId && String(result.hospitalId) !== String(req.user.hospitalId))) {
      return res.status(403).json({ message: "Không có quyền thao tác kết quả chụp của bệnh viện khác." });
    }
    if (result.isSigned !== true) {
      return res.status(409).json({ message: "Báo cáo CĐHA chưa được ký nên chưa thể xác nhận đã đọc." });
    }

    // Người đọc sau không xóa vết của người đọc trước
    if (result.attendingAcknowledgment?.acknowledgedBy) {
      result.acknowledgmentHistory.push({ ...result.attendingAcknowledgment.toObject() });
    }
    const ackName = req.user.profile?.fullName || req.user.profile?.name || req.user.email || "Bác sĩ lâm sàng";
    result.attendingAcknowledgment = {
      acknowledgedBy: req.user.id,
      acknowledgedByName: ackName,
      acknowledgedAt: new Date(),
      clinicalNote: String(clinicalNote || "").trim()
    };
    await result.save();

    await recordAuditLog({
      action: AUDIT_ACTIONS.IMAGING_REPORT_ACKNOWLEDGED,
      entity: "ImagingResult",
      entityId: result._id,
      performedBy: req.user.id,
      hospitalId: result.hospitalId || req.user.hospitalId,
      details: `Bác sĩ ${ackName} (${req.user.role}) đã xác nhận đọc báo cáo CĐHA #${result._id}.`,
      payload: { clinicalNote: result.attendingAcknowledgment.clinicalNote }
    });

    return res.status(200).json({
      success: true,
      message: "Đã xác nhận bác sĩ lâm sàng đọc báo cáo CĐHA (Attending Acknowledge).",
      attendingAcknowledgment: result.attendingAcknowledgment,
      data: result
    });
  } catch (error) {
    return res.status(inputErrorStatus(res, error)).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

// @desc    [Q-CLINICAL-01] Bác sĩ lâm sàng thêm nhận định / đối chiếu lâm sàng (Clinical Addendum)
// @route   POST /api/v1/imaging/:id/clinical-addendum
// @access  Private (Doctor, Department Head)
export const addClinicalAddendum = async (req, res) => {
  if (!CLINICAL_READER_ROLES.includes(req.user?.role)) {
    return res.status(403).json({ message: "Phụ lục lâm sàng do bác sĩ lâm sàng hoặc Trưởng khoa tạo. Bác sĩ CĐHA dùng bản đính chính (addendum)." });
  }
  req.body = {
    ...req.body,
    addendumType: "clinical_correlation"
  };
  return addImagingAddendum(req, res);
};

// @desc    Lấy chuỗi diễn tiến kích thước khối u & tiêu chuẩn RANO dọc thời gian (Longitudinal RANO Timeline)
// @route   GET /api/v1/imaging/patient/:medicalId/rano-timeline
// @access  Private (Doctor, Radiologist, Department Head, Technician, Nurse, Admin)
export const getPatientRanoTimeline = async (req, res) => {
  try {
    const { medicalId } = req.params;
    if (!medicalId) {
      return res.status(400).json({ message: "Thiếu mã y tế bệnh nhân (medicalId)." });
    }

    const query = { medicalId };
    if (req.user.hospitalId && !["admin", "system_admin"].includes(req.user.role)) {
      query.hospitalId = req.user.hospitalId;
    }

    const results = await ImagingResult.find(query)
      .sort({ reportDate: 1, createdAt: 1 })
      .lean();

    let baselineCrossProductMm2 = null;
    const timeline = results.map((item, idx) => {
      const m = item.structuredReport?.measurements || {};
      const r = item.structuredReport?.rano || {};
      const crossProduct = Number(m.crossProductMm2 || (Number(m.d1Mm || 0) * Number(m.d2Mm || 0)) || 0);
      if (baselineCrossProductMm2 === null && crossProduct > 0) {
        baselineCrossProductMm2 = crossProduct;
      }
      const prevItem = idx > 0 ? results[idx - 1] : null;
      const prevM = prevItem?.structuredReport?.measurements || {};
      const prevCrossProduct = Number(prevM.crossProductMm2 || (Number(prevM.d1Mm || 0) * Number(prevM.d2Mm || 0)) || 0);

      const computed = computeRanoEvaluation({
        d1Mm: m.d1Mm || 0,
        d2Mm: m.d2Mm || 0,
        priorCrossProductMm2: r.priorCrossProductMm2 ?? (prevCrossProduct > 0 ? prevCrossProduct : null),
        priorResultId: r.priorResultId || prevItem?._id || null,
        radiotherapyEndDate: r.radiotherapyEndDate || null
      });

      return {
        imagingResultId: item._id,
        visitId: item.visitId,
        reportDate: item.reportDate || item.createdAt,
        procedure: item.procedure,
        radiologist: item.radiologist,
        isSigned: item.isSigned,
        hemisphere: item.structuredReport?.hemisphere || "none",
        lobe: item.structuredReport?.lobe || "none",
        d1Mm: Number(m.d1Mm || 0),
        d2Mm: Number(m.d2Mm || 0),
        d3Mm: Number(m.d3Mm || 0),
        crossProductMm2: computed.crossProductMm2,
        midlineShiftMm: Number(item.structuredReport?.midlineShiftMm || 0),
        ranoCategory: r.category && r.category !== "N/A" ? r.category : computed.rano.category,
        changePercent: r.changePercent ?? computed.rano.changePercent,
        isPseudoprogressionSuspected: Boolean(r.isPseudoprogressionSuspected || computed.rano.isPseudoprogressionSuspected),
        criticalFinding: item.criticalFinding || { isCritical: false }
      };
    });

    return res.status(200).json({
      success: true,
      medicalId,
      totalStudies: timeline.length,
      baselineCrossProductMm2,
      timeline
    });
  } catch (error) {
    return res.status(inputErrorStatus(res, error)).json({ message: "Lỗi máy chủ khi tính chuỗi RANO", error: error.message });
  }
};



