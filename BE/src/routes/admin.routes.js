import { Router } from "express";
import {
  fetchUsers,
  lockUser,
fetchDatasets,
  addDataset,
  fetchAuditLogs,
  fetchUserById,
  lockUserById,
  unlockUserById,
  fetchStats,
updateDatasetPrice,
  anonymizeData,
  getAiFeedback,
  retrainAiModel,
  getChatbotConfig,
  saveChatbotConfig,
  verifyAdminUser,
  getAiTrainingStats,
  getDashboardStats,
  updateHospitalPricing,
  createUser,
  fetchHospitals,
  provisionHospital,
  getHospitalById,
  activateHospital,
  resetHospitalPassword,
} from "../controllers/admin.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { requireSystemAdmin, requireHospitalAdmin } from "../middlewares/role.middleware.js";

const router = Router();

router.use(protect);

// ─── Existing routes (backward compat) ───────────────────────────────────────
router.get("/users", requireSystemAdmin, fetchUsers);
router.post("/users/lock", requireSystemAdmin, lockUser);
router.get("/datasets", requireSystemAdmin, fetchDatasets);
router.post("/datasets", requireSystemAdmin, addDataset);
router.get("/audit-logs", requireSystemAdmin, fetchAuditLogs);

// ─── New routes (task 4.1) ────────────────────────────────────────────────────
router.get("/users/:id", requireSystemAdmin, fetchUserById);
router.put("/users/:id/lock", requireSystemAdmin, lockUserById);
router.put("/users/:id/unlock", requireSystemAdmin, unlockUserById);
router.put("/users/:id/verify", requireSystemAdmin, verifyAdminUser);
router.get("/stats", requireSystemAdmin, fetchStats);
router.put("/datasets/:id/price", requireSystemAdmin, updateDatasetPrice);
router.post("/anonymize", requireSystemAdmin, anonymizeData);
router.post("/users", requireSystemAdmin, createUser);
router.get("/hospitals", requireSystemAdmin, fetchHospitals);
router.post("/hospitals/provision", requireSystemAdmin, provisionHospital);
router.get("/hospitals/:id", requireSystemAdmin, getHospitalById);
router.put("/hospitals/:id/activate", requireSystemAdmin, activateHospital);
router.post("/hospitals/:id/reset-password", requireSystemAdmin, resetHospitalPassword);

// ─── AI & Chatbot Management routes ──────────────────────────────────────────
router.get("/ai-feedback", requireSystemAdmin, getAiFeedback);
router.post("/ai-retrain", requireSystemAdmin, retrainAiModel);
router.get("/chatbot-config", requireSystemAdmin, getChatbotConfig);
router.post("/chatbot-config", requireSystemAdmin, saveChatbotConfig);
router.get("/ai-training-stats", requireSystemAdmin, getAiTrainingStats);

// ─── Hospital Operations Dashboard ───────────────────────────────────────────
router.get("/dashboard", requireHospitalAdmin, getDashboardStats);
router.put("/hospital-pricing", requireHospitalAdmin, updateHospitalPricing);

export default router;
