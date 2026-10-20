import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  getRevenueReport,
  getAiPerformanceReport,
  getDepartmentOperationReport,
  getClinicalAnalyticsDashboard,
  getSlaReport
} from "../controllers/report.controller.js";

const router = Router();
router.use(protect);

router.get("/revenue", getRevenueReport);
router.get("/ai-performance", getAiPerformanceReport);
router.get("/department-operation", getDepartmentOperationReport);
router.get("/clinical-analytics", getClinicalAnalyticsDashboard);
router.get("/sla", getSlaReport);

export default router;
