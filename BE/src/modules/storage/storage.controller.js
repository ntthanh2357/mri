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
import { checkPatientTenancy } from "../../utils/tenancy.util.js";

// Lưu trữ phiên tải lên phân mảnh (Chunked Upload Sessions) trong bộ nhớ
const chunkUploadSessions = new Map();

// ── Giới hạn upload phân mảnh (PACS/DICOM) ─────────────────────────────────────────
const CHUNK_MAX_TOTAL_BYTES = 600 * 1024 * 1024; // khớp giới hạn upload DICOM 600MB
const CHUNK_MAX_PART_BYTES = 16 * 1024 * 1024;
const CHUNK_MAX_PARTS = 1200;
const CHUNK_SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const CHUNK_CATEGORIES = new Set(["pacs", "sequence_slice"]);
const CHUNK_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff",
  "application/dicom", "application/octet-stream",
  "application/zip", "application/x-zip-compressed", "application/gzip", "application/x-tar",
  "application/x-7z-compressed", "application/vnd.rar", "application/x-rar-compressed",
]);

// Phiên bỏ dở quá hạn: xóa khỏi bộ nhớ và dọn mảnh tạm trên đĩa
const purgeExpiredChunkSessions = () => {
  const now = Date.now();
  for (const [id, session] of chunkUploadSessions) {
    if (now - session.createdAt > CHUNK_SESSION_TTL_MS) {
      chunkUploadSessions.delete(id);
      const dir = path.join(getLocalRoot(), "chunks_staging", String(id).replace(/[^a-zA-Z0-9_-]/g, ""));
      fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
};
setInterval(purgeExpiredChunkSessions, 30 * 60 * 1000).unref?.();

// Chỉ người khởi tạo phiên mới gửi mảnh/hoàn tất được (không lộ phiên của người khác: trả như không tồn tại)
const getOwnedSession = (uploadSessionId, user) => {
  purgeExpiredChunkSessions();
  const session = chunkUploadSessions.get(uploadSessionId);
  if (!session || !user?.id || String(session.uploadedBy) !== String(user.id)) return null;
  return session;
};

// ── Phản hồi tệp: chỉ hiển thị trực tiếp ảnh/PDF; loại khác buộc tải về. Chặn script trong tệp do người dùng tải lên. ──
const INLINE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/bmp", "image/gif", "image/tiff", "application/pdf"]);
const DOWNLOAD_TYPES = new Set([
  "application/dicom", "application/zip", "application/x-zip-compressed", "application/gzip", "application/x-tar",
  "application/x-7z-compressed", "application/vnd.rar", "application/x-rar-compressed", "application/json",
]);
export const safeFileResponseHeaders = (mimeType, fileName) => {
  const type = String(mimeType || "").toLowerCase().split(";")[0].trim();
  const inline = INLINE_TYPES.has(type);
  const contentType = inline || DOWNLOAD_TYPES.has(type) ? type : "application/octet-stream";
  const headers = {
    "Content-Type": contentType,
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(fileName || "file")}"`,
    "X-Content-Type-Options": "nosniff",
  };
  // PDF giữ trình xem PDF của trình duyệt (sandbox chặn trình xem PDF); mọi loại khác: không chạy script/không nhúng
  headers["Content-Security-Policy"] = type === "application/pdf"
    ? "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; object-src 'self'"
    : "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox";
  return headers;
};

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
    if (!req.signedFileAccess && !(await ensureFileAccess(file, req.user))) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền truy cập tệp tin y tế này.",
      });
    }

    // Thiết lập Header HTTP Stream (Content-Type theo danh sách cho phép, không tin mimeType client tự khai)
    for (const [k, v] of Object.entries(safeFileResponseHeaders(file.mimeType, file.fileName))) res.setHeader(k, v);
    res.setHeader("Content-Length", file.sizeBytes);
    res.setHeader("ETag", file.sha256);
    res.setHeader("Cache-Control", "private, max-age=86400"); // Cache 1 ngày trên browser bệnh nhân

    // Lỗi khi đang gửi (vd. thẻ xác thực GCM không khớp = tệp bị sửa): cắt kết nối, không gửi phần còn lại
    stream.on("error", (err) => {
      console.error("Lỗi đọc/giải mã tệp khi stream:", err.message);
      res.destroy(err);
    });
    stream.pipe(res);
  } catch (error) {
    console.error("Lỗi stream file:", error.message);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      ...(error.code ? { code: error.code } : {}),
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
        // Báo đúng: bản chính trên máy chủ có mã hóa không (dữ liệu cũ từng ghi isEncrypted=true dù là bản rõ)
        isEncrypted: file.localEncrypted === true,
        localEncrypted: file.localEncrypted === true,
        driveCopyEncrypted: Boolean(file.driveFileId && file.encryptionIv && file.encryptionAuthTag),
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

    const parts = Number(totalChunks);
    const declaredBytes = Number(totalSizeBytes) || 0;
    if (!fileName || typeof fileName !== "string" || !Number.isInteger(parts) || parts <= 0) {
      return res.status(400).json({
        success: false,
        message: "Thiếu tên tệp (fileName) hoặc tổng số mảnh (totalChunks).",
      });
    }
    if (parts > CHUNK_MAX_PARTS || declaredBytes < 0 || declaredBytes > CHUNK_MAX_TOTAL_BYTES) {
      return res.status(400).json({ success: false, message: "Tệp vượt quá giới hạn tải lên (tối đa 600MB)." });
    }
    // Kho PACS chỉ nhận ảnh/DICOM/tệp nén; loại do client tự khai được giới hạn (không lưu text/html để phát lại)
    const safeMime = String(mimeType || "").toLowerCase().split(";")[0].trim();
    if (!CHUNK_CATEGORIES.has(category) || !CHUNK_MIME_TYPES.has(safeMime)) {
      return res.status(400).json({ success: false, message: "Loại tệp hoặc nhóm lưu trữ không được hỗ trợ cho tải lên phân mảnh." });
    }
    // Tệp gắn cho bệnh nhân nào thì bệnh nhân đó phải thuộc phạm vi truy cập của người tải lên
    let resolvedPatientId = null;
    if (patientId) {
      const patient = await checkPatientTenancy(patientId, req.user);
      if (!patient) return res.status(404).json({ success: false, message: "Không tìm thấy bệnh nhân hoặc không có quyền gắn tệp cho bệnh nhân này." });
      resolvedPatientId = patient._id;
    }

    // Nếu client đã tính trước SHA-256, kiểm tra Instant Deduplication ngay lập tức
    // [SECURITY FIX BUG-STORAGE-001]: Chỉ cho phép Instant Dedup trong cùng một bệnh viện (hospitalId)
    // hoặc cùng người tải lên (uploadedBy) để chặn tấn công rò rỉ tệp liên viện qua SHA-256.
    if (expectedSha256) {
      const existing = await storageService.findExistingBySha256(String(expectedSha256).toLowerCase(), {
        hospitalId: req.user?.hospitalId || null,
        uploadedBy: req.user?.id || null,
        localEncryptedOnly: true,
      });
      if (existing) {
        // Tạo bản ghi trỏ vào bản chính đã mã hóa sẵn có (không đọc lại/mã hóa lại tệp)
        const saved = await storageService.createDedupReference(existing, {
          category,
          studyId,
          sequenceName,
          fileName,
          mimeType: safeMime,
          patientId: resolvedPatientId,
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

    purgeExpiredChunkSessions();
    const uploadSessionId = `chk_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
    chunkUploadSessions.set(uploadSessionId, {
      uploadSessionId,
      fileName,
      totalChunks: parts,
      totalSizeBytes: declaredBytes,
      receivedBytes: 0,
      mimeType: safeMime,
      category,
      studyId,
      sequenceName,
      patientId: resolvedPatientId,
      expectedSha256: expectedSha256 ? String(expectedSha256).toLowerCase() : null,
      uploadedBy: req.user?.id || null,
      receivedChunks: new Map(),
      createdAt: Date.now(),
    });

    return res.status(201).json({
      success: true,
      instantDedup: false,
      message: "Khởi tạo phiên tải lên phân mảnh thành công.",
      data: {
        uploadSessionId,
        totalChunks: parts,
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
    const session = getOwnedSession(uploadSessionId, req.user);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Phiên tải lên phân mảnh không tồn tại hoặc đã hết hạn.",
      });
    }

    const idx = Number(chunkIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= session.totalChunks) {
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
    // Tổng dung lượng thật (gửi lại cùng một mảnh thì tính theo mảnh mới) không vượt giới hạn / dung lượng đã khai
    const previous = session.receivedChunks.get(idx) || 0;
    const nextTotal = session.receivedBytes - previous + chunkBuffer.length;
    const limit = session.totalSizeBytes > 0 ? session.totalSizeBytes : CHUNK_MAX_TOTAL_BYTES;
    if (chunkBuffer.length > CHUNK_MAX_PART_BYTES || nextTotal > limit) {
      return res.status(413).json({ success: false, message: "Mảnh ghép vượt quá dung lượng cho phép của phiên tải lên." });
    }

    const { sizeBytes } = await writeLocalChunk(uploadSessionId, idx, chunkBuffer);
    session.receivedChunks.set(idx, sizeBytes);
    session.receivedBytes = nextTotal;

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
    const session = getOwnedSession(uploadSessionId, req.user);
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
    if (session.totalSizeBytes > 0 && session.receivedBytes !== session.totalSizeBytes) {
      return res.status(400).json({ success: false, message: "Tổng dung lượng các mảnh không khớp dung lượng tệp đã khai báo." });
    }

    // 1. Ghép các mảnh vào tệp tạm bằng Stream (Zero-RAM-Spike)
    const tempRelativePath = path.posix.join("chunks_assembled", `${uploadSessionId}_${session.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
    const assembled = await assembleLocalChunks(uploadSessionId, session.totalChunks, tempRelativePath);

    // 2. Lưu vào Hybrid PACS qua putFromPath (mã hóa bản chính, tính SHA-256 bằng Stream, chống trùng, đẩy vào DriveSyncQueue)
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
      hospitalId: req.user?.hospitalId || null,
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
