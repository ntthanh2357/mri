import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  autoAssignDoctor,
  overrideAssignment,
  getCaseloadDashboard,
  acknowledgeAssignment,
  getMyAssignments,
  getAllAssignments
} from "../controllers/assignment.controller.js";

const router = Router();
router.use(protect);

router.get("/", getAllAssignments);
router.get("/my", getMyAssignments);
router.get("/caseload-dashboard", getCaseloadDashboard);
router.post("/auto-assign", autoAssignDoctor);
router.put("/:id/override", overrideAssignment);
router.put("/:id/acknowledge", acknowledgeAssignment);

export default router;
