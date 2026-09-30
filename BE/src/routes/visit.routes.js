import express from "express";
import { protect, checkRole } from "../middlewares/auth.middleware.js";
import {
  createVisit,
  getMyQueue,
  updateVitals,
  createMriOrder,
  updateStatus,
  getStaff,
  submitMriSafetyCheck,
  requestMriRescan,
  cancelMriOrder,
} from "../controllers/visit.controller.js";

const router = express.Router();

router.get("/staff", protect, getStaff);
router.post("/", protect, checkRole(["nurse", "receptionist", "admin", "hospital_admin"]), createVisit);
router.get("/my-queue", protect, getMyQueue);
router.put("/:id/vitals", protect, checkRole(["nurse", "receptionist", "doctor", "admin", "hospital_admin"]), updateVitals);
router.put("/:id/mri-order", protect, checkRole(["doctor"]), createMriOrder);
router.put("/:id/status", protect, checkRole(["doctor", "nurse", "receptionist", "technician", "admin", "hospital_admin"]), updateStatus);

// [THỰC TẾ BV: NGHỊCH LÝ 3 & 4] Bảng kiểm an toàn MRI, Chụp lại & Hủy ca
router.post("/:id/mri-safety-check", protect, checkRole(["technician", "nurse", "doctor", "admin", "hospital_admin"]), submitMriSafetyCheck);
router.post("/:id/mri-rescan", protect, checkRole(["technician", "doctor", "admin", "hospital_admin"]), requestMriRescan);
router.post("/:id/mri-cancel", protect, checkRole(["technician", "doctor", "admin", "hospital_admin"]), cancelMriOrder);

export default router;

