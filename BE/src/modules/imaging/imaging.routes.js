import { Router } from "express";
import { 
  getPatientResults, 
  getResultById, 
  createImagingResult, 
  getPatientResultsByMedicalId,
  getResultsByPatientUserId,
  uploadImagingImage,
  analyzeImagingResultAI,
  feedbackImagingResultAI,
  approveImagingResultAI,
  explainImagingResultAI,
  getAllImagingResults,
  updateImagingResult,
  getImagingResultByVisitId,
  acknowledgeCriticalFinding,
  acknowledgeImagingReport,
  addImagingAddendum,
  addClinicalAddendum,
  getPatientRanoTimeline,
  getImagingSignPermission
} from "./imaging.controller.js";
import { protect, checkRole, denyPlatformAdmin } from "../../middlewares/auth.middleware.js";
import { uploadImagingFile } from "../../middlewares/imagingUpload.middleware.js";
import { allowSignedPath } from "../../middlewares/uploadSignature.middleware.js";
import {
  initTriage,
  uploadTriageBatch,
  uploadTriageZip,
  runTriage,
  previewTriageSlice,
  finalizeTriage,
  cancelTriage,
  uploadTriageBatchMiddleware,
  uploadTriageZipMiddleware,
} from "./triage.controller.js";

const router = Router();

// Dữ liệu CĐHA là hồ sơ người bệnh: chỉ người cần cho việc điều trị và tiếp nhận mới được đọc (Luật KCB 2023 Điều 69).
// Quản trị nền tảng (admin, system_admin) không tham gia điều trị nên không đọc dữ liệu này.
const IMAGING_STAFF_READ_ROLES = ["doctor", "radiologist", "department_head", "technician", "nurse", "receptionist", "hospital_admin"];
// Bệnh nhân chỉ đọc được phim của chính mình, controller kiểm tra quyền sở hữu.
const IMAGING_READ_ROLES = [...IMAGING_STAFF_READ_ROLES, "patient"];

// Get all imaging results (Doctor/Admin/Nurse/Technician/Receptionist only)
router.get("/", protect, checkRole(IMAGING_STAFF_READ_ROLES), denyPlatformAdmin, getAllImagingResults);

// Get patient's own imaging results (Requires login)
router.get("/my-results", protect, denyPlatformAdmin, getPatientResults);

// Longitudinal RANO tumor trajectory by medicalId
router.get("/patient/:medicalId/rano-timeline", protect, checkRole(["doctor", "radiologist", "department_head", "technician", "nurse", "hospital_admin"]), denyPlatformAdmin, getPatientRanoTimeline);

// Get specific patient's results (Requires login - Doctor/Admin only)
router.get("/patient/:medicalId", protect, checkRole(IMAGING_STAFF_READ_ROLES), denyPlatformAdmin, getPatientResultsByMedicalId);

// Upload imaging scan image or DICOM archive — chỉ KTV/bác sĩ của bệnh viện (P0-4)
router.post("/upload", protect, checkRole(["technician", "doctor", "radiologist", "department_head"]), denyPlatformAdmin, uploadImagingFile, uploadImagingImage);

// Sàng lọc hàng loạt thư mục / tệp ZIP MRI (KTV lọc ảnh rõ khối u trước khi đẩy ~10 lát cho bác sĩ)
const TRIAGE_STAFF_ROLES = ["technician", "doctor", "radiologist", "department_head"];
const allowSignedTriagePreview = allowSignedPath(
  (req) => `/api/v1/imaging/triage/${req.params.sessionId}/preview/${req.params.sliceKey}`,
  protect
);
const requireTriagePreviewStaff = (req, res, next) => {
  if (req.signedFileAccess) return next();
  return checkRole(TRIAGE_STAFF_ROLES)(req, res, () => denyPlatformAdmin(req, res, next));
};

router.post("/triage/init", protect, checkRole(TRIAGE_STAFF_ROLES), denyPlatformAdmin, initTriage);
router.post("/triage/:sessionId/batch", protect, checkRole(TRIAGE_STAFF_ROLES), denyPlatformAdmin, uploadTriageBatchMiddleware, uploadTriageBatch);
router.post("/triage/:sessionId/upload-zip", protect, checkRole(TRIAGE_STAFF_ROLES), denyPlatformAdmin, uploadTriageZipMiddleware, uploadTriageZip);
router.post("/triage/:sessionId/run", protect, checkRole(TRIAGE_STAFF_ROLES), denyPlatformAdmin, runTriage);
router.get("/triage/:sessionId/preview/:sliceKey", allowSignedTriagePreview, requireTriagePreviewStaff, previewTriageSlice);
router.post("/triage/:sessionId/finalize", protect, checkRole(TRIAGE_STAFF_ROLES), denyPlatformAdmin, finalizeTriage);
router.delete("/triage/:sessionId", protect, checkRole(TRIAGE_STAFF_ROLES), denyPlatformAdmin, cancelTriage);

// Analyze imaging scan using AI (Requires login)
router.post("/analyze-ai", protect, denyPlatformAdmin, analyzeImagingResultAI);

// Submit doctor feedback on AI results (Requires login)
router.post("/feedback-ai", protect, denyPlatformAdmin, feedbackImagingResultAI);

// Doctor approves AI result as correct (Requires login - Doctor/Admin/Technician only)
router.post("/approve-ai", protect, denyPlatformAdmin, approveImagingResultAI);

// Explain imaging result in simple, Hippocratic terms for patient (Requires login)
router.post("/:id/explain-ai", protect, checkRole(IMAGING_READ_ROLES.filter((role) => role !== "receptionist")), denyPlatformAdmin, explainImagingResultAI);

// Critical Finding Acknowledgment & Post-Signature Addendum
router.post("/:id/acknowledge-critical", protect, checkRole(["doctor", "radiologist", "department_head"]), denyPlatformAdmin, acknowledgeCriticalFinding);
router.post("/:id/acknowledge", protect, checkRole(["doctor", "department_head"]), denyPlatformAdmin, acknowledgeImagingReport);
router.post("/:id/addendum", protect, checkRole(["doctor", "radiologist", "department_head"]), denyPlatformAdmin, addImagingAddendum);
router.post("/:id/clinical-addendum", protect, checkRole(["doctor", "department_head"]), denyPlatformAdmin, addClinicalAddendum);
router.get("/:id/sign-permission", protect, checkRole(["doctor", "radiologist", "department_head"]), denyPlatformAdmin, getImagingSignPermission);

// Get imaging results by visit ID
router.get("/by-visit/:visitId", protect, checkRole(IMAGING_READ_ROLES), denyPlatformAdmin, getImagingResultByVisitId);

// Get imaging results by patient User ID (ObjectId) - fallback for patients without medicalId
router.get("/by-patient/:patientId", protect, checkRole(IMAGING_STAFF_READ_ROLES), denyPlatformAdmin, getResultsByPatientUserId);

// Get single imaging result details (Requires login)
router.get("/:id", protect, checkRole(IMAGING_READ_ROLES), denyPlatformAdmin, getResultById);

// Ký báo cáo CĐHA: controller xét thẩm quyền cụ thể theo evaluateImagingSignPermission
router.put("/:id", protect, checkRole(["doctor", "radiologist", "department_head"]), denyPlatformAdmin, updateImagingResult);

// Tạo kết quả CĐHA — KTV tạo ca chụp, bác sĩ đọc phim. Bệnh nhân KHÔNG được tạo (P0-3)
router.post("/", protect, checkRole(["doctor", "radiologist", "department_head", "technician"]), denyPlatformAdmin, createImagingResult);

export default router;
