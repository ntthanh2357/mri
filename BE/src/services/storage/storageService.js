import crypto from "crypto";
import path from "path";
import fs from "fs";
import StoredMedicalFile from "../../models/storedMedicalFile.model.js";
import {
  buildLogicalPath,
  writeLocalFile,
  writeLocalFileFromPath,
  createLocalReadStream,
  readLocalBuffer,
  existsOnLocal,
  deleteLocalFile,
} from "./localAdapter.js";
import {
  downloadEncryptedFile,
  deleteDriveFile,
} from "./driveMirrorAdapter.js";
import {
  decryptBuffer,
  computeSha256,
  computeFileSha256Stream,
} from "../../utils/cryptoStorage.util.js";
import { enqueueDriveSync } from "./pacsQueue.service.js";

/**
 * Đẩy ngầm một tệp tin lên Google Drive qua Hàng đợi điều tiết (DriveSyncQueue)
 * Không giữ Buffer trong RAM để chống tràn bộ nhớ khi nhiều KTV tải lên cùng lúc.
 */
export const triggerDriveSyncAsync = async (fileRecordId, _bufferUnused, relativeDir, fileName, mimeType, priority = 5) => {
  enqueueDriveSync({
    fileRecordId,
    relativeDir,
    fileName,
    mimeType,
    priority,
  });
};

/**
 * Tìm bản ghi tệp tin đã tồn tại theo SHA-256 để chống lưu trùng (Content-Addressable Deduplication)
 * @param {string} sha256
 * @returns {Promise<StoredMedicalFile|null>}
 */
export const findExistingBySha256 = async (sha256) => {
  if (!sha256) return null;
  try {
    const candidates = await StoredMedicalFile.find({ sha256 })
      .sort({ syncStatus: -1, createdAt: -1 })
      .limit(5)
      .lean();
    for (const item of candidates) {
      if (item.localPath && existsOnLocal(item.localPath)) {
        return item;
      }
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Ghi tệp tin mới vào hệ thống từ Buffer (Local-First + SHA-256 Deduplication + Queued Drive Mirror)
 */
export const putFile = async ({
  category,
  studyId = null,
  sequenceName = null,
  fileName,
  buffer,
  mimeType = "application/octet-stream",
  patientName = null,
  patientId = null,
  uploadedBy = null,
  syncToDrive = true,
  enableDeduplication = true,
}) => {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error("Dữ liệu tệp không hợp lệ (cần Buffer).");
  }

  const fileId = crypto.randomUUID();
  const sha256 = computeSha256(buffer);
  const logicalPath = buildLogicalPath({ category, studyId, sequenceName, fileName, patientName });

  // 1. Kiểm tra chống lưu trùng theo SHA-256 (Deduplication)
  const existing = enableDeduplication ? await findExistingBySha256(sha256) : null;
  let localPath;
  let sizeBytes;
  let isDeduplicated = false;

  if (existing && existsOnLocal(existing.localPath)) {
    localPath = existing.localPath;
    sizeBytes = existing.sizeBytes || buffer.length;
    isDeduplicated = true;
  } else {
    // Ghi tệp ngay lập tức vào Local Storage (Bản chính - 100% không nghẽn mạng)
    const written = await writeLocalFile(logicalPath, buffer);
    localPath = written.localPath;
    sizeBytes = written.sizeBytes;
  }

  const alreadySyncedOnDrive = Boolean(
    existing &&
      existing.syncStatus === "SYNCED" &&
      existing.driveFileId &&
      existing.encryptionIv &&
      existing.encryptionAuthTag
  );

  // 2. Tạo bản ghi quản trị tệp tin trong Database
  const fileRecord = await StoredMedicalFile.create({
    fileId,
    category,
    studyId,
    sequenceName,
    fileName,
    logicalPath: isDeduplicated ? existing.logicalPath : logicalPath,
    localPath,
    sha256,
    sizeBytes,
    mimeType,
    syncStatus: alreadySyncedOnDrive ? "SYNCED" : "PENDING",
    driveFileId: alreadySyncedOnDrive ? existing.driveFileId : null,
    driveFolderId: alreadySyncedOnDrive ? existing.driveFolderId : null,
    encryptionIv: alreadySyncedOnDrive ? existing.encryptionIv : null,
    encryptionAuthTag: alreadySyncedOnDrive ? existing.encryptionAuthTag : null,
    isEncrypted: true,
    patientId,
    uploadedBy,
  });

  // 3. Đưa tác vụ mã hóa & tải lên Drive vào Hàng đợi DriveSyncQueue (nếu chưa có trên Drive)
  if (syncToDrive && category !== "ai_temp" && !alreadySyncedOnDrive) {
    const relativeDir = path.dirname(logicalPath);
    enqueueDriveSync({
      fileRecordId: fileRecord._id,
      relativeDir,
      fileName,
      mimeType,
    });
  }

  return fileRecord;
};

/**
 * Ghi tệp tin vào hệ thống trực tiếp từ đường dẫn đĩa (Zero-RAM-Spike Stream)
 * Dành cho tệp lớn từ Multer hoặc Chunked Upload mà KHÔNG nạp toàn bộ tệp vào RAM.
 */
export const putFileFromPath = async ({
  category,
  studyId = null,
  sequenceName = null,
  fileName,
  sourceFilePath,
  moveFile = false,
  mimeType = "application/octet-stream",
  patientName = null,
  patientId = null,
  uploadedBy = null,
  syncToDrive = true,
  enableDeduplication = true,
  priority = 5,
}) => {
  if (!sourceFilePath || !existsOnLocal(sourceFilePath)) {
    throw new Error(`Tệp nguồn không tồn tại: ${sourceFilePath}`);
  }

  const fileId = crypto.randomUUID();
  // 1. Tính SHA-256 bằng Stream (từng mảnh 64KB, không tốn RAM)
  const { sha256, sizeBytes: streamedSize } = await computeFileSha256Stream(sourceFilePath);
  const logicalPath = buildLogicalPath({ category, studyId, sequenceName, fileName, patientName });

  // 2. Kiểm tra chống lưu trùng (SHA-256 Deduplication)
  const existing = enableDeduplication ? await findExistingBySha256(sha256) : null;
  let localPath;
  let sizeBytes = streamedSize;
  let isDeduplicated = false;

  if (existing && existsOnLocal(existing.localPath)) {
    localPath = existing.localPath;
    sizeBytes = existing.sizeBytes || streamedSize;
    isDeduplicated = true;
    // Nếu yêu cầu moveFile (dọn tệp tạm Multer), xóa tệp tạm vì đã có bản chính trong kho PACS
    if (moveFile && path.resolve(sourceFilePath) !== path.resolve(existing.localPath)) {
      await fs.promises.unlink(sourceFilePath).catch(() => {});
    }
  } else {
    const written = await writeLocalFileFromPath(logicalPath, sourceFilePath, { moveFile });
    localPath = written.localPath;
    sizeBytes = written.sizeBytes;
  }

  const alreadySyncedOnDrive = Boolean(
    existing &&
      existing.syncStatus === "SYNCED" &&
      existing.driveFileId &&
      existing.encryptionIv &&
      existing.encryptionAuthTag
  );

  // 3. Tạo bản ghi quản trị tệp tin trong Database
  const fileRecord = await StoredMedicalFile.create({
    fileId,
    category,
    studyId,
    sequenceName,
    fileName,
    logicalPath: isDeduplicated ? existing.logicalPath : logicalPath,
    localPath,
    sha256,
    sizeBytes,
    mimeType,
    syncStatus: alreadySyncedOnDrive ? "SYNCED" : "PENDING",
    driveFileId: alreadySyncedOnDrive ? existing.driveFileId : null,
    driveFolderId: alreadySyncedOnDrive ? existing.driveFolderId : null,
    encryptionIv: alreadySyncedOnDrive ? existing.encryptionIv : null,
    encryptionAuthTag: alreadySyncedOnDrive ? existing.encryptionAuthTag : null,
    isEncrypted: true,
    patientId,
    uploadedBy,
  });

  // 4. Xếp vào Hàng đợi Đồng bộ Google Drive (nếu chưa có bản sao trên Drive)
  if (syncToDrive && category !== "ai_temp" && !alreadySyncedOnDrive) {
    const relativeDir = path.dirname(logicalPath);
    enqueueDriveSync({
      fileRecordId: fileRecord._id,
      relativeDir,
      fileName,
      mimeType,
      priority,
    });
  }

  return fileRecord;
};

/**
 * Đọc stream tệp tin (Tự động phục hồi từ Drive nếu Local bị mất)
 * @param {string} fileId
 * @returns {Promise<{ stream: fs.ReadStream, file: StoredMedicalFile }>}
 */
export const getFileStream = async (fileId) => {
  const file = await StoredMedicalFile.findOne({ fileId });
  if (!file) {
    const err = new Error("Không tìm thấy tệp tin trong hệ thống lưu trữ.");
    err.status = 404;
    throw err;
  }

  // 1. Nếu file tồn tại trên Local ➔ Stream ngay lập tức
  if (existsOnLocal(file.localPath)) {
    return {
      stream: createLocalReadStream(file.localPath),
      file,
    };
  }

  // 2. Nếu file trên Local bị mất nhưng có bản sao lưu trên Drive ➔ Tự phục hồi (Self-Healing)
  if (file.driveFileId && file.encryptionIv && file.encryptionAuthTag) {
    console.warn(`[Self-Healing] Phát hiện file local bị mất: ${file.localPath}. Đang phục hồi từ Google Drive...`);
    try {
      const encryptedBuffer = await downloadEncryptedFile(file.driveFileId);
      // [FIX]: Truyền đúng thứ tự (encryptedBuffer, ivHex, authTagHex)
      const decrypted = decryptBuffer(encryptedBuffer, file.encryptionIv, file.encryptionAuthTag);

      // Đối chiếu hash để chắc chắn tính toàn vẹn
      const checkSha = computeSha256(decrypted);
      if (checkSha !== file.sha256) {
        throw new Error("Mã băm SHA-256 không khớp sau khi giải mã từ Drive!");
      }

      // Ghi phục hồi lại vào Local Storage
      await writeLocalFile(file.logicalPath, decrypted);
      console.log(`✅ [Self-Healing] Đã tự động phục hồi thành công file "${file.fileName}" về Local Storage.`);

      return {
        stream: createLocalReadStream(file.localPath),
        file,
      };
    } catch (restoreErr) {
      console.error(`❌ [Self-Healing Thất Bại] Không thể phục hồi file từ Drive:`, restoreErr.message);
      const err = new Error("Tệp tin bị hỏng hoặc không thể phục hồi từ bản sao lưu: " + restoreErr.message);
      err.status = 500;
      throw err;
    }
  }

  const err = new Error("Tệp tin không còn tồn tại trên cả máy chủ và bản sao lưu đám mây.");
  err.status = 404;
  throw err;
};

/**
 * Đọc nhị phân Buffer của tệp tin
 * @param {string} fileId
 * @returns {Promise<{ buffer: Buffer, file: StoredMedicalFile }>}
 */
export const getFileBuffer = async (fileId) => {
  const { file } = await getFileStream(fileId);
  const buffer = await readLocalBuffer(file.localPath);
  return { buffer, file };
};

/**
 * Xóa tệp tin khỏi cả Local Storage, Drive và Database
 * Chỉ xóa tệp vật lý / Drive nếu không còn bản ghi deduplicated nào khác đang tham chiếu tới cùng sha256.
 * @param {string} fileId
 */
export const deleteFile = async (fileId) => {
  const file = await StoredMedicalFile.findOne({ fileId });
  if (!file) return;

  const otherRefsCount = await StoredMedicalFile.countDocuments({
    _id: { $ne: file._id },
    sha256: file.sha256,
  });

  if (otherRefsCount === 0) {
    // Xóa local
    await deleteLocalFile(file.localPath);

    // Xóa Drive nếu có
    if (file.driveFileId) {
      await deleteDriveFile(file.driveFileId);
    }
  }

  // Xóa bản ghi DB
  await StoredMedicalFile.deleteOne({ _id: file._id });
};

export default {
  put: putFile,
  putFromPath: putFileFromPath,
  findExistingBySha256,
  get: getFileStream,
  getBuffer: getFileBuffer,
  delete: deleteFile,
};
