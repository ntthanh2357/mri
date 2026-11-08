import express from "express";
import { protect, checkRole } from "../middlewares/auth.middleware.js";
import { uploadSingle } from "../middlewares/upload.middleware.js";
import {
  createVisit,
  getMyQueue,
  updateVitals,
  callPatientForVitals,
  savePreScreening,
  getPatientPreScreening,
  checkVitalsSafety,
  startExam,
  createMriOrder,
  updateStatus,
  getStaff,
  submitMriSafetyCheck,
  uploadMriConditionalDoc,
  requestMriRescan,
  cancelMriOrder,
  approveVisitDebt,
  getDebtApprovalCandidates,
  getVisitById,
  saveServiceOrder,
} from "../controllers/visit.controller.js";

const router = express.Router();

const ALL_STAFF_ROLES = [
  "doctor",
  "radiologist",
  "department_head",
  "nurse",
  "technician",
  "lab_technician",
  "pharmacist",
  "receptionist",
  "admin",
  "hospital_admin",
  "system_admin",
];

router.get("/staff", protect, checkRole(ALL_STAFF_ROLES), getStaff);
router.get("/debt-candidates", protect, checkRole(["hospital_admin"]), getDebtApprovalCandidates);
router.post("/", protect, checkRole(["nurse", "receptionist", "admin", "system_admin", "hospital_admin"]), createVisit);
router.get("/my-queue", protect, checkRole(ALL_STAFF_ROLES), getMyQueue); // chỉ nhân viên: hàng đợi chứa lượt khám của cả bệnh viện
router.post("/check-vitals", protect, checkRole(ALL_STAFF_ROLES), checkVitalsSafety);
// UC-NUR-01: gọi bệnh nhân vào phòng đo sinh hiệu — chỉ điều dưỡng
router.put("/:id/call-vitals", protect, checkRole(["nurse"]), callPatientForVitals);
// UC-NUR-03: sàng lọc dị ứng & chống chỉ định — điều dưỡng ghi, nhân sự lâm sàng đọc trong bệnh án
router.put("/:id/pre-screening", protect, checkRole(["nurse"]), savePreScreening);
router.get("/pre-screening/latest", protect, checkRole(["nurse", "doctor", "radiologist", "department_head", "technician", "lab_technician", "pharmacist", "hospital_admin", "admin", "system_admin"]), getPatientPreScreening);
router.put("/:id/vitals", protect, checkRole(["nurse", "receptionist", "doctor", "department_head", "admin", "system_admin", "hospital_admin"]), updateVitals);
router.put("/:id/start-exam", protect, checkRole(["doctor", "department_head", "admin", "system_admin", "hospital_admin"]), startExam);
router.put("/:id/mri-order", protect, checkRole(["doctor", "department_head"]), createMriOrder);
router.put("/:id/status", protect, checkRole(["doctor", "radiologist", "department_head", "nurse", "receptionist", "technician", "lab_technician", "pharmacist", "admin", "system_admin", "hospital_admin"]), updateStatus);

// [THỰC TẾ BV: NGHỊCH LÝ 3 & 4] Bảng kiểm an toàn MRI, Chụp lại & Hủy ca
router.post("/:id/mri-safety-check", protect, checkRole(["technician", "doctor", "radiologist", "department_head"]), submitMriSafetyCheck);
// Lỗi định dạng/dung lượng của multer trả 400 thay vì 500
const acceptMrConditionalDoc = (req, res, next) => uploadSingle(req, res, (err) => (err ? res.status(400).json({ success: false, message: err.message }) : next()));
router.post("/:id/mri-conditional-doc", protect, checkRole(["radiologist"]), acceptMrConditionalDoc, uploadMriConditionalDoc);
router.post("/:id/debt-approval", protect, checkRole(["hospital_admin"]), approveVisitDebt);
router.post("/:id/mri-rescan", protect, checkRole(["technician", "doctor", "radiologist", "department_head", "admin", "system_admin", "hospital_admin"]), requestMriRescan);
router.post("/:id/mri-cancel", protect, checkRole(["technician", "doctor", "radiologist", "department_head", "admin", "system_admin", "hospital_admin"]), cancelMriOrder);

// Phiếu chỉ định dịch vụ & xem 1 lượt khám (đặt sau các route cố định như /staff, /my-queue)
router.put("/:id/service-order", protect, checkRole(["nurse", "doctor", "department_head", "admin", "system_admin", "hospital_admin"]), saveServiceOrder);
router.get("/:id", protect, checkRole(ALL_STAFF_ROLES), getVisitById);

export default router;
