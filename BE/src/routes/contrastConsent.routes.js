import { Router } from "express";
import { protect, checkRole, denyPlatformAdmin } from "../middlewares/auth.middleware.js";
import {
  submitScreeningChecklist,
  overrideChecklistRisk,
  signPatientConsent,
  getConsentByVisit
} from "../controllers/contrastConsent.controller.js";

const router = Router();
router.use(protect);
router.use(denyPlatformAdmin); // module lâm sàng: tài khoản nền tảng không truy cập

router.post(
  "/screening",
  checkRole(["technician", "nurse", "doctor", "radiologist", "department_head", "admin", "system_admin", "hospital_admin"]),
  submitScreeningChecklist
);
router.post(
  "/:id/override",
  checkRole(["doctor", "radiologist", "department_head"]),
  overrideChecklistRisk
);
router.post("/:id/sign-patient", signPatientConsent);
router.get("/visit/:visitId", checkRole(["patient", "technician", "nurse", "doctor", "radiologist", "department_head", "receptionist", "admin", "system_admin", "hospital_admin"]), getConsentByVisit);

export default router;
