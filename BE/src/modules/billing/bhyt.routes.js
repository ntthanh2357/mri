import { Router } from "express";
import { protect, checkRole } from "../../middlewares/auth.middleware.js";
import {
  saveBhytInfo,
  getBhytInfo,
  calculateCopay,
  applyBhytToInvoice,
  exportBhytClaims,
  getActiveBhyt,
  getActiveCards,
} from "./bhyt.controller.js";

const router = Router();
router.use(protect);

// QUAN TRỌNG: route tĩnh PHẢI đứng TRƯỚC route tham số /:patientId, nếu không
// Express sẽ khớp POST /export-claims (và /calculate-copay) vào /:patientId →
// rơi vào saveBhytInfo → trả 400 "Số thẻ BHYT là bắt buộc" (bug shadowing).

const BHYT_CLINICAL_ROLES = ["receptionist", "nurse", "doctor", "admin", "system_admin", "hospital_admin"];

// R.2 — Tính mức hưởng & đồng chi trả
router.post("/calculate-copay", checkRole(["receptionist", "nurse", "admin", "hospital_admin"]), calculateCopay);

// R.3 — Xuất hồ sơ giám định điện tử
router.post("/export-claims", checkRole(["admin", "system_admin", "hospital_admin"]), exportBhytClaims);

// R.2 — Áp dụng BHYT vào hóa đơn
router.put("/apply-to-invoice/:invoiceId", checkRole(["receptionist", "nurse", "admin", "hospital_admin"]), applyBhytToInvoice);

// UC-REC-02 — Thẻ đang dùng
router.get("/active-cards", checkRole(BHYT_CLINICAL_ROLES), getActiveCards);
router.get("/:patientId/active", checkRole(BHYT_CLINICAL_ROLES), getActiveBhyt);

// R.1 — Lưu thông tin thẻ BHYT (route tham số — đặt sau cùng)
router.post("/:patientId", checkRole(["receptionist", "nurse", "admin", "hospital_admin"]), saveBhytInfo);

// R.1 — Xem thông tin BHYT (toàn bộ lịch sử thẻ)
router.get("/:patientId", checkRole(BHYT_CLINICAL_ROLES), getBhytInfo);

export default router;
