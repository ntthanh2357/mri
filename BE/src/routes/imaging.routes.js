import { Router } from "express";
import { 
  getPatientResults, 
  getResultById, 
  createImagingResult, 
  getPatientResultsByMedicalId,
  uploadImagingImage,
  analyzeImagingResultAI,
  feedbackImagingResultAI,
  approveImagingResultAI,
  explainImagingResultAI,
  getAllImagingResults,
  updateImagingResult
} from "../controllers/imaging.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

// Get all imaging results (Doctor/Admin/Nurse/Technician/Receptionist only)
router.get("/", protect, getAllImagingResults);

// Get patient's own imaging results (Requires login)
router.get("/my-results", protect, getPatientResults);

// Get specific patient's results (Requires login - Doctor/Admin only)
router.get("/patient/:medicalId", protect, getPatientResultsByMedicalId);

// Upload imaging scan image (Requires login)
router.post("/upload", protect, uploadImagingImage);

// Analyze imaging scan using AI (Requires login)
router.post("/analyze-ai", protect, analyzeImagingResultAI);

// Submit doctor feedback on AI results (Requires login)
router.post("/feedback-ai", protect, feedbackImagingResultAI);

// Doctor approves AI result as correct (Requires login - Doctor/Admin/Technician only)
router.post("/approve-ai", protect, approveImagingResultAI);

// Explain imaging result in simple, Hippocratic terms for patient (Requires login)
router.post("/:id/explain-ai", protect, explainImagingResultAI);

// Get single imaging result details (Requires login)
router.get("/:id", protect, getResultById);

// Update single imaging result report findings/conclusions (Requires login)
router.put("/:id", protect, updateImagingResult);

// Create new imaging result (Requires login - Doctor/Admin role enforced inside controller)
router.post("/", protect, createImagingResult);


export default router;
