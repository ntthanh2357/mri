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
  addImagingAddendum,
  getPatientRanoTimeline
} from "./imaging.controller.js";
import { protect, checkRole } from "../../middlewares/auth.middleware.js";
import { uploadImagingFile } from "../../middlewares/imagingUpload.middleware.js";

const router = Router();

// Get all imaging results (Doctor/Admin/Nurse/Technician/Receptionist only)
router.get("/", protect, getAllImagingResults);

// Get patient's own imaging results (Requires login)
router.get("/my-results", protect, getPatientResults);

// Longitudinal RANO tumor trajectory by medicalId
router.get("/patient/:medicalId/rano-timeline", protect, checkRole(["doctor", "radiologist", "department_head", "technician", "nurse", "admin", "hospital_admin"]), getPatientRanoTimeline);

// Get specific patient's results (Requires login - Doctor/Admin only)
router.get("/patient/:medicalId", protect, getPatientResultsByMedicalId);

// Upload imaging scan image or DICOM archive — chỉ KTV/bác sĩ của bệnh viện (P0-4)
router.post("/upload", protect, checkRole(["technician", "doctor", "radiologist", "department_head"]), uploadImagingFile, uploadImagingImage);

// Analyze imaging scan using AI (Requires login)
router.post("/analyze-ai", protect, analyzeImagingResultAI);

// Submit doctor feedback on AI results (Requires login)
router.post("/feedback-ai", protect, feedbackImagingResultAI);

// Doctor approves AI result as correct (Requires login - Doctor/Admin/Technician only)
router.post("/approve-ai", protect, approveImagingResultAI);

// Explain imaging result in simple, Hippocratic terms for patient (Requires login)
router.post("/:id/explain-ai", protect, explainImagingResultAI);

// Critical Finding Acknowledgment & Post-Signature Addendum
router.post("/:id/acknowledge-critical", protect, checkRole(["doctor", "radiologist", "department_head", "admin", "hospital_admin"]), acknowledgeCriticalFinding);
router.post("/:id/addendum", protect, checkRole(["doctor", "radiologist", "department_head"]), addImagingAddendum);

// Get imaging results by visit ID
router.get("/by-visit/:visitId", protect, getImagingResultByVisitId);

// Get imaging results by patient User ID (ObjectId) - fallback for patients without medicalId
router.get("/by-patient/:patientId", protect, getResultsByPatientUserId);

// Get single imaging result details (Requires login)
router.get("/:id", protect, getResultById);

// Ký/duyệt báo cáo CĐHA — chỉ bác sĩ đọc phim (P0-2)
router.put("/:id", protect, checkRole(["doctor", "radiologist", "department_head"]), updateImagingResult);

// Tạo kết quả CĐHA — KTV tạo ca chụp, bác sĩ đọc phim. Bệnh nhân KHÔNG được tạo (P0-3)
router.post("/", protect, checkRole(["doctor", "radiologist", "department_head", "technician"]), createImagingResult);

export default router;
