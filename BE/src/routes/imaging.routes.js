import { Router } from "express";
import { 
  getPatientResults, 
  getResultById, 
  createImagingResult, 
  getPatientResultsByMedicalId,
  uploadImagingImage,
  analyzeImagingResultAI,
  feedbackImagingResultAI,
  explainImagingResultAI
} from "../controllers/imaging.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

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

// Explain imaging result in simple, Hippocratic terms for patient (Requires login)
router.post("/:id/explain-ai", protect, explainImagingResultAI);

// Get single imaging result details (Requires login)
router.get("/:id", protect, getResultById);

// Create new imaging result (Requires login - Doctor/Admin role enforced inside controller)
router.post("/", protect, createImagingResult);

export default router;
