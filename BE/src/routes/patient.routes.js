import { Router } from "express";
import {
  getPatients,
  getPatientVitals,
  addPatientVitals,
  getPatientLabOrders,
  createPatientLabOrder
} from "../controllers/patient.controller.js";
import { protect, checkRole } from "../middlewares/auth.middleware.js";

const router = Router();

// Hỗ trợ kiểm tra quyền xem chính bản thân mình hoặc quyền hạn lâm sàng
const checkSelfOrRoles = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Không có quyền truy cập, thiếu token." });
    }
    if (req.user.role === "patient") {
      if (req.user.id !== req.params.patientId) {
        return res.status(403).json({ message: "Bạn không có quyền truy cập hồ sơ của bệnh nhân khác." });
      }
      return next();
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Quyền truy cập bị từ chối." });
    }
    next();
  };
};

router.use(protect);

// Lấy danh sách bệnh nhân (Chỉ cho nhân viên lâm sàng)
router.get("/", checkRole(["doctor", "nurse", "admin"]), getPatients);

// Quản lý sinh hiệu bệnh nhân (Bác sĩ, Điều dưỡng, Admin hoặc tự bệnh nhân xem/thêm)
router.get("/:patientId/vitals", checkSelfOrRoles(["doctor", "nurse", "admin"]), getPatientVitals);
router.post("/:patientId/vitals", checkSelfOrRoles(["doctor", "nurse", "admin"]), addPatientVitals);

// Quản lý chỉ định xét nghiệm của bệnh nhân (Bác sĩ, Điều dưỡng, Kỹ thuật viên, Admin hoặc tự bệnh nhân xem)
router.get("/:patientId/lab-orders", checkSelfOrRoles(["doctor", "nurse", "technician", "admin"]), getPatientLabOrders);

// Tạo chỉ định xét nghiệm (Chỉ cho Bác sĩ, Tiếp tân, Admin tạo)
router.post("/:patientId/lab-orders", checkRole(["doctor", "nurse", "admin"]), createPatientLabOrder);

export default router;
