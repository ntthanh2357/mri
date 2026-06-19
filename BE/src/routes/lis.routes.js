import { Router } from "express";
import { Biomarker } from "../models/biomarker.model.js";
import { receiveLisResults } from "../controllers/lis.controller.js";
import { successResponse, errorResponse } from "../utils/response.util.js";
import { protect, checkRole } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(protect);

// Endpoint: POST /api/lis/receiver — Tiếp nhận kết quả từ máy LIS (Chỉ cho Doctor, Kỹ thuật viên, Admin)
router.post("/receiver", checkRole(["doctor", "technician", "admin"]), receiveLisResults);

// Endpoint: GET /api/lis/biomarkers — Lấy danh mục chỉ số xét nghiệm (mọi user đã đăng nhập đều xem được)
router.get("/biomarkers", async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};
    const biomarkers = await Biomarker.find(filter)
      .select("code name category unit reference_range")
      .sort({ category: 1, name: 1 })
      .lean();
    return successResponse(res, biomarkers, "Lấy danh mục chỉ số xét nghiệm thành công.");
  } catch (error) {
    console.error("Lỗi lấy danh mục biomarkers:", error);
    return errorResponse(res, "Lỗi lấy danh mục chỉ số xét nghiệm.", 500);
  }
});

export default router;
