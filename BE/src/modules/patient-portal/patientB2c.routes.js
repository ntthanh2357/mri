import { Router } from "express";
import { protect, checkRole } from "../../middlewares/auth.middleware.js";

// Cùng nhóm được đọc kết quả CĐHA ở /imaging/:id, trừ lễ tân (lễ tân không xem nội dung chuyên môn)
const B2C_IMAGING_ROLES = ["patient", "doctor", "radiologist", "department_head", "technician", "nurse", "hospital_admin"];
import { createRateLimiter, tokenUserKey } from "../../middlewares/rateLimiter.middleware.js";
import {
  getPatientMriResult,
  downloadPatientReport,
  streamImagingReportPdf,
  generateShareQr,
  viewSharedResult,
  bookFollowUp,
  getMyVisits,
  updateFcmToken,
} from "./patientB2c.controller.js";

const router = Router();

// H.4–H.6 chỉ dành cho bệnh nhân: trước đây mọi tài khoản (kể cả bác sĩ, admin nền tảng) đặt được "lịch tái khám"
// dưới tên chính mình và lượt khám giả đó hiện trong hàng chờ lễ tân. Nhân viên đã có FCM ở /api/v1/notifications.
const patientOnly = checkRole(["patient"]);

// H.5 — Lịch sử các lần khám (bệnh nhân đăng nhập)
router.get("/my-visits", protect, patientOnly, getMyVisits);

// H.4 — Đặt lịch tái khám
router.post("/book-followup", protect, patientOnly, bookFollowUp);

// H.6 — Cập nhật FCM token
router.put("/fcm-token", protect, patientOnly, updateFcmToken);

// H.1 — Xem ảnh kết quả MRI
router.get("/imaging/:imagingResultId", protect, checkRole(B2C_IMAGING_ROLES), getPatientMriResult);

// H.2 — Tải báo cáo PDF
router.get("/imaging/:imagingResultId/report-pdf", protect, checkRole(B2C_IMAGING_ROLES), downloadPatientReport);

// H.2b — Tải file PDF qua link ngắn hạn (token chứa quyền đã kiểm tra ở H.2)
// tạo PDF + ký số tốn CPU: giới hạn theo người được cấp link (không theo IP tự khai)
router.get("/report-file/:token", createRateLimiter({ windowMs: 60 * 1000, maxRequests: 20, keyGenerator: tokenUserKey("report-file"), message: "Bạn tải quá nhanh. Vui lòng đợi 1 phút." }), streamImagingReportPdf);

// H.3 — Tạo QR chia sẻ
router.post("/imaging/:imagingResultId/share-qr", protect, checkRole(["patient"]), generateShareQr);

// H.3 — Xem kết quả qua link chia sẻ (public, không cần đăng nhập)
router.get("/shared/:shareToken", viewSharedResult);

export default router;
