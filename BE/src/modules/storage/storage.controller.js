import storageService from "../../services/storage/storageService.js";
import StoredMedicalFile from "../../models/storedMedicalFile.model.js";

/**
 * @desc Stream tệp tin y tế về client có xác thực và phân quyền
 * @route GET /api/v1/storage/files/:fileId
 * @access Private
 */
export const streamStoredFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { stream, file } = await storageService.get(fileId);

    // Kiểm tra quyền truy cập (Chống IDOR giữa các bệnh nhân)
    if (req.user && req.user.role === "patient") {
      if (file.patientId && file.patientId.toString() !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền truy cập tệp tin y tế này.",
        });
      }
    }

    // Thiết lập Header HTTP Stream
    res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
    res.setHeader("Content-Length", file.sizeBytes);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.fileName)}"`);
    res.setHeader("ETag", file.sha256);
    res.setHeader("Cache-Control", "private, max-age=86400"); // Cache 1 ngày trên browser bệnh nhân

    stream.pipe(res);
  } catch (error) {
    console.error("Lỗi stream file:", error);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Không thể tải tệp tin.",
    });
  }
};

/**
 * @desc Lấy metadata của tệp tin y tế (đối soát SHA-256, syncStatus)
 * @route GET /api/v1/storage/files/:fileId/metadata
 * @access Private
 */
export const getStoredFileMetadata = async (req, res) => {
  try {
    const { fileId } = req.params;
    const file = await StoredMedicalFile.findOne({ fileId }).lean();
    if (!file) {
      return res.status(404).json({ success: false, message: "Không tìm thấy metadata tệp tin." });
    }

    // Kiểm tra quyền
    if (req.user && req.user.role === "patient") {
      if (file.patientId && file.patientId.toString() !== req.user.id.toString()) {
        return res.status(403).json({ success: false, message: "Bạn không có quyền xem thông tin tệp này." });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        fileId: file.fileId,
        category: file.category,
        studyId: file.studyId,
        sequenceName: file.sequenceName,
        fileName: file.fileName,
        sizeBytes: file.sizeBytes,
        mimeType: file.mimeType,
        sha256: file.sha256,
        syncStatus: file.syncStatus,
        isEncrypted: file.isEncrypted,
        createdAt: file.createdAt,
        streamUrl: `/api/v1/storage/files/${file.fileId}`,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy metadata:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
