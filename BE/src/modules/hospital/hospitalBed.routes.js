import { Router } from "express";
import { protect, checkRole } from "../../middlewares/auth.middleware.js";
import {
  getBeds,
  createBed,
  reserveBed,
  occupyBed,
  releaseBed,
  getBedMapSummary,
  completeCleaning,
  transferBedInternal,
  getNeuroIcuCapacityAlert
} from "./hospitalBed.controller.js";

const router = Router();
router.use(protect);

// Role Guard chống rò rỉ thông tin bệnh nhân nội trú (HIPAA Minimum Necessary & Luật 15/2023 Điều 66)
router.get("/", checkRole(["doctor", "nurse", "admin", "hospital_admin", "receptionist", "technician"]), getBeds);
router.post("/", checkRole(["admin", "hospital_admin"]), createBed);
router.get("/map-summary", checkRole(["doctor", "nurse", "admin", "hospital_admin", "receptionist"]), getBedMapSummary);
router.get("/neuro-icu-capacity", checkRole(["doctor", "nurse", "admin", "hospital_admin"]), getNeuroIcuCapacityAlert);

// Thao tác lâm sàng trên từng giường bệnh
router.post("/:id/reserve", checkRole(["doctor", "nurse", "admin", "hospital_admin", "receptionist"]), reserveBed);
router.put("/:id/occupy", checkRole(["doctor", "nurse", "admin", "hospital_admin"]), occupyBed);
router.put("/:id/release", checkRole(["doctor", "nurse", "admin", "hospital_admin"]), releaseBed);
router.put("/:id/cleaning-complete", checkRole(["doctor", "nurse", "admin", "hospital_admin", "cleaner"]), completeCleaning);
router.post("/transfer-internal", checkRole(["doctor", "nurse", "admin", "hospital_admin"]), transferBedInternal);

export default router;

