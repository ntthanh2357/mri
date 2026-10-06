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
  getPharmacyQueue,
  verifyPrescription,
  rejectPrescription,
  dispensePrescription,
  postHocReviewPrescription,
  getDoctorOverrideStats,
} from "./drug.controller.js";
import { protect, checkRole } from "../../middlewares/auth.middleware.js";

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

// ── Pharmacy Queue & Dispense Workflow (Phase 3A) ─────────────────────────────
router.get("/queue", checkRole(["pharmacist", "hospital_admin", "admin"]), getPharmacyQueue);
router.post("/prescriptions/:id/verify", checkRole(["pharmacist", "hospital_admin", "admin"]), verifyPrescription);
router.post("/prescriptions/:id/reject", checkRole(["pharmacist", "hospital_admin", "admin"]), rejectPrescription);
router.post("/prescriptions/:id/dispense", checkRole(["pharmacist", "hospital_admin", "admin"]), dispensePrescription);
router.post("/prescriptions/:id/post-hoc-review", checkRole(["pharmacist", "hospital_admin", "admin"]), postHocReviewPrescription);

// ── Pharmacy Audit & Analytics ────────────────────────────────────────────────
router.get("/audit/override-stats", checkRole(["hospital_admin", "admin", "pharmacist", "doctor"]), getDoctorOverrideStats);

export default router;
