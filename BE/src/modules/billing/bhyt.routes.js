import { Router } from "express";
import { protect } from "../../middlewares/auth.middleware.js";
import {
  saveBhytInfo,
  getBhytInfo,
  calculateCopay,
  applyBhytToInvoice,
  exportBhytClaims,
} from "./bhyt.controller.js";

const router = Router();

// R.1 — Lưu thông tin thẻ BHYT
router.post("/:patientId", protect, saveBhytInfo);

// R.1 — Xem thông tin BHYT
router.get("/:patientId", protect, getBhytInfo);

// R.2 — Tính mức hưởng & đồng chi trả
router.post("/calculate-copay", protect, calculateCopay);

// R.2 — Áp dụng BHYT vào hóa đơn
router.put("/apply-to-invoice/:invoiceId", protect, applyBhytToInvoice);

// R.3 — Xuất hồ sơ giám định điện tử
router.post("/export-claims", protect, exportBhytClaims);

export default router;
