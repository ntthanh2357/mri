import express from "express";
import { protect, checkRole } from "../middlewares/auth.middleware.js";
import {
  createVisit,
  getMyQueue,
  updateVitals,
  callPatientForVitals,
  savePreScreening,
  getPatientPreScreening,
  checkVitalsSafety,
  createMriOrder,
  updateStatus,
  getStaff,
  submitMriSafetyCheck,
  requestMriRescan,
  cancelMriOrder,
  getVisitById,
  saveServiceOrder,
} from "../controllers/visit.controller.js";

const router = express.Router();

router.get("/staff", protect, getStaff);
router.post("/", protect, checkRole(["nurse", "receptionist", "admin", "hospital_admin"]), createVisit);
router.get("/my-queue", protect, checkRole(["doctor", "nurse", "technician", "receptionist", "admin", "hospital_admin", "system_admin"]), getMyQueue); // chỉ nhân viên: hàng đợi chứa lượt khám của cả bệnh viện
router.post("/check-vitals", protect, checkVitalsSafety);
// UC-NUR-01: gọi bệnh nhân vào phòng đo sinh hiệu — chỉ điều dưỡng
router.put("/:id/call-vitals", protect, checkRole(["nurse"]), callPatientForVitals);
// UC-NUR-03: sàng lọc dị ứng & chống chỉ định — điều dưỡng ghi, nhân sự lâm sàng đọc trong bệnh án
router.put("/:id/pre-screening", protect, checkRole(["nurse"]), savePreScreening);
router.get("/pre-screening/latest", protect, checkRole(["nurse", "doctor", "technician", "hospital_admin"]), getPatientPreScreening);
router.put("/:id/vitals", protect, checkRole(["nurse", "receptionist", "doctor", "admin", "hospital_admin"]), updateVitals);
router.put("/:id/mri-order", protect, checkRole(["doctor"]), createMriOrder);
router.put("/:id/status", protect, checkRole(["doctor", "nurse", "receptionist", "technician", "admin", "hospital_admin"]), updateStatus);

// [THỰC TẾ BV: NGHỊCH LÝ 3 & 4] Bảng kiểm an toàn MRI, Chụp lại & Hủy ca
router.post("/:id/mri-safety-check", protect, checkRole(["technician", "nurse", "doctor", "admin", "hospital_admin"]), submitMriSafetyCheck);
router.post("/:id/mri-rescan", protect, checkRole(["technician", "doctor", "admin", "hospital_admin"]), requestMriRescan);
router.post("/:id/mri-cancel", protect, checkRole(["technician", "doctor", "admin", "hospital_admin"]), cancelMriOrder);

// Phiếu chỉ định dịch vụ & xem 1 lượt khám (đặt sau các route cố định như /staff, /my-queue)
router.put("/:id/service-order", protect, checkRole(["nurse", "doctor", "admin", "hospital_admin"]), saveServiceOrder);
router.get("/:id", protect, checkRole(["nurse", "doctor", "receptionist", "technician", "admin", "hospital_admin"]), getVisitById);

export default router;

