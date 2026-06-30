import express from "express";
import { protect, checkRole } from "../middlewares/auth.middleware.js";
import { createVisit, getMyQueue, updateVitals, createMriOrder, updateStatus, getStaff } from "../controllers/visit.controller.js";

const router = express.Router();

router.get("/staff", protect, getStaff);
router.post("/", protect, checkRole(["nurse", "receptionist", "admin", "hospital_admin"]), createVisit);
router.get("/my-queue", protect, getMyQueue);
router.put("/:id/vitals", protect, checkRole(["nurse", "receptionist", "doctor", "admin", "hospital_admin"]), updateVitals);
router.put("/:id/mri-order", protect, checkRole(["doctor"]), createMriOrder);
router.put("/:id/status", protect, checkRole(["doctor", "nurse", "receptionist", "technician", "admin", "hospital_admin"]), updateStatus);

export default router;
