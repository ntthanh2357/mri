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
  .get(checkRole(["doctor", "nurse", "receptionist", "admin", "hospital_admin"]), getRecords)
  .post(checkRole(["doctor", "nurse", "receptionist", "admin", "hospital_admin"]), createRecord);

router.route("/records/:id")
  .get(checkRole(["doctor", "nurse", "receptionist", "admin", "hospital_admin"]), getRecordById)
  .put(checkRole(["doctor", "nurse", "receptionist", "admin", "hospital_admin"]), updateRecord);

router.route("/records/:id/care-sheets")
  .get(checkRole(["doctor", "nurse", "receptionist", "admin", "hospital_admin"]), getCareSheets)
  .post(checkRole(["doctor", "nurse", "receptionist", "admin", "hospital_admin"]), createCareSheet);

router.route("/records/:id/consultations")
  .get(checkRole(["doctor", "admin", "hospital_admin"]), getConsultations)
  .post(checkRole(["doctor", "admin", "hospital_admin"]), createConsultation);

router.route("/records/:id/consents")
  .get(checkRole(["doctor", "patient", "admin", "hospital_admin"]), getConsents)
  .post(checkRole(["doctor", "admin", "hospital_admin"]), createConsent);

router.route("/consents/:consentId/sign")
  .put(checkRole(["doctor", "patient", "admin", "hospital_admin"]), signConsent);

router.route("/records/:id/versions")
  .get(checkRole(["doctor", "admin", "hospital_admin"]), getRecordVersions);

export default router;
