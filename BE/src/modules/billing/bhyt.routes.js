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

// QUAN TRỌNG: route tĩnh PHẢI đứng TRƯỚC route tham số /:patientId, nếu không
// Express sẽ khớp POST /export-claims (và /calculate-copay) vào /:patientId →
// rơi vào saveBhytInfo → trả 400 "Số thẻ BHYT là bắt buộc" (bug shadowing).

// R.2 — Tính mức hưởng & đồng chi trả
router.post("/calculate-copay", protect, calculateCopay);

// R.3 — Xuất hồ sơ giám định điện tử
router.post("/export-claims", protect, exportBhytClaims);

// R.2 — Áp dụng BHYT vào hóa đơn
router.put("/apply-to-invoice/:invoiceId", protect, applyBhytToInvoice);

// R.1 — Lưu thông tin thẻ BHYT (route tham số — đặt sau cùng)
router.post("/:patientId", protect, saveBhytInfo);

// R.1 — Xem thông tin BHYT (route tham số — đặt sau cùng)
router.get("/:patientId", protect, getBhytInfo);

export default router;
