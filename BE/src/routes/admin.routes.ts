import { Router } from "express";
import {
  fetchUsers,
  lockUser,
  fetchDoctors,
  verifyDoctorAccount,
  fetchDatasets,
  addDataset,
  fetchAuditLogs,
} from "../controllers/admin.controller";
import { protect } from "../middlewares/auth.middleware";
import { requireAdmin } from "../middlewares/role.middleware";

const router = Router();

router.use(protect, requireAdmin);

router.get("/users", fetchUsers);
router.post("/users/lock", lockUser);
router.get("/doctors", fetchDoctors);
router.post("/doctors/verify", verifyDoctorAccount);
router.get("/datasets", fetchDatasets);
router.post("/datasets", addDataset);
router.get("/audit-logs", fetchAuditLogs);

export default router;
