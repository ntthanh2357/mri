import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  getKanbanBoard,
  updateTaskStatus,
  checkTaskDeadlines,
  getShiftOverviewDashboard
} from "../controllers/task.controller.js";

const router = Router();
router.use(protect);

router.get("/kanban", getKanbanBoard);
router.get("/shift-overview", getShiftOverviewDashboard);
router.put("/:id/status", updateTaskStatus);
router.post("/check-deadlines", checkTaskDeadlines);

export default router;
