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
// Bệnh nhân tự ký phiếu của chính mình, hoặc nhân viên lâm sàng tại phòng chụp ghi nhận chữ ký của bệnh nhân/đại diện.
// Trước đây chỉ có protect: lễ tân, dược sĩ, thu ngân… cũng "ký thay" được.
router.post(
  "/:id/sign-patient",
  checkRole(["patient", "technician", "nurse", "doctor", "radiologist", "department_head"]),
  signPatientConsent
);
router.get("/visit/:visitId", checkRole(["patient", "technician", "nurse", "doctor", "radiologist", "department_head", "receptionist", "admin", "system_admin", "hospital_admin"]), getConsentByVisit);

export default router;
