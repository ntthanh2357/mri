import { Router } from "express";
import { createRateLimiter } from "../middlewares/rateLimiter.middleware.js";
import * as ctrl from "../controllers/recordShare.controller.js";
import { streamImage } from "../controllers/scannedDocument.controller.js";

// UC-PAT-09 — Trang xem bệnh án qua QR: công khai (không đăng nhập), giới hạn tần suất chống dò mã.
const router = Router();

// Ảnh giấy tờ tự quét: theo link ngắn hạn có chữ ký; 1 trang có thể tải vài chục ảnh nên đếm riêng (khoá riêng),
// không ăn vào hạn mức 30 lần/phút của redeem/view bên dưới
router.get("/document-image/:token", createRateLimiter({ windowMs: 60 * 1000, maxRequests: 120, keyGenerator: (req, ip) => `${ip}:document-image`, message: "Quá nhiều yêu cầu tải ảnh từ địa chỉ IP của bạn." }), streamImage);

router.use(createRateLimiter({ windowMs: 60 * 1000, maxRequests: 30, message: "Quá nhiều yêu cầu xem bệnh án từ địa chỉ IP của bạn." }));

router.post("/redeem", ctrl.redeem);
router.post("/view", ctrl.view);

export default router;
