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
  registerSchedule,
  getShiftRegistrations,
  reviewShiftRegistration,
  cancelMyRegistration,
} from "../controllers/schedule.controller.js";
import { protect, checkRole } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(protect);

// ── Shift Registrations & Approval Inbox ──────────────────────────────────────
router.post(
  "/register",
  checkRole(["doctor", "nurse", "technician", "receptionist", "hospital_admin", "admin"]),
  registerSchedule
);
router.get(
  "/registrations",
  checkRole(["doctor", "nurse", "technician", "receptionist", "hospital_admin", "admin"]),
  getShiftRegistrations
);
router.put(
  "/registrations/:id/review",
  checkRole(["hospital_admin", "admin"]),
  reviewShiftRegistration
);
router.delete(
  "/registrations/:id",
  checkRole(["doctor", "nurse", "technician", "receptionist", "hospital_admin", "admin"]),
  cancelMyRegistration
);

// ── Swap Requests ────────────────────────────────────────────────────────────
router.post("/swap-requests", checkRole(["doctor", "nurse", "technician", "receptionist", "hospital_admin"]), createSwapRequest);
router.get("/swap-requests", checkRole(["doctor", "nurse", "technician", "receptionist", "hospital_admin", "admin"]), getSwapRequests);
router.put("/swap-requests/:id", checkRole(["hospital_admin", "admin"]), reviewSwapRequest);

// ── Weekly & Personal Schedules ────────────────────────────────────────────────
router.get("/me", checkRole(["doctor", "nurse", "technician", "receptionist", "hospital_admin", "admin"]), getMySchedules);
router.get("/my-schedule", checkRole(["doctor", "nurse", "technician", "receptionist", "hospital_admin", "admin"]), getMySchedules);
router.get("/", checkRole(["doctor", "nurse", "technician", "receptionist", "hospital_admin", "admin"]), getWeeklySchedules);

// ── CRUD schedules (Admin) ───────────────────────────────────────────────────
router.post("/", checkRole(["hospital_admin", "admin"]), createSchedule);
router.put("/:id", checkRole(["hospital_admin", "admin"]), updateSchedule);
router.delete("/:id", checkRole(["hospital_admin", "admin"]), deleteSchedule);

export default router;

