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
import { protect, checkRole } from "../../middlewares/auth.middleware.js";
import { uploadImagingFile } from "../../middlewares/imagingUpload.middleware.js";

const router = Router();

// Dữ liệu CĐHA là hồ sơ người bệnh: chỉ người cần cho việc điều trị và tiếp nhận mới được đọc (Luật KCB 2023 Điều 69).
// Quản trị nền tảng (admin, system_admin) không tham gia điều trị nên không đọc dữ liệu này.
const IMAGING_STAFF_READ_ROLES = ["doctor", "radiologist", "department_head", "technician", "nurse", "receptionist", "hospital_admin"];
// Bệnh nhân chỉ đọc được phim của chính mình, controller kiểm tra quyền sở hữu.
const IMAGING_READ_ROLES = [...IMAGING_STAFF_READ_ROLES, "patient"];

// Get all imaging results (Doctor/Admin/Nurse/Technician/Receptionist only)
router.get("/", protect, checkRole(IMAGING_STAFF_READ_ROLES), getAllImagingResults);

// Get patient's own imaging results (Requires login)
router.get("/my-results", protect, getPatientResults);

// Longitudinal RANO tumor trajectory by medicalId
router.get("/patient/:medicalId/rano-timeline", protect, checkRole(["doctor", "radiologist", "department_head", "technician", "nurse", "hospital_admin"]), getPatientRanoTimeline);

// Get specific patient's results (Requires login - Doctor/Admin only)
router.get("/patient/:medicalId", protect, checkRole(IMAGING_STAFF_READ_ROLES), getPatientResultsByMedicalId);

// Upload imaging scan image or DICOM archive — chỉ KTV/bác sĩ của bệnh viện (P0-4)
router.post("/upload", protect, checkRole(["technician", "doctor", "radiologist", "department_head"]), uploadImagingFile, uploadImagingImage);

// Analyze imaging scan using AI (Requires login)
router.post("/analyze-ai", protect, analyzeImagingResultAI);

// Submit doctor feedback on AI results (Requires login)
router.post("/feedback-ai", protect, feedbackImagingResultAI);

// Doctor approves AI result as correct (Requires login - Doctor/Admin/Technician only)
router.post("/approve-ai", protect, approveImagingResultAI);

// Explain imaging result in simple, Hippocratic terms for patient (Requires login)
router.post("/:id/explain-ai", protect, checkRole(IMAGING_READ_ROLES.filter((role) => role !== "receptionist")), explainImagingResultAI);

// Critical Finding Acknowledgment & Post-Signature Addendum
router.post("/:id/acknowledge-critical", protect, checkRole(["doctor", "radiologist", "department_head", "admin", "hospital_admin"]), acknowledgeCriticalFinding);
router.post("/:id/acknowledge", protect, checkRole(["doctor", "department_head"]), acknowledgeImagingReport);
router.post("/:id/addendum", protect, checkRole(["doctor", "radiologist", "department_head"]), addImagingAddendum);
router.post("/:id/clinical-addendum", protect, checkRole(["doctor", "department_head"]), addClinicalAddendum);
router.get("/:id/sign-permission", protect, checkRole(["doctor", "radiologist", "department_head"]), getImagingSignPermission);

// Get imaging results by visit ID
router.get("/by-visit/:visitId", protect, checkRole(IMAGING_READ_ROLES), getImagingResultByVisitId);

// Get imaging results by patient User ID (ObjectId) - fallback for patients without medicalId
router.get("/by-patient/:patientId", protect, checkRole(IMAGING_STAFF_READ_ROLES), getResultsByPatientUserId);

// Get single imaging result details (Requires login)
router.get("/:id", protect, checkRole(IMAGING_READ_ROLES), getResultById);

// Ký báo cáo CĐHA: controller xét thẩm quyền cụ thể theo evaluateImagingSignPermission
router.put("/:id", protect, checkRole(["doctor", "radiologist", "department_head"]), updateImagingResult);

// Tạo kết quả CĐHA — KTV tạo ca chụp, bác sĩ đọc phim. Bệnh nhân KHÔNG được tạo (P0-3)
router.post("/", protect, checkRole(["doctor", "radiologist", "department_head", "technician"]), createImagingResult);

export default router;
