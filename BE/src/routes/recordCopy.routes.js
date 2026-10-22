import { Router } from "express";
import { protect, checkRole } from "../middlewares/auth.middleware.js";
import { createRateLimiter, tokenUserKey } from "../middlewares/rateLimiter.middleware.js";
import * as ctrl from "../controllers/recordCopy.controller.js";

// Bản sao bệnh án — phía bệnh viện: /api/v1/record-copies (phía bệnh nhân ở /api/v1/patient/record-copies)
const router = Router();

// Tải PDF: công khai theo token ngắn hạn (khoá dẫn xuất riêng). PDF đã ký sẵn lúc duyệt; vẫn giới hạn theo người được cấp link
router.get("/file/:token", createRateLimiter({ windowMs: 60 * 1000, maxRequests: 20, keyGenerator: tokenUserKey("record-copy-file"), message: "Bạn tải quá nhanh. Vui lòng đợi 1 phút." }), ctrl.streamFile);

router.use(protect);
const reviewers = checkRole(["receptionist", "hospital_admin"]);
router.get("/", reviewers, ctrl.listForHospital);
router.put("/:id/approve", reviewers, ctrl.approve);
router.put("/:id/reject", reviewers, ctrl.reject);

export default router;
