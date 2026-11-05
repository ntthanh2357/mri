import { Router } from "express";
import { protect, checkRole } from "../middlewares/auth.middleware.js";
import {
  // Chuẩn lâm sàng mới
  inpatientTrigger,
  postEnrich,
  edHandoff,
  edAccept,
  acknowledgeByRole,
  cancelStandDown,
  createVerbalOrder,
  confirmVerbalOrderReadBack,
  confirmVerbalOrderOtp,
  countersignVerbalOrder,
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

const CLINICAL_EMERGENCY_ROLES = [
  "doctor",
  "department_head",
  "nurse",
  "technician",
  "radiologist",
  "hospital_admin",
  "admin",
  "system_admin",
];
const DOCTOR_LEAD_ROLES = [
  "doctor",
  "department_head",
  "hospital_admin",
  "admin",
  "system_admin",
];
const NURSE_AND_DOCTOR_ROLES = [
  "nurse",
  "doctor",
  "department_head",
  "hospital_admin",
  "admin",
  "system_admin",
];

// ── 1. Báo động 1-Chạm Nội Trú & Bổ sung thông số lâm sàng ───────────────────
router.post("/inpatient-trigger", checkRole(CLINICAL_EMERGENCY_ROLES), inpatientTrigger);
router.patch("/post-enrich/:id", checkRole(CLINICAL_EMERGENCY_ROLES), postEnrich);

// ── 2. Tiếp nhận Bàn giao từ Khoa Cấp Cứu (Chuẩn ISBAR) ──────────────────────
router.post("/ed-handoff", checkRole(CLINICAL_EMERGENCY_ROLES), edHandoff);
router.put("/ed-accept/:id", checkRole(DOCTOR_LEAD_ROLES), edAccept);

// ── 3. Acknowledge theo Vai trò & Hủy báo động nhầm (Stand-down) ──────────────
router.put("/ack/:id", checkRole(CLINICAL_EMERGENCY_ROLES), acknowledgeByRole);
router.post("/cancel-stand-down/:id", checkRole(DOCTOR_LEAD_ROLES), cancelStandDown);

// ── 4. Y lệnh miệng, Read-Back 2 bước, Ký số bổ sung, Đề xuất MRI & Giữ giường Neuro-ICU ──
router.post("/verbal-order", checkRole(DOCTOR_LEAD_ROLES), createVerbalOrder);
router.post("/verbal-order/:orderId/readback-confirm", checkRole(NURSE_AND_DOCTOR_ROLES), confirmVerbalOrderReadBack);
router.post("/verbal-order/:orderId/readback-otp", checkRole(CLINICAL_EMERGENCY_ROLES), confirmVerbalOrderOtp);
router.post("/verbal-order/:orderId/countersign", checkRole(["doctor", "department_head"]), countersignVerbalOrder);
router.post("/request-mri-override", checkRole(DOCTOR_LEAD_ROLES), requestMriOverride);
router.post("/request-icu-bed", checkRole(DOCTOR_LEAD_ROLES), requestIcuBed);

// ── 5. Đóng sự kiện cấp cứu & Timeline Audit ──────────────────────────────────
router.post("/close-event/:id", checkRole(DOCTOR_LEAD_ROLES), closeEmergencyEvent);

// ── 6. Danh sách sự kiện Active & Lịch sử ─────────────────────────────────────
router.get("/active-events", checkRole(CLINICAL_EMERGENCY_ROLES), getActiveEvents);
router.get("/alerts", checkRole(CLINICAL_EMERGENCY_ROLES), getActiveAlerts);
router.get("/alerts/history", checkRole(CLINICAL_EMERGENCY_ROLES), getAlertHistory);
router.get("/history", checkRole(CLINICAL_EMERGENCY_ROLES), getAlertHistory);

// ── 7. Tương thích ngược với Frontend hiện có ─────────────────────────────────
router.post("/trigger", checkRole(CLINICAL_EMERGENCY_ROLES), triggerEmergency);
router.put("/alerts/:alertId/acknowledge", checkRole(CLINICAL_EMERGENCY_ROLES), acknowledgeAlert);
router.put("/alerts/:alertId/resolve", checkRole(DOCTOR_LEAD_ROLES), resolveAlert);

export default router;
