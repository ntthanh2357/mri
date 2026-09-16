import { Router } from "express";
import { protect, checkRole } from "../middlewares/auth.middleware.js";
import {
  checkSurgeryCapacity,
  createTransferRequest,
  acceptTransferRequest,
  rejectTransferRequest,
  getTransfers,
  grantCrossHospitalView,
  revokeCrossHospitalView,
  accessCrossHospitalView
} from "../controllers/transfer.controller.js";

const router = Router();

// Endpoint đọc dữ liệu bệnh án liên viện bằng Access Token 7 ngày (F.5 & HIPAA Token-Based Capability)
router.get("/cross-view/:token", accessCrossHospitalView);

// Toàn bộ các API nghiệp vụ nội bộ yêu cầu xác thực người dùng JWT
router.use(protect);

router.get("/", checkRole(["doctor", "nurse", "admin", "hospital_admin"]), getTransfers);
router.post("/", checkRole(["doctor", "admin", "hospital_admin"]), createTransferRequest);
router.post("/check-capacity", checkRole(["doctor", "nurse", "admin", "hospital_admin"]), checkSurgeryCapacity);
router.put("/:id/accept", checkRole(["doctor", "admin", "hospital_admin"]), acceptTransferRequest);
router.put("/:id/reject", checkRole(["doctor", "admin", "hospital_admin"]), rejectTransferRequest);
router.post("/:id/grant-cross-view", checkRole(["doctor", "admin", "hospital_admin"]), grantCrossHospitalView);
router.post("/:id/revoke-cross-view", checkRole(["doctor", "admin", "hospital_admin"]), revokeCrossHospitalView);

export default router;

