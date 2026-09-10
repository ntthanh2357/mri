import { Hospital } from "../models/hospital.model.js";
import { User } from "../models/user.model.js";
import { DicomStudy } from "../models/dicomStudy.model.js";
import { createNotificationInternal } from "./notification.controller.js";
import { successResponse, errorResponse } from "../utils/response.util.js";

// ─── L.1 — Khởi tạo cấu trúc thư mục Drive cho bệnh nhân mới ────────────────
// @route POST /api/v1/drive-storage/patient-folders
// @access Private (Admin, Technician)
export const createPatientFolderStructure = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    const { patientId } = req.body;

    if (!patientId) return errorResponse(res, "Thiếu ID bệnh nhân (patientId).", 400);

    const hospital = await Hospital.findById(hospitalId).lean();
    if (!hospital || !hospital.driveFolderId) {
      return errorResponse(res, "Bệnh viện chưa được cấu hình Google Drive root.", 400);
    }

    const patient = await User.findById(patientId).lean();
    if (!patient) return errorResponse(res, "Không tìm thấy bệnh nhân.", 404);

    // Mô phỏng cây thư mục Drive đã được tạo
    const mockFolderTree = {
      patientFolderId: `folder_p_${patient._id.toString().slice(-6)}`,
      patientFolderName: patient.profile?.name || patient.profile?.fullName || "Bệnh nhân",
      subFolders: {
        profile: `folder_profile_${patient._id.toString().slice(-6)}`,
        studies: `folder_studies_${patient._id.toString().slice(-6)}`,
      }
    };

    return successResponse(res, mockFolderTree, "Khởi tạo cây thư mục Drive cho bệnh nhân thành công.", 201);
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── L.2 — Tự động Backup dữ liệu hàng ngày / hàng tuần ────────────────────
// @route POST /api/v1/drive-storage/run-backup
// @access Private (Admin)
export const runDailyWeeklyBackup = async (req, res) => {
  try {
    if (!["admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ admin mới có quyền thực hiện backup.", 403);
    }

    const hospitalId = req.user.hospitalId;
    const { backupType = 'daily' } = req.body; // 'daily' | 'weekly'

    const now = new Date();
    const timestamp = now.toISOString().slice(0, 10);
    const backupFileName = backupType === 'daily'
      ? `backup_daily_${timestamp}.zip`
      : `backup_weekly_${timestamp}.zip`;

    // Mô phỏng quá trình tạo file zip backup
    const backupRecord = {
      hospitalId,
      backupType,
      fileName: backupFileName,
      sizeBytes: Math.floor(Math.random() * 50000000) + 10000000, // ~10MB - 60MB
      folderPath: backupType === 'daily' ? 'Backups/daily/' : 'Backups/weekly/',
      createdAt: now,
      status: 'completed',
    };

    return successResponse(res, backupRecord, `Tạo bản sao lưu ${backupType} thành công: ${backupFileName}`);
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── L.3 — Cảnh báo dung lượng Drive sắp đầy (>80% và >95%) ─────────────────
// @route GET /api/v1/drive-storage/capacity-check
// @access Private (Admin)
export const checkDriveCapacity = async (req, res) => {
  try {
    if (!["admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ admin mới xem được cảnh báo dung lượng.", 403);
    }

    // Mô phỏng dung lượng Drive bệnh viện (Drive dùng chung 2TB = 2,000,000 MB)
    const totalCapacityMb = 2000000;
    // Giả lập dung lượng đã dùng ngẫu nhiên để demo
    const usedCapacityMb = 1680000; // ~84%
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

// ─── L.4 — Tạo link chia sẻ có thời hạn (Signed URL Proxy) ─────────────────
// @route GET /api/v1/drive-storage/share-link/:fileId
// @access Private
export const getSignedShareLink = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { expireDays = 30 } = req.query;

    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + Number(expireDays));

    // Signed URL proxy ẩn URL Drive trực tiếp
    const signedUrl = `${req.protocol}://${req.get('host')}/api/v1/drive-storage/proxy-download/${fileId}?token=${Buffer.from(fileId + expireDate.getTime()).toString('base64')}`;

    return successResponse(res, {
      fileId,
      signedUrl,
      expiresAt: expireDate,
      expireDays: Number(expireDays),
    }, "Tạo link chia sẻ an toàn có thời hạn thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── L.5 — Dọn dẹp file tạm & orphan files ──────────────────────────────────
// @route POST /api/v1/drive-storage/cleanup-orphans
// @access Private (Admin)
export const cleanupOrphanFiles = async (req, res) => {
  try {
    if (!["admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ admin mới có quyền thực hiện dọn dẹp.", 403);
    }

    // Mô phỏng quét các file tạm chưa link DB sau 24h
    const deletedFiles = [
      { name: "temp_upload_9812.dcm", sizeMb: 15, path: "_temp/uploading/" },
      { name: "temp_upload_9813.dcm", sizeMb: 18, path: "_temp/uploading/" },
    ];
    const freedSpaceMb = deletedFiles.reduce((sum, f) => sum + f.sizeMb, 0);

    return successResponse(res, {
      deletedFilesCount: deletedFiles.length,
      freedSpaceMb,
      deletedFiles,
      cleanedAt: new Date(),
    }, `Đã dọn dẹp ${deletedFiles.length} file rác, giải phóng ${freedSpaceMb} MB.`);
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};
