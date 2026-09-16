import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  triggerEmergency,
  acknowledgeAlert,
  resolveAlert,
  getActiveAlerts,
  getAlertHistory
} from "../controllers/emergency.controller.js";

const router = Router();
router.use(protect);

router.get("/alerts", getActiveAlerts);
router.get("/alerts/history", getAlertHistory);
router.post("/trigger", triggerEmergency);
router.put("/alerts/:alertId/acknowledge", acknowledgeAlert);
router.put("/alerts/:alertId/resolve", resolveAlert);

export default router;
