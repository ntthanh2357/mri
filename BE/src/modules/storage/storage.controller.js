import crypto from "crypto";
import path from "path";
import fs from "fs";
import storageService from "../../services/storage/storageService.js";
import StoredMedicalFile from "../../models/storedMedicalFile.model.js";
import { User } from "../auth/models/user.model.js";
import { canAccessStoredFile } from "../../utils/storageAccess.util.js";
import {
  writeLocalChunk,
  assembleLocalChunks,
  getLocalRoot,
  ensureDirectory,
} from "../../services/storage/localAdapter.js";
import { getPacsQueueStatus } from "../../services/storage/pacsQueue.service.js";

// Lưu trữ phiên tải lên phân mảnh (Chunked Upload Sessions) trong bộ nhớ
const chunkUploadSessions = new Map();

/**
 * Tra hospitalId của bệnh nhân / người tải tệp để áp quy tắc cùng bệnh viện (P1-8).
 * Không xác định được chủ sở hữu → danh sách rỗng → bị từ chối (fail-closed).
 */
const resolveFileOwnerHospitalIds = async (file) => {
  const ownerIds = [file.patientId, file.uploadedBy].filter(Boolean);
  if (ownerIds.length === 0) return [];
  const owners = await User.find({ _id: { $in: ownerIds } }).select("hospitalId").lean();
  return owners.map((o) => o.hospitalId).filter(Boolean);
};

/** Kiểm tra quyền đọc tệp — bệnh nhân chỉ tệp của mình, nhân viên phải cùng bệnh viện. */
const ensureFileAccess = async (file, user) => {
  const ownerHospitalIds = await resolveFileOwnerHospitalIds(file);
  return canAccessStoredFile(file, user, ownerHospitalIds);
};

/**
 * @desc Stream tệp tin y tế về client có xác thực và phân quyền
 * @route GET /api/v1/storage/files/:fileId
 * @access Private
 */
export const streamStoredFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { stream, file } = await storageService.get(fileId);

    // Kiểm tra quyền truy cập (chống IDOR giữa bệnh nhân và giữa các bệnh viện)
    if (!(await ensureFileAccess(file, req.user))) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền truy cập tệp tin y tế này.",
      });
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
    if (!(await ensureFileAccess(file, req.user))) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền xem thông tin tệp này." });
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

/**
 * @desc Khởi tạo phiên tải lên phân mảnh (Native Chunked Upload Init + Instant SHA-256 Dedup)
 * @route POST /api/v1/storage/chunked/init
 * @access Private (Technician, Doctor, Radiologist, Department Head, Admin)
 */
export const initChunkedUpload = async (req, res) => {
  try {
    const {
      fileName,
      totalChunks,
      totalSizeBytes = 0,
      mimeType = "application/octet-stream",
      category = "pacs",
      studyId = null,
      sequenceName = null,
      patientId = null,
      expectedSha256 = null,
    } = req.body;

    if (!fileName || !totalChunks || Number(totalChunks) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Thiếu tên tệp (fileName) hoặc tổng số mảnh (totalChunks).",
      });
    }

    // Nếu client đã tính trước SHA-256, kiểm tra Instant Deduplication ngay lập tức
    // [SECURITY FIX BUG-STORAGE-001]: Chỉ cho phép Instant Dedup trong cùng một bệnh viện (hospitalId)
    // hoặc cùng người tải lên (uploadedBy) để chặn tấn công rò rỉ tệp liên viện qua SHA-256.
    if (expectedSha256) {
      const existing = await storageService.findExistingBySha256(String(expectedSha256).toLowerCase(), {
        hospitalId: req.user?.hospitalId || null,
        uploadedBy: req.user?.id || null,
        strictTenantIsolation: true,
      });
      if (existing) {
        const saved = await storageService.putFromPath({
          category,
          studyId,
          sequenceName,
          fileName,
          sourceFilePath: existing.localPath,
          moveFile: false,
          mimeType,
          patientId,
          uploadedBy: req.user?.id || null,
          hospitalId: req.user?.hospitalId || null,
        });
        return res.status(200).json({
          success: true,
          instantDedup: true,
          message: "Tệp đã tồn tại trong kho lưu trữ PACS (Instant SHA-256 Deduplication). Không cần tải lại các mảnh.",
          data: {
            fileId: saved.fileId,
            sha256: saved.sha256,
            sizeBytes: saved.sizeBytes,
            streamUrl: `/api/v1/storage/files/${saved.fileId}`,
            syncStatus: saved.syncStatus,
          },
        });
      }
    }

    const uploadSessionId = `chk_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
    chunkUploadSessions.set(uploadSessionId, {
      uploadSessionId,
      fileName,
      totalChunks: Number(totalChunks),
      totalSizeBytes: Number(totalSizeBytes) || 0,
      mimeType,
      category,
      studyId,
      sequenceName,
      patientId,
      expectedSha256: expectedSha256 ? String(expectedSha256).toLowerCase() : null,
      uploadedBy: req.user?.id || null,
      receivedChunks: new Set(),
      createdAt: Date.now(),
    });

    return res.status(201).json({
      success: true,
      instantDedup: false,
      message: "Khởi tạo phiên tải lên phân mảnh thành công.",
      data: {
        uploadSessionId,
        totalChunks: Number(totalChunks),
        recommendedChunkSizeBytes: 5 * 1024 * 1024, // 5MB/chunk
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Tải lên 1 mảnh (Chunk) của tệp lớn
 * @route POST /api/v1/storage/chunked/part
 * @access Private
 */
export const uploadChunkPart = async (req, res) => {
  try {
    const { uploadSessionId, chunkIndex, chunkBase64 } = req.body;
    const session = chunkUploadSessions.get(uploadSessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Phiên tải lên phân mảnh không tồn tại hoặc đã hết hạn.",
      });
    }

    const idx = Number(chunkIndex);
    if (isNaN(idx) || idx < 0 || idx >= session.totalChunks) {
      return res.status(400).json({
        success: false,
        message: `Chỉ số mảnh (chunkIndex=${chunkIndex}) không hợp lệ (0 .. ${session.totalChunks - 1}).`,
      });
    }

    let chunkBuffer = null;
    if (req.file && req.file.path) {
      chunkBuffer = await fs.promises.readFile(req.file.path);
      await fs.promises.unlink(req.file.path).catch(() => {});
    } else if (typeof chunkBase64 === "string" && chunkBase64.length > 0) {
      const cleaned = chunkBase64.replace(/^data:[^;]+;base64,/, "");
      chunkBuffer = Buffer.from(cleaned, "base64");
    }

    if (!chunkBuffer || chunkBuffer.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Dữ liệu mảnh ghép (chunkBase64 hoặc file) bị trống.",
      });
    }

    const { sizeBytes } = await writeLocalChunk(uploadSessionId, idx, chunkBuffer);
    session.receivedChunks.add(idx);

    return res.status(200).json({
      success: true,
      data: {
        uploadSessionId,
        chunkIndex: idx,
        sizeBytes,
        receivedCount: session.receivedChunks.size,
        totalChunks: session.totalChunks,
        progressPercent: Math.round((session.receivedChunks.size / session.totalChunks) * 100),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Hoàn tất ghép các mảnh (Assemble Chunks -> Verify SHA-256 Stream -> Enqueue Drive Sync)
 * @route POST /api/v1/storage/chunked/complete
 * @access Private
 */
export const completeChunkedUpload = async (req, res) => {
  try {
    const { uploadSessionId, expectedSha256 } = req.body;
    const session = chunkUploadSessions.get(uploadSessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Phiên tải lên phân mảnh không tồn tại hoặc đã hoàn tất.",
      });
    }

    if (session.receivedChunks.size < session.totalChunks) {
      return res.status(400).json({
        success: false,
        message: `Chưa nhận đủ các mảnh ghép (${session.receivedChunks.size}/${session.totalChunks}).`,
      });
    }

    // 1. Ghép các mảnh vào tệp tạm bằng Stream (Zero-RAM-Spike)
    const tempRelativePath = path.posix.join("chunks_assembled", `${uploadSessionId}_${session.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
    const assembled = await assembleLocalChunks(uploadSessionId, session.totalChunks, tempRelativePath);

    // 2. Lưu vào Hybrid PACS qua putFromPath (tự tính SHA-256 bằng Stream, chống trùng và đẩy vào DriveSyncQueue)
    const savedFile = await storageService.putFromPath({
      category: session.category || "pacs",
      studyId: session.studyId,
      sequenceName: session.sequenceName,
      fileName: session.fileName,
      sourceFilePath: assembled.localPath,
      moveFile: true,
      mimeType: session.mimeType,
      patientId: session.patientId,
      uploadedBy: session.uploadedBy || req.user?.id || null,
    });

    const targetSha = (expectedSha256 || session.expectedSha256 || "").toLowerCase().trim();
    if (targetSha && savedFile.sha256 !== targetSha) {
      await storageService.delete(savedFile.fileId);
      chunkUploadSessions.delete(uploadSessionId);
      return res.status(400).json({
        success: false,
        message: `Kiểm định toàn vẹn thất bại: Mã băm SHA-256 sau khi ghép (${savedFile.sha256}) không khớp với mã băm gốc (${targetSha}).`,
      });
    }

    chunkUploadSessions.delete(uploadSessionId);

    return res.status(201).json({
      success: true,
      message: "Ghép tệp phân mảnh và lưu trữ PACS hoàn tất.",
      data: {
        fileId: savedFile.fileId,
        fileName: savedFile.fileName,
        sizeBytes: savedFile.sizeBytes,
        sha256: savedFile.sha256,
        syncStatus: savedFile.syncStatus,
        streamUrl: `/api/v1/storage/files/${savedFile.fileId}`,
        imageUrl: `/api/v1/storage/files/${savedFile.fileId}`,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Xem trạng thái Hàng đợi Đồng bộ Google Drive & Hàng đợi AI (Observability)
 * @route GET /api/v1/storage/queue-status
 * @access Private
 */
export const getStorageAndAiQueueStatus = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: getPacsQueueStatus(),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
