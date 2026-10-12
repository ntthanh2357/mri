import { Router } from "express";
import { protect, checkRole } from "../middlewares/auth.middleware.js";
import * as ctrl from "../controllers/queueTicket.controller.js";

// UC-PAT-03 — Số thứ tự tiếp đón: /api/v1/queue-tickets
const router = Router();
router.use(protect);

const patientOnly = checkRole(["patient"]);
const frontDesk = checkRole(["receptionist", "nurse", "hospital_admin"]);

// Bệnh nhân
router.get("/hospitals", patientOnly, ctrl.listHospitals);
router.get("/me", patientOnly, ctrl.getMine);
router.post("/", patientOnly, ctrl.take);
router.put("/me/cancel", patientOnly, ctrl.cancelMine);

// Quầy tiếp đón
router.get("/today", frontDesk, ctrl.listToday);
router.get("/settings", frontDesk, ctrl.getSettings);
router.put("/settings", frontDesk, ctrl.updateSettings);
router.post("/call-next", frontDesk, ctrl.callNext);
router.put("/:id/arrived", frontDesk, ctrl.markArrived);
router.put("/:id/missed", frontDesk, ctrl.markMissed);
router.put("/:id/served", frontDesk, ctrl.markServed);

export default router;
