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
  createRecordAddendum,
  signMedicalRecord,
  getPrivacyConsents,
  createPrivacyConsent,
  revokePrivacyConsent,
  approveTumorBoard,
} from "./emr.controller.js";
import { protect, checkRole } from "../../middlewares/auth.middleware.js";

const router = Router();

// Secure all EMR routes
router.use(protect);

const EMR_READ_ROLES = [
  "doctor",
  "radiologist",
  "department_head",
  "nurse",
  "technician",
  "lab_technician",
  "pharmacist",
  "receptionist",
  "admin",
  "system_admin",
  "hospital_admin",
];

router.route("/records")
  .get(checkRole(EMR_READ_ROLES), getRecords)
  .post(checkRole(["doctor", "department_head", "nurse", "receptionist", "admin", "system_admin", "hospital_admin"]), createRecord);

router.route("/records/:id")
  .get(checkRole(EMR_READ_ROLES), getRecordById)
  .put(checkRole(["doctor", "department_head", "nurse", "receptionist", "admin", "system_admin", "hospital_admin"]), updateRecord);

router.route("/records/:id/care-sheets")
  .get(checkRole(["doctor", "radiologist", "department_head", "nurse", "receptionist", "admin", "system_admin", "hospital_admin"]), getCareSheets)
  .post(checkRole(["doctor", "department_head", "nurse", "admin", "system_admin", "hospital_admin"]), createCareSheet);

router.route("/records/:id/consultations")
  .get(checkRole(["doctor", "radiologist", "department_head", "admin", "system_admin", "hospital_admin"]), getConsultations)
  .post(checkRole(["doctor", "radiologist", "department_head", "admin", "system_admin", "hospital_admin"]), createConsultation);

router.post("/consultations/:id/approve-tumor-board", checkRole(["department_head", "hospital_admin", "admin", "system_admin"]), approveTumorBoard);

router.route("/records/:id/consents")
  .get(checkRole(["doctor", "department_head", "patient", "admin", "system_admin", "hospital_admin"]), getConsents)
  .post(checkRole(["doctor", "department_head", "admin", "system_admin", "hospital_admin"]), createConsent);

router.route("/consents/:consentId/sign")
  .put(checkRole(["doctor", "department_head", "patient", "admin", "system_admin", "hospital_admin"]), signConsent);

router.route("/records/:id/versions")
  .get(checkRole(["doctor", "radiologist", "department_head", "admin", "system_admin", "hospital_admin"]), getRecordVersions);

router.route("/records/:id/addendum")
  .post(checkRole(["doctor", "department_head", "admin", "system_admin", "hospital_admin"]), createRecordAddendum);

router.route("/records/:id/sign")
  .put(checkRole(["doctor", "department_head", "admin", "system_admin", "hospital_admin"]), signMedicalRecord);

// Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 & NĐ 13/2023: Thu thập và thu hồi sự đồng thuận
const PRIVACY_CONSENT_ROLES = [
  "patient",
  "doctor",
  "radiologist",
  "department_head",
  "nurse",
  "receptionist",
  "admin",
  "system_admin",
  "hospital_admin",
];

router.route("/privacy-consents")
  .get(checkRole(PRIVACY_CONSENT_ROLES), getPrivacyConsents)
  .post(checkRole(PRIVACY_CONSENT_ROLES), createPrivacyConsent);

router.route("/privacy-consents/:id/revoke")
  .post(checkRole(PRIVACY_CONSENT_ROLES), revokePrivacyConsent);

export default router;
