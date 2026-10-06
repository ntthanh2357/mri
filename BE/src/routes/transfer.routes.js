import { Router } from "express";
import { protect, checkRole } from "../middlewares/auth.middleware.js";
import {
  checkSurgeryCapacity,
  createTransferRequest,
  sendTransferEmail,
  getTransfers,
  getTransferById,
  deleteTransfer,
  acceptTransferRequest,
  rejectTransferRequest,
  grantCrossHospitalView,
  revokeCrossHospitalView,
  accessCrossHospitalView
} from "../controllers/transfer.controller.js";

const router = Router();

// Endpoint đọc dữ liệu bệnh án liên viện cũ (tương thích)
router.get("/cross-view/:token", accessCrossHospitalView);

// Toàn bộ các API nghiệp vụ nội bộ yêu cầu xác thực người dùng JWT
router.use(protect);

// Danh sách & chi tiết gói chuyển viện
router.get("/", checkRole(["doctor", "nurse", "admin", "hospital_admin", "receptionist"]), getTransfers);
router.get("/:id", checkRole(["doctor", "nurse", "admin", "hospital_admin", "receptionist"]), getTransferById);

// Bác sĩ tạo gói chuyển viện thông minh (UC-DOC-10) -> lưu draft & báo lễ tân
router.post("/", checkRole(["doctor", "admin", "hospital_admin"]), createTransferRequest);

// Lễ tân (hoặc bác sĩ/admin) xác nhận & gửi email cho bệnh nhân
router.post("/:id/send-email", checkRole(["receptionist", "doctor", "admin", "hospital_admin"]), sendTransferEmail);

// Hủy gói chuyển viện
router.delete("/:id", checkRole(["doctor", "admin", "hospital_admin", "receptionist"]), deleteTransfer);

// Compatibility endpoints
router.post("/check-capacity", checkRole(["doctor", "nurse", "admin", "hospital_admin", "receptionist"]), checkSurgeryCapacity);
router.put("/:id/accept", checkRole(["doctor", "admin", "hospital_admin", "receptionist"]), acceptTransferRequest);
router.put("/:id/reject", checkRole(["doctor", "admin", "hospital_admin", "receptionist"]), rejectTransferRequest);
router.post("/:id/grant-cross-view", checkRole(["doctor", "admin", "hospital_admin", "receptionist"]), grantCrossHospitalView);
router.post("/:id/revoke-cross-view", checkRole(["doctor", "admin", "hospital_admin", "receptionist"]), revokeCrossHospitalView);

export default router;
