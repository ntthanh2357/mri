import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  createPatientFolderStructure,
  runDailyWeeklyBackup,
  checkDriveCapacity,
  getSignedShareLink,
  cleanupOrphanFiles
} from "../controllers/driveStorage.controller.js";

const router = Router();
router.use(protect);

router.post("/patient-folders", createPatientFolderStructure);
router.post("/run-backup", runDailyWeeklyBackup);
router.get("/capacity-check", checkDriveCapacity);
router.get("/share-link/:fileId", getSignedShareLink);
router.post("/cleanup-orphans", cleanupOrphanFiles);

export default router;
