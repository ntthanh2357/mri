import { Router } from "express";
import { 
  getPatientResults, 
  getResultById, 
  createImagingResult, 
  getPatientResultsByMedicalId,
  uploadImagingImage 
} from "../controllers/imaging.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

// Get patient's own imaging results (Requires login)
router.get("/my-results", protect, getPatientResults);

// Get specific patient's results (Requires login - Doctor/Admin only)
router.get("/patient/:medicalId", protect, getPatientResultsByMedicalId);

// Upload imaging scan image (Requires login)
router.post("/upload", protect, uploadImagingImage);

// Get single imaging result details (Requires login)
router.get("/:id", protect, getResultById);

// Create new imaging result (Requires login - Doctor/Admin role enforced inside controller)
router.post("/", protect, createImagingResult);

export default router;
