import { Router } from "express";
import { protect, checkRole } from "../middlewares/auth.middleware.js";
import { uploadSingle } from "../middlewares/upload.middleware.js";
import { getMyHospital, submitOnboardingInfo, uploadLicenseFile, getHospitalStaff, toggleStaffLock } from "../controllers/hospital.controller.js";

const router = Router();

router.use(protect);

// Chỉ hospital_admin và admin mới được xem thông tin bệnh viện
router.get("/me", checkRole(["admin", "hospital_admin"]), getMyHospital);

// Bất kỳ ai trong bệnh viện cũng được xem danh sách nhân viên (để đổi ca, assign, v.v.)
router.get("/staff", getHospitalStaff);
router.put("/staff/:id/toggle-lock", checkRole(["admin", "hospital_admin"]), toggleStaffLock);

// Onboarding — chỉ hospital_admin (dùng protect vì giai đoạn onboarding, chưa có hospitalId đầy đủ)
router.put("/onboarding", checkRole(["hospital_admin"]), submitOnboardingInfo);
router.post("/onboarding/license", checkRole(["hospital_admin"]), uploadSingle, uploadLicenseFile);

export default router;

