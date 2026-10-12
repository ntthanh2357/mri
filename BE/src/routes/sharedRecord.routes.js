import { Router } from "express";
import { createRateLimiter } from "../middlewares/rateLimiter.middleware.js";
import * as ctrl from "../controllers/recordShare.controller.js";

// UC-PAT-09 — Trang xem bệnh án qua QR: công khai (không đăng nhập), giới hạn tần suất chống dò mã.
const router = Router();
router.use(createRateLimiter({ windowMs: 60 * 1000, maxRequests: 30, message: "Quá nhiều yêu cầu xem bệnh án từ địa chỉ IP của bạn." }));

router.post("/redeem", ctrl.redeem);
router.post("/view", ctrl.view);

export default router;
