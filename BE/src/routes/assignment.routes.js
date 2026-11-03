import { Router } from "express";
import { protect, checkRole } from "../middlewares/auth.middleware.js";
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

router.get("/", checkRole(["admin", "system_admin", "hospital_admin", "department_head"]), getAllAssignments);
router.get("/my", checkRole(["doctor", "radiologist", "department_head", "admin", "system_admin", "hospital_admin"]), getMyAssignments);
router.get("/caseload-dashboard", checkRole(["admin", "system_admin", "hospital_admin", "department_head"]), getCaseloadDashboard);
router.post("/auto-assign", checkRole(["admin", "system_admin", "hospital_admin", "department_head", "technician"]), autoAssignDoctor);
router.put("/:id/override", checkRole(["admin", "system_admin", "hospital_admin", "department_head"]), overrideAssignment);
router.put("/:id/acknowledge", checkRole(["doctor", "radiologist", "department_head", "admin", "system_admin", "hospital_admin"]), acknowledgeAssignment);

export default router;
