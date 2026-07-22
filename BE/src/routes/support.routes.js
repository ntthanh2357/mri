import { Router } from "express";
import {
  createTicket,
  getMyTickets,
  getAllTickets,
  updateTicketStatus,
  getSystemMetrics,
} from "../controllers/support.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { requireSystemAdmin, requireHospitalAdmin } from "../middlewares/role.middleware.js";

const router = Router();

// Tất cả route yêu cầu đăng nhập
router.use(protect);

// ─── Ticket Routes ────────────────────────────────────────────────────────────
// Người dùng gửi và xem ticket của mình
router.post("/tickets", createTicket);
router.get("/tickets", getMyTickets);

// Admin xem tất cả tickets và cập nhật trạng thái
router.get("/tickets/all", requireSystemAdmin, getAllTickets);
router.put("/tickets/:id/status", requireSystemAdmin, updateTicketStatus);

// ─── System Metrics ───────────────────────────────────────────────────────────
// Metrics hệ thống cho màn hình SystemAdmin (staff hoặc admin)
router.get("/system-metrics", getSystemMetrics);

export default router;
