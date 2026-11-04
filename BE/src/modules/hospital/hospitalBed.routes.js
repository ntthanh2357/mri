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
router.get("/", checkRole(["doctor", "department_head", "radiologist", "nurse", "admin", "system_admin", "hospital_admin", "receptionist", "technician"]), getBeds);
router.post("/", checkRole(["admin", "system_admin", "hospital_admin", "department_head"]), createBed);
router.get("/map-summary", checkRole(["doctor", "department_head", "nurse", "admin", "system_admin", "hospital_admin", "receptionist"]), getBedMapSummary);
router.get("/neuro-icu-capacity", checkRole(["doctor", "department_head", "nurse", "admin", "system_admin", "hospital_admin"]), getNeuroIcuCapacityAlert);

// Thao tác lâm sàng trên từng giường bệnh
router.post("/:id/reserve", checkRole(["doctor", "department_head", "nurse", "admin", "system_admin", "hospital_admin", "receptionist"]), reserveBed);
router.put("/:id/occupy", checkRole(["doctor", "department_head", "nurse", "admin", "system_admin", "hospital_admin"]), occupyBed);
router.put("/:id/release", checkRole(["doctor", "department_head", "nurse", "admin", "system_admin", "hospital_admin"]), releaseBed);
router.put("/:id/cleaning-complete", checkRole(["doctor", "department_head", "nurse", "admin", "system_admin", "hospital_admin", "cleaner"]), completeCleaning);
router.post("/transfer-internal", checkRole(["doctor", "department_head", "nurse", "admin", "system_admin", "hospital_admin"]), transferBedInternal);

export default router;
