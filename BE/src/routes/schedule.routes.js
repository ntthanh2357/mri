import { Router } from "express";
import {
  createSchedule,
  getWeeklySchedules,
  getMySchedules,
  updateSchedule,
  deleteSchedule,
  createSwapRequest,
  getSwapRequests,
  reviewSwapRequest,
  registerSchedule
} from "../controllers/schedule.controller.js";
import { protect, checkRole } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(protect);

// ── Swap Requests ────────────────────────────────────────────────────────────
router.post("/swap-requests", checkRole(["doctor", "nurse", "technician", "receptionist", "hospital_admin"]), createSwapRequest);
router.get("/swap-requests", checkRole(["doctor", "nurse", "technician", "receptionist", "hospital_admin", "admin"]), getSwapRequests);
router.put("/swap-requests/:id", checkRole(["hospital_admin"]), reviewSwapRequest);

// ── Weekly & Personal Schedules ────────────────────────────────────────────────
router.get("/me", checkRole(["doctor", "nurse", "technician", "receptionist", "hospital_admin"]), getMySchedules);
router.get("/my-schedule", checkRole(["doctor", "nurse", "technician", "receptionist", "hospital_admin"]), getMySchedules);
router.get("/", checkRole(["doctor", "nurse", "technician", "receptionist", "hospital_admin", "admin"]), getWeeklySchedules);

// ── CRUD schedules ───────────────────────────────────────────────────────────
router.post("/register", checkRole(["doctor", "nurse", "technician"]), registerSchedule);
router.post("/", checkRole(["hospital_admin"]), createSchedule);
router.put("/:id", checkRole(["hospital_admin"]), updateSchedule);
router.delete("/:id", checkRole(["hospital_admin"]), deleteSchedule);

export default router;
