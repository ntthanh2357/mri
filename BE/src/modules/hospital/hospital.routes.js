import { Router } from "express";
import { protect, checkRole } from "../../middlewares/auth.middleware.js";
import { uploadSingle } from "../../middlewares/upload.middleware.js";
import { getMyHospital, submitOnboardingInfo, uploadLicenseFile, getHospitalStaff, toggleStaffLock, getPublicDoctors } from "./hospital.controller.js";

const router = Router();

const ALL_STAFF_ROLES = [
  "admin",
  "system_admin",
  "hospital_admin",
  "department_head",
  "doctor",
  "radiologist",
  "nurse",
  "technician",
  "lab_technician",
  "pharmacist",
  "receptionist",
];

// ─── Public routes (không cần đăng nhập) ─────────────────────────────────────
router.get("/public/doctors", getPublicDoctors);

router.use(protect);

// Chỉ hospital_admin, department_head và admin mới được xem thông tin bệnh viện
router.get("/me", checkRole(["admin", "system_admin", "hospital_admin", "department_head"]), getMyHospital);

// Nhân viên trong bệnh viện được xem danh sách nhân sự (để đổi ca, assign, v.v.) — chặn patient
router.get("/staff", checkRole(ALL_STAFF_ROLES), getHospitalStaff);
router.put("/staff/:id/toggle-lock", checkRole(["admin", "system_admin", "hospital_admin"]), toggleStaffLock);

// Onboarding — chỉ hospital_admin (dùng protect vì giai đoạn onboarding, chưa có hospitalId đầy đủ)
router.put("/onboarding", checkRole(["hospital_admin"]), submitOnboardingInfo);
router.post("/onboarding/license", checkRole(["hospital_admin"]), uploadSingle, uploadLicenseFile);

export default router;
