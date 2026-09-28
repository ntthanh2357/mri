import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  getDicomViewerData,
  getAiOverlays,
  getFullAiReport,
  get3dModelUrl,
  signImagingReport,
  getFollowUpComparison,
  getDoctorCaseloads,
} from "../controllers/clinicalView.controller.js";

const router = Router();

// G.1 — DICOM viewer data (series + URLs)
router.get("/imaging/:imagingResultId/dicom-viewer", protect, getDicomViewerData);

// G.2 — AI overlays (mask, heatmap, top slices)
router.get("/imaging/:imagingResultId/ai-overlays", protect, getAiOverlays);

// G.3 — Báo cáo AI tổng hợp đầy đủ
router.get("/imaging/:imagingResultId/ai-report", protect, getFullAiReport);

// G.4 — URL 3D model GLTF
router.get("/imaging/:imagingResultId/3d-model", protect, get3dModelUrl);

// G.5 — Ký duyệt + feedback AI (active learning)
router.post("/imaging/:imagingResultId/sign", protect, signImagingReport);

// G.6 — So sánh follow-up nhiều lần chụp
router.get("/patients/:patientId/followup-comparison", protect, getFollowUpComparison);

// D.4 — Caseload bác sĩ real-time
router.get("/doctor-caseloads", protect, getDoctorCaseloads);

export default router;
