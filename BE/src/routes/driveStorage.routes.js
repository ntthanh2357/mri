import { Router } from "express";
import { protect, checkRole } from "../middlewares/auth.middleware.js";
import {
  createPatientFolderStructure,
  runDailyWeeklyBackup,
  checkDriveCapacity,
  cleanupOrphanFiles
} from "../controllers/driveStorage.controller.js";

const router = Router();
router.use(protect);

router.post("/patient-folders", checkRole(["admin", "system_admin", "hospital_admin", "doctor", "technician"]), createPatientFolderStructure);
router.post("/run-backup", checkRole(["admin", "system_admin", "hospital_admin"]), runDailyWeeklyBackup);
router.get("/capacity-check", checkRole(["admin", "hospital_admin"]), checkDriveCapacity);
router.post("/cleanup-orphans", checkRole(["admin", "hospital_admin"]), cleanupOrphanFiles);

export default router;
