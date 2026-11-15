import { Router } from "express";
import crypto from "crypto";
import { Biomarker } from "./models/biomarker.model.js";
import { receiveLisResults, verifyLisResults, collectLabSpecimen } from "./lis.controller.js";
import { successResponse, errorResponse } from "../../utils/response.util.js";
import { protect, checkRole } from "../../middlewares/auth.middleware.js";

const router = Router();

const safeEqual = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

/**
 * [P2-7] Máy LIS xác thực bằng API key thay vì JWT của nhân viên.
 * Chỉ bật khi cấu hình đủ LIS_API_KEY + LIS_HOSPITAL_ID (một khoá gắn một bệnh viện;
 * triển khai đa bệnh viện nên dùng API gateway/mTLS để tách khoá theo tenant).
 * Mọi request không có khoá hợp lệ rơi về luồng JWT nhân viên như cũ.
 */
const lisOrStaffAuth = (req, res, next) => {
  const configuredKey = process.env.LIS_API_KEY;
  const machineHospitalId = process.env.LIS_HOSPITAL_ID;
  const providedKey = req.headers["x-lis-api-key"];

  if (configuredKey && machineHospitalId && providedKey && safeEqual(providedKey, configuredKey)) {
    req.user = { id: "lis-machine", role: "system", hospitalId: machineHospitalId };
    return next();
  }
  return protect(req, res, next);
};

router.use(lisOrStaffAuth);

// Endpoint: POST /api/lis/receiver — Tiếp nhận kết quả từ máy LIS
router.post("/receiver", checkRole(["doctor", "department_head", "technician", "lab_technician", "admin", "system_admin", "system"]), receiveLisResults);

// Vòng đời mẫu: ghi nhận lấy mẫu
router.post("/orders/:id/collect", checkRole(["nurse", "technician", "lab_technician", "doctor", "department_head", "admin", "hospital_admin"]), collectLabSpecimen);

// Duyệt kết quả: RESULTED → VERIFIED (bác sĩ xét nghiệm/người được phân công)
router.post("/orders/:id/verify", checkRole(["doctor", "department_head", "technician", "lab_technician", "admin", "hospital_admin"]), verifyLisResults);

// Endpoint: GET /api/lis/biomarkers — Lấy danh mục chỉ số xét nghiệm (mọi user đã đăng nhập đều xem được)
router.get("/biomarkers", async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};
    const biomarkers = await Biomarker.find(filter)
      .select("code name category unit reference_range critical_low critical_high")
      .sort({ category: 1, name: 1 })
      .lean();
    return successResponse(res, biomarkers, "Lấy danh mục chỉ số xét nghiệm thành công.");
  } catch (error) {
    console.error("Lỗi lấy danh mục biomarkers:", error);
    return errorResponse(res, "Lỗi lấy danh mục chỉ số xét nghiệm.", 500);
  }
});

export default router;
