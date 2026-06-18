import { Router } from "express";
import {
  getRecords,
  createRecord,
  getRecordById,
  updateRecord,
  getCareSheets,
  createCareSheet,
  getConsultations,
  createConsultation,
  getConsents,
  createConsent,
  signConsent,
} from "../controllers/emr.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

// Secure all EMR routes
router.use(protect);

router.route("/records")
  .get(getRecords)
  .post(createRecord);

router.route("/records/:id")
  .get(getRecordById)
  .put(updateRecord);

router.route("/records/:id/care-sheets")
  .get(getCareSheets)
  .post(createCareSheet);

router.route("/records/:id/consultations")
  .get(getConsultations)
  .post(createConsultation);

router.route("/records/:id/consents")
  .get(getConsents)
  .post(createConsent);

router.route("/consents/:consentId/sign")
  .put(signConsent);

export default router;
