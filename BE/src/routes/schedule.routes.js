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

const ALL_STAFF_ROLES = [
  "doctor",
  "radiologist",
  "department_head",
  "nurse",
  "technician",
  "lab_technician",
  "receptionist",
  "pharmacist",
  "hospital_admin",
  "admin",
  "system_admin",
];
const SCHEDULE_ADMIN_ROLES = ["department_head", "hospital_admin", "admin", "system_admin"];

// ── Shift Registrations & Approval Inbox ──────────────────────────────────────
router.post("/register", checkRole(ALL_STAFF_ROLES), registerSchedule);
router.get("/registrations", checkRole(ALL_STAFF_ROLES), getShiftRegistrations);
router.put("/registrations/:id/review", checkRole(SCHEDULE_ADMIN_ROLES), reviewShiftRegistration);
router.delete("/registrations/:id", checkRole(ALL_STAFF_ROLES), cancelMyRegistration);

// ── Swap Requests ────────────────────────────────────────────────────────────
router.post("/swap-requests", checkRole(ALL_STAFF_ROLES), createSwapRequest);
router.get("/swap-requests", checkRole(ALL_STAFF_ROLES), getSwapRequests);
router.put("/swap-requests/:id", checkRole(SCHEDULE_ADMIN_ROLES), reviewSwapRequest);

// ── Weekly & Personal Schedules ────────────────────────────────────────────────
router.get("/me", checkRole(ALL_STAFF_ROLES), getMySchedules);
router.get("/my-schedule", checkRole(ALL_STAFF_ROLES), getMySchedules);
router.get("/", checkRole(ALL_STAFF_ROLES), getWeeklySchedules);

// ── CRUD schedules (Admin / Department Head) ──────────────────────────────────
router.post("/", checkRole(SCHEDULE_ADMIN_ROLES), createSchedule);
router.put("/:id", checkRole(SCHEDULE_ADMIN_ROLES), updateSchedule);
router.delete("/:id", checkRole(SCHEDULE_ADMIN_ROLES), deleteSchedule);

export default router;
