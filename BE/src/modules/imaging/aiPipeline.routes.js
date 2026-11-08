import { Router } from "express";
import { protect, checkRole } from "../../middlewares/auth.middleware.js";
import {
  triggerAiJob,
  getJobProgress,
  getAiReport,
  retryAiJob,
  getAiJobs,
  getAiQueueStats
} from "./aiPipeline.controller.js";

const router = Router();
router.use(protect);
// Hàng đợi AI chứa dữ liệu người bệnh: chỉ nhân sự CĐHA và điều trị.
router.use(checkRole(["doctor", "radiologist", "department_head", "technician", "nurse", "hospital_admin"]));

router.post("/trigger", triggerAiJob);
router.get("/queue-stats", getAiQueueStats);
router.get("/jobs", getAiJobs);
router.get("/jobs/:jobId/progress", getJobProgress);
router.get("/jobs/:jobId/report", getAiReport);
router.post("/jobs/:jobId/retry", retryAiJob);

export default router;
