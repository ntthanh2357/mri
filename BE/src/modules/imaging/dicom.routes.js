import { Router } from "express";
import { protect, checkRole } from "../../middlewares/auth.middleware.js";
import {
  createDicomStudy,
  getStudyById,
  getStudiesByVisit,
  validateStudy,
  getAllStudies,
  getViewerManifest
} from "./dicom.controller.js";

const router = Router();
router.use(protect);
// Chỉ nhân sự CĐHA và điều trị, trừ trình xem phim bên dưới.
const DICOM_STAFF_ROLES = ["doctor", "radiologist", "department_head", "technician", "nurse", "hospital_admin"];

// Màn kết quả dùng trình xem này cho cả bệnh nhân; bệnh nhân bị kiểm tra quyền sở hữu trong controller.
router.get("/studies/:id/viewer-manifest", checkRole([...DICOM_STAFF_ROLES, "patient"]), getViewerManifest);

router.use(checkRole(DICOM_STAFF_ROLES));

router.get("/studies", getAllStudies);
router.post("/studies", createDicomStudy);
router.get("/studies/:id", getStudyById);
router.get("/studies/by-visit/:visitId", getStudiesByVisit);
router.post("/studies/:id/validate", validateStudy);

export default router;
