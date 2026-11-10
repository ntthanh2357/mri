import { Router } from "express";
import { createKtvImagingResult } from "./imaging.controller.js";
import { protect, checkRole } from "../../middlewares/auth.middleware.js";

const router = Router();

// [SECURITY FIX BUG-IMG-001]: Chỉ KTV/Bác sĩ trong bệnh viện mới được tạo bản ghi kết quả chụp
router.post(
  "/",
  protect,
  checkRole(["technician", "radiologist", "doctor", "department_head", "hospital_admin", "admin", "system_admin"]),
  createKtvImagingResult
);

export default router;
