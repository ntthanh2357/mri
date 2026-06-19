import { Router } from "express";
import {
  fetchUsers,
  lockUser,
  fetchDoctors,
  verifyDoctorAccount,
  fetchDatasets,
  addDataset,
  fetchAuditLogs,
  fetchUserById,
  lockUserById,
  unlockUserById,
  fetchStats,
  verifyDoctorById,
  updateDatasetPrice,
  anonymizeData,
  getAiFeedback,
  retrainAiModel,
  getChatbotConfig,
  saveChatbotConfig,
  verifyAdminUser,
} from "../controllers/admin.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/role.middleware.js";

const router = Router();

router.use(protect, requireAdmin);

// ─── Existing routes (backward compat) ───────────────────────────────────────
router.get("/users", fetchUsers);
router.post("/users/lock", lockUser);
router.get("/doctors", fetchDoctors);
router.post("/doctors/verify", verifyDoctorAccount);
router.get("/datasets", fetchDatasets);
router.post("/datasets", addDataset);
router.get("/audit-logs", fetchAuditLogs);

// ─── New routes (task 4.1) ────────────────────────────────────────────────────
router.get("/users/:id", fetchUserById);
router.put("/users/:id/lock", lockUserById);
router.put("/users/:id/unlock", unlockUserById);
router.put("/users/:id/verify", verifyAdminUser);
router.get("/stats", fetchStats);
router.put("/doctors/:id/verify", verifyDoctorById);
router.put("/datasets/:id/price", updateDatasetPrice);
router.post("/anonymize", anonymizeData);

// ─── AI & Chatbot Management routes ──────────────────────────────────────────
router.get("/ai-feedback", getAiFeedback);
router.post("/ai-retrain", retrainAiModel);
router.get("/chatbot-config", getChatbotConfig);
router.post("/chatbot-config", saveChatbotConfig);

export default router;
