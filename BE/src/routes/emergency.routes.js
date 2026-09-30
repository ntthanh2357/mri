import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  // Chuẩn lâm sàng mới
  inpatientTrigger,
  postEnrich,
  edHandoff,
  edAccept,
  acknowledgeByRole,
  cancelStandDown,
  createVerbalOrder,
  requestMriOverride,
  requestIcuBed,
  closeEmergencyEvent,
  getActiveEvents,
  // Tương thích ngược
  triggerEmergency,
  acknowledgeAlert,
  resolveAlert,
  getActiveAlerts,
  getAlertHistory
} from "../controllers/emergency.controller.js";

const router = Router();
router.use(protect);

// ── 1. Báo động 1-Chạm Nội Trú & Bổ sung thông số lâm sàng ───────────────────
router.post("/inpatient-trigger", inpatientTrigger);
router.patch("/post-enrich/:id", postEnrich);

// ── 2. Tiếp nhận Bàn giao từ Khoa Cấp Cứu (Chuẩn ISBAR) ──────────────────────
router.post("/ed-handoff", edHandoff);
router.put("/ed-accept/:id", edAccept);

// ── 3. Acknowledge theo Vai trò & Hủy báo động nhầm (Stand-down) ──────────────
router.put("/ack/:id", acknowledgeByRole);
router.post("/cancel-stand-down/:id", cancelStandDown);

// ── 4. Y lệnh miệng, Đề xuất MRI & Giữ giường Neuro-ICU ──────────────────────
router.post("/verbal-order", createVerbalOrder);
router.post("/request-mri-override", requestMriOverride);
router.post("/request-icu-bed", requestIcuBed);

// ── 5. Đóng sự kiện cấp cứu & Timeline Audit ──────────────────────────────────
router.post("/close-event/:id", closeEmergencyEvent);

// ── 6. Danh sách sự kiện Active & Lịch sử ─────────────────────────────────────
router.get("/active-events", getActiveEvents);
router.get("/alerts", getActiveAlerts);
router.get("/alerts/history", getAlertHistory);

// ── 7. Tương thích ngược với Frontend hiện có ─────────────────────────────────
router.post("/trigger", triggerEmergency);
router.put("/alerts/:alertId/acknowledge", acknowledgeAlert);
router.put("/alerts/:alertId/resolve", resolveAlert);

export default router;
