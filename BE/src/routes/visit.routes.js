import express from "express";
import { protect, checkRole } from "../middlewares/auth.middleware.js";
import { createVisit, getMyQueue, updateVitals, createMriOrder, updateStatus, getStaff } from "../controllers/visit.controller.js";

const router = express.Router();

router.get("/staff", protect, getStaff);
router.post("/", protect, checkRole(["nurse", "admin"]), createVisit);
router.get("/my-queue", protect, getMyQueue);
router.put("/:id/vitals", protect, checkRole(["nurse"]), updateVitals);
router.put("/:id/mri-order", protect, checkRole(["doctor"]), createMriOrder);
router.put("/:id/status", protect, updateStatus);

export default router;
