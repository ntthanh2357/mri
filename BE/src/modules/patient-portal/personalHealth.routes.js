import { Router } from "express";
import { protect } from "../../middlewares/auth.middleware.js";
import {
  getVitalsTrend,
  getMedicineReminders,
  getLabResultsWithExplanation,
  getEmrSummaryForPatient
} from "./personalHealth.controller.js";

const router = Router();
router.use(protect);

router.get("/vitals-trend", getVitalsTrend);
router.get("/medicine-reminders", getMedicineReminders);
router.get("/lab-results", getLabResultsWithExplanation);
router.get("/emr-summary", getEmrSummaryForPatient);

export default router;
