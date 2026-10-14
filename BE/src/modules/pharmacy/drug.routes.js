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
  getExpiryAlerts,
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

// ⚠️ [P1-FIX Route Ordering] Các route GET có path CỤ THỂ (/queue, /alerts/...,
// /audit/...) bắt buộc phải đăng ký TRƯỚC route generic /:id — Express khớp
// theo thứ tự đăng ký, nếu /:id đứng trước sẽ nuốt mất "/queue" và
// "/audit/override-stats" (điều hướng nhầm sang getDrugById → "ID thuốc
// không hợp lệ", cả Queue lẫn Audit bị chết hoàn toàn).

// ── Check Prescription ────────────────────────────────────────────────────────
router.post("/check-prescription", checkRole(["doctor", "admin"]), checkPrescription);

// ── Low Stock Alerts ──────────────────────────────────────────────────────────
// [P0-Pharmacist] Dược sĩ trực tiếp theo dõi tồn kho & cảnh báo hết hạn (UC-PHA-07)
router.get("/alerts/low-stock", checkRole(["pharmacist", "hospital_admin", "admin"]), getLowStockAlerts);

// ── Expiry Alerts theo lô (UC-PHA-07) ─────────────────────────────────────────
// ⚠️ Phải khai báo TRƯỚC /:id (cùng quy tắc route-order với /queue phía dưới).
router.get("/alerts/expiring", checkRole(["hospital_admin", "admin", "pharmacist"]), getExpiryAlerts);

// ── Pharmacy Queue & Dispense Workflow (Phase 3A) ─────────────────────────────
router.get("/queue", checkRole(["pharmacist", "hospital_admin", "admin"]), getPharmacyQueue);
router.post("/prescriptions/:id/verify", checkRole(["pharmacist", "hospital_admin", "admin"]), verifyPrescription);
router.post("/prescriptions/:id/reject", checkRole(["pharmacist", "hospital_admin", "admin"]), rejectPrescription);
router.post("/prescriptions/:id/dispense", checkRole(["pharmacist", "hospital_admin", "admin"]), dispensePrescription);
router.post("/prescriptions/:id/post-hoc-review", checkRole(["pharmacist", "hospital_admin", "admin"]), postHocReviewPrescription);

// ── Pharmacy Audit & Analytics ────────────────────────────────────────────────
router.get("/audit/override-stats", checkRole(["hospital_admin", "admin", "pharmacist", "doctor"]), getDoctorOverrideStats);

// ── Drug CRUD (generic /:id ĐỨNG CUỐI) ───────────────────────────────────────
// [P0-Pharmacist] Dược sĩ được tra cứu danh mục thuốc (kèm tồn kho, hạn dùng)
router.get("/", checkRole(["doctor", "nurse", "receptionist", "technician", "pharmacist", "hospital_admin", "admin"]), getDrugs);
router.get("/:id", checkRole(["doctor", "nurse", "receptionist", "technician", "pharmacist", "hospital_admin", "admin"]), getDrugById);
router.post("/", checkRole(["hospital_admin"]), createDrug);
router.put("/:id", checkRole(["hospital_admin"]), updateDrug);
router.delete("/:id", checkRole(["hospital_admin"]), deleteDrug);

// ── Stock Adjustments (UC-PHA-07) ─────────────────────────────────────────────
// Dược sĩ điều chỉnh kho (nhập lô / xuất FEFO / kiểm kê) theo đúng đặc tả vai trò;
// CRUD danh mục thuốc (định nghĩa danh mục là quyết định quản trị) vẫn giữ cho hospital_admin.
router.post("/:id/stock", checkRole(["hospital_admin", "pharmacist", "admin"]), updateStock);

export default router;
