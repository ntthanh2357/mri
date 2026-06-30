import { Router } from "express";
import {
  checkPrescription,
  getDrugs,
  getDrugById,
  createDrug,
  updateDrug,
  deleteDrug,
  updateStock,
  getLowStockAlerts,
} from "../controllers/drug.controller.js";
import { protect, checkRole } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(protect);

// ── Check Prescription ────────────────────────────────────────────────────────
router.post("/check-prescription", checkRole(["doctor", "admin"]), checkPrescription);

// ── Low Stock Alerts ──────────────────────────────────────────────────────────
router.get("/alerts/low-stock", checkRole(["hospital_admin", "admin"]), getLowStockAlerts);

// ── Drug CRUD ────────────────────────────────────────────────────────────────
router.get("/", checkRole(["doctor", "nurse", "receptionist", "technician", "hospital_admin", "admin"]), getDrugs);
router.get("/:id", checkRole(["doctor", "nurse", "receptionist", "technician", "hospital_admin", "admin"]), getDrugById);
router.post("/", checkRole(["hospital_admin"]), createDrug);
router.put("/:id", checkRole(["hospital_admin"]), updateDrug);
router.delete("/:id", checkRole(["hospital_admin"]), deleteDrug);

// ── Stock Adjustments ─────────────────────────────────────────────────────────
router.post("/:id/stock", checkRole(["hospital_admin"]), updateStock);

export default router;

