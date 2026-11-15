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

// Tài khoản nền tảng (admin, system_admin) không đọc/ghi dữ liệu lâm sàng và cam kết dữ liệu của bệnh viện (RELEASE_v3.4).
const EMR_READ_ROLES = [
  "doctor",
  "radiologist",
  "department_head",
  "nurse",
  "technician",
  "lab_technician",
  "pharmacist",
  "receptionist",
  "hospital_admin",
];

router.route("/records")
  .get(checkRole(EMR_READ_ROLES), getRecords)
  .post(checkRole(["doctor", "department_head", "nurse", "receptionist", "hospital_admin"]), createRecord);

router.route("/records/:id")
  .get(checkRole(EMR_READ_ROLES), getRecordById)
  .put(checkRole(["doctor", "department_head", "nurse", "receptionist", "hospital_admin"]), updateRecord);

router.route("/records/:id/care-sheets")
  .get(checkRole(["doctor", "radiologist", "department_head", "nurse", "receptionist", "hospital_admin"]), getCareSheets)
  .post(checkRole(["doctor", "department_head", "nurse", "hospital_admin"]), createCareSheet);

router.route("/records/:id/consultations")
  .get(checkRole(["doctor", "radiologist", "department_head", "hospital_admin"]), getConsultations)
  .post(checkRole(["doctor", "radiologist", "department_head", "hospital_admin"]), createConsultation);

router.post("/consultations/:id/approve-tumor-board", checkRole(["department_head", "hospital_admin"]), approveTumorBoard);

router.route("/records/:id/consents")
  .get(checkRole(["doctor", "department_head", "patient", "hospital_admin"]), getConsents)
  .post(checkRole(["doctor", "department_head", "hospital_admin"]), createConsent);

router.route("/consents/:consentId/sign")
  .put(checkRole(["doctor", "department_head", "patient", "hospital_admin"]), signConsent);

router.route("/records/:id/versions")
  .get(checkRole(["doctor", "radiologist", "department_head", "hospital_admin"]), getRecordVersions);

router.route("/records/:id/addendum")
  .post(checkRole(["doctor", "department_head", "hospital_admin"]), createRecordAddendum);

router.route("/records/:id/sign")
  .put(checkRole(["doctor", "department_head", "hospital_admin"]), signMedicalRecord);

// Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 & NĐ 13/2023: Thu thập và thu hồi sự đồng thuận
// Cam kết chứa định danh người bệnh: chỉ bệnh nhân và nhân viên của bệnh viện (tài khoản nền tảng không tham gia)
const PRIVACY_CONSENT_ROLES = [
  "patient",
  "doctor",
  "radiologist",
  "department_head",
  "nurse",
  "receptionist",
  "hospital_admin",
];

router.route("/privacy-consents")
  .get(checkRole(PRIVACY_CONSENT_ROLES), getPrivacyConsents)
  .post(checkRole(PRIVACY_CONSENT_ROLES), createPrivacyConsent);

router.route("/privacy-consents/:id/revoke")
  .post(checkRole(PRIVACY_CONSENT_ROLES), revokePrivacyConsent);

export default router;
