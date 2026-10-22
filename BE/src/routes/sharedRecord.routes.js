import { Router } from "express";
import { createRateLimiter } from "../middlewares/rateLimiter.middleware.js";
import { protect, checkRole } from "../middlewares/auth.middleware.js";
import * as ctrl from "../controllers/recordShare.controller.js";
import { streamImage } from "../controllers/scannedDocument.controller.js";

// UC-PAT-09 — Trang xem bệnh án qua QR: công khai (không đăng nhập), giới hạn tần suất chống dò mã.
const router = Router();

// Ảnh giấy tờ tự quét: theo link ngắn hạn có chữ ký; 1 trang có thể tải vài chục ảnh nên đếm riêng (khoá riêng),
// không ăn vào hạn mức 30 lần/phút của redeem/view bên dưới
router.get("/document-image/:token", createRateLimiter({ windowMs: 60 * 1000, maxRequests: 120, keyGenerator: (req, ip) => `${ip}:document-image`, message: "Quá nhiều yêu cầu tải ảnh từ địa chỉ IP của bạn." }), streamImage);

// Khoá đếm riêng, chỉ theo IP: khoá mặc định ghép thêm req.body.email nên kẻ dò mã chỉ cần đổi email mỗi lần là có hạn mức mới
router.use(createRateLimiter({ windowMs: 60 * 1000, maxRequests: 30, keyGenerator: (req, ip) => `${ip}:shared-records`, message: "Quá nhiều yêu cầu xem bệnh án từ địa chỉ IP của bạn." }));

router.post("/redeem", ctrl.redeem);
// Nhân viên quét mã trong app (cổng nội bộ): phải đăng nhập, ghi lại tên người mở cho bệnh nhân xem
router.post("/redeem-staff", protect, checkRole(["doctor", "nurse", "receptionist", "technician"]), ctrl.redeemAsStaff);
router.post("/view", ctrl.view);

export default router;
