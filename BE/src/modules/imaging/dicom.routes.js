import { Router } from "express";
import { protect } from "../../middlewares/auth.middleware.js";
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

router.get("/studies", getAllStudies);
router.post("/studies", createDicomStudy);
router.get("/studies/:id/viewer-manifest", getViewerManifest);
router.get("/studies/:id", getStudyById);
router.get("/studies/by-visit/:visitId", getStudiesByVisit);
router.post("/studies/:id/validate", validateStudy);

export default router;
