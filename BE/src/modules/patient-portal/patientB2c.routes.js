import { Router } from "express";
import { protect } from "../../middlewares/auth.middleware.js";
import {
  getPatientMriResult,
  downloadPatientReport,
  generateShareQr,
  viewSharedResult,
  bookFollowUp,
  getMyVisits,
  updateFcmToken,
} from "./patientB2c.controller.js";

const router = Router();

// H.5 — Lịch sử các lần khám (bệnh nhân đăng nhập)
router.get("/my-visits", protect, getMyVisits);

// H.4 — Đặt lịch tái khám
router.post("/book-followup", protect, bookFollowUp);

// H.6 — Cập nhật FCM token
router.put("/fcm-token", protect, updateFcmToken);

// H.1 — Xem ảnh kết quả MRI
router.get("/imaging/:imagingResultId", protect, getPatientMriResult);

// H.2 — Tải báo cáo PDF
router.get("/imaging/:imagingResultId/report-pdf", protect, downloadPatientReport);

// H.3 — Tạo QR chia sẻ
router.post("/imaging/:imagingResultId/share-qr", protect, generateShareQr);

// H.3 — Xem kết quả qua link chia sẻ (public, không cần đăng nhập)
router.get("/shared/:shareToken", viewSharedResult);

export default router;
