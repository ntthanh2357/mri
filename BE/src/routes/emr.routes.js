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
  getRecordVersions,
} from "../controllers/emr.controller.js";
import { protect, checkRole } from "../middlewares/auth.middleware.js";

const router = Router();

// Secure all EMR routes
router.use(protect);

router.route("/records")
  .get(checkRole(["doctor", "nurse", "admin"]), getRecords)
  .post(checkRole(["doctor", "nurse", "admin"]), createRecord);

router.route("/records/:id")
  .get(checkRole(["doctor", "nurse", "admin"]), getRecordById)
  .put(checkRole(["doctor", "nurse", "admin"]), updateRecord);

router.route("/records/:id/care-sheets")
  .get(checkRole(["doctor", "nurse", "admin"]), getCareSheets)
  .post(checkRole(["nurse", "admin"]), createCareSheet);

router.route("/records/:id/consultations")
  .get(checkRole(["doctor", "admin"]), getConsultations)
  .post(checkRole(["doctor", "admin"]), createConsultation);

router.route("/records/:id/consents")
  .get(checkRole(["doctor", "patient", "admin"]), getConsents)
  .post(checkRole(["doctor", "admin"]), createConsent);

router.route("/consents/:consentId/sign")
  .put(checkRole(["doctor", "patient", "admin"]), signConsent);

router.route("/records/:id/versions")
  .get(checkRole(["doctor", "admin"]), getRecordVersions);

export default router;
