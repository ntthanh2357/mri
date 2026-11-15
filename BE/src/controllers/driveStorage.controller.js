import mongoose from "mongoose";
import { StoredMedicalFile } from "../models/storedMedicalFile.model.js";
import { DicomStudy } from "../models/dicomStudy.model.js";
import { createNotificationInternal } from "./notification.controller.js";
import { successResponse, errorResponse } from "../utils/response.util.js";

// Các thao tác Drive dưới đây CHƯA được tích hợp Google Drive thật. Trước đây chúng trả kết quả mô phỏng
// (cây thư mục giả, bản sao lưu với dung lượng ngẫu nhiên, danh sách tệp "đã xóa" bịa ra) kèm thông báo thành công:
// người vận hành tưởng đã có bản sao lưu trong khi không có gì được ghi. Nay trả 501 rõ ràng.
// Sao lưu thật (mã hóa AES-256-GCM): POST /admin/hospitals/:id/backup (quản trị nền tảng) và cron sao lưu tự động.
const driveNotIntegrated = (res, action) => res.status(501).json({
  success: false,
  code: "DRIVE_NOT_INTEGRATED",
  message: `Chưa hỗ trợ ${action}: hệ thống chưa kết nối Google Drive. Không có thao tác nào được thực hiện.`,
});

// ─── L.1 — Khởi tạo cấu trúc thư mục Drive cho bệnh nhân mới ────────────────
// @route POST /api/v1/drive-storage/patient-folders
export const createPatientFolderStructure = async (req, res) => driveNotIntegrated(res, "tạo thư mục Drive cho bệnh nhân");

// ─── L.2 — Backup dữ liệu hàng ngày / hàng tuần lên Drive ──────────────────
// @route POST /api/v1/drive-storage/run-backup
export const runDailyWeeklyBackup = async (req, res) => driveNotIntegrated(res, "sao lưu lên Google Drive");

// ─── L.3 — Cảnh báo dung lượng Drive sắp đầy (>80% và >95%) ─────────────────
// @route GET /api/v1/drive-storage/capacity-check
// @access Private (Admin)
export const checkDriveCapacity = async (req, res) => {
  try {
    if (!["admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ admin mới xem được cảnh báo dung lượng.", 403);
    }

    // Dung lượng đã dùng tính từ các tệp đã đồng bộ lên Drive. Tổng dung lượng do viện cấu hình (mặc định 2 TB).
    const totalCapacityMb = Number(process.env.DRIVE_TOTAL_CAPACITY_MB) || 2000000;
    // Viện chỉ thấy dung lượng tệp của viện mình (aggregate không qua bộ lọc tenancy nên phải lọc tường minh).
    // Quản trị nền tảng (không gán viện) xem tổng toàn hệ thống.
    const match = { driveFileId: { $nin: [null, ""] } };
    if (req.user.role === "hospital_admin") {
      if (!req.user.hospitalId) return errorResponse(res, "Tài khoản chưa được gán vào bệnh viện nào.", 403);
      match.hospitalId = new mongoose.Types.ObjectId(String(req.user.hospitalId));
    }
    const [usage] = await StoredMedicalFile.aggregate([
      { $match: match },
      { $group: { _id: null, bytes: { $sum: "$sizeBytes" } } },
    ]);
    const usedCapacityMb = Math.round((usage?.bytes || 0) / (1024 * 1024));
    const usagePercentage = Math.round((usedCapacityMb / totalCapacityMb) * 100);

    let alertLevel = 'normal';
    let alertMessage = 'Dung lượng Google Drive ổn định.';

    if (usagePercentage >= 95) {
      alertLevel = 'critical';
      alertMessage = `🚨 CẢNH BÁO NGUY CẤP: Dung lượng Drive đã dùng ${usagePercentage}% (${Math.round(usedCapacityMb / 1024)}GB / ${Math.round(totalCapacityMb / 1024)}GB). Cần xóa file backup cũ hoặc nâng cấp Drive ngay!`;
    } else if (usagePercentage >= 80) {
      alertLevel = 'warning';
      alertMessage = `⚠️ CẢNH BÁO DUNG LƯỢNG: Dung lượng Drive đã dùng ${usagePercentage}% (${Math.round(usedCapacityMb / 1024)}GB / ${Math.round(totalCapacityMb / 1024)}GB). Cần lên kế hoạch dọn dẹp file tạm.`;
    }

    return successResponse(res, {
      totalCapacityMb,
      usedCapacityMb,
      usagePercentage,
      alertLevel,
      alertMessage,
      checkedAt: new Date(),
    }, "Kiểm tra dung lượng Google Drive thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── L.5 — Dọn dẹp file tạm & orphan files ──────────────────────────────────
// @route POST /api/v1/drive-storage/cleanup-orphans
export const cleanupOrphanFiles = async (req, res) => driveNotIntegrated(res, "dọn tệp mồ côi trên Google Drive");
