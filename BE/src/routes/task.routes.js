import { Router } from "express";
import { protect, checkRole } from "../middlewares/auth.middleware.js";
import {
  getKanbanBoard,
  updateTaskStatus,
  checkTaskDeadlines,
  getShiftOverviewDashboard
} from "../controllers/task.controller.js";

const router = Router();
router.use(protect);

const STAFF_ROLES = [
  "admin",
  "system_admin",
  "hospital_admin",
  "department_head",
  "doctor",
  "radiologist",
  "nurse",
  "technician",
  "lab_technician",
  "pharmacist",
  "receptionist",
];

router.get("/kanban", checkRole(STAFF_ROLES), getKanbanBoard);
router.get("/shift-overview", checkRole(STAFF_ROLES), getShiftOverviewDashboard);
router.put("/:id/status", checkRole(STAFF_ROLES), updateTaskStatus);
router.post("/check-deadlines", checkRole(["admin", "system_admin", "hospital_admin", "department_head"]), checkTaskDeadlines);

export default router;
