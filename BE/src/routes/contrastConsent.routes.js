import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  submitScreeningChecklist,
  overrideChecklistRisk,
  signPatientConsent,
  getConsentByVisit
} from "../controllers/contrastConsent.controller.js";

const router = Router();
router.use(protect);

router.post("/screening", submitScreeningChecklist);
router.post("/:id/override", overrideChecklistRisk);
router.post("/:id/sign-patient", signPatientConsent);
router.get("/visit/:visitId", getConsentByVisit);

export default router;
