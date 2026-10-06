import crypto from "crypto";
import path from "path";
import StoredMedicalFile from "../../models/storedMedicalFile.model.js";
import {
  buildLogicalPath,
  writeLocalFile,
  createLocalReadStream,
  readLocalBuffer,
  existsOnLocal,
  deleteLocalFile,
} from "./localAdapter.js";
import {
  uploadEncryptedFile,
  downloadEncryptedFile,
  deleteDriveFile,
} from "./driveMirrorAdapter.js";
import { encryptBuffer, decryptBuffer, computeSha256 } from "../../utils/cryptoStorage.util.js";

/**
 * Đẩy ngầm một tệp tin lên Google Drive (Asynchronous Background Mirror)
 * Hàm này chạy ngầm không chặn luồng chính của Controller
 */
export const triggerDriveSyncAsync = async (fileRecordId, buffer, relativeDir, fileName, mimeType) => {
  // Thực hiện trong setImmediate để tách hoàn toàn khỏi luồng Event Loop chính
  setImmediate(async () => {
    try {
      // 1. Mã hóa AES-256-GCM
      const { encryptedBuffer, ivHex, authTagHex } = encryptBuffer(buffer);

      // 2. Upload file mã hóa lên Google Drive
      const driveFileName = `${fileName}.enc`;
      const driveResult = await uploadEncryptedFile(encryptedBuffer, relativeDir, driveFileName, mimeType);

      // 3. Cập nhật trạng thái SYNCED vào DB
      await StoredMedicalFile.findByIdAndUpdate(fileRecordId, {
        driveFileId: driveResult.driveFileId,
        driveFolderId: driveResult.driveFolderId,
        syncStatus: "SYNCED",
        encryptionIv: ivHex,
        encryptionAuthTag: authTagHex,
        isEncrypted: true,
        lastSyncAttemptAt: new Date(),
        syncError: null,
      });

      console.log(`✅ [Storage Mirror] Đã đồng bộ mã hóa tệp "${fileName}" lên Drive (ID: ${driveResult.driveFileId})`);
    } catch (err) {
      console.warn(`⚠️ [Storage Mirror] Lỗi khi đồng bộ ngầm tệp "${fileName}" lên Drive:`, err.message);
      try {
        await StoredMedicalFile.findByIdAndUpdate(fileRecordId, {
          syncStatus: "FAILED",
          syncError: err.message,
          lastSyncAttemptAt: new Date(),
          $inc: { syncRetries: 1 },
        });
      } catch (dbErr) {
        console.error("Lỗi cập nhật trạng thái lỗi sync vào DB:", dbErr);
      }
    }
  });
};

/**
 * Ghi tệp tin mới vào hệ thống (Local-First: Ghi local ngay, đồng bộ Drive ngầm)
 * @param {object} params
 * @param {string} params.category - 'pacs' | 'sequence_slice' | 'report' | 'patient_upload' | 'ai_temp' | 'backup'
 * @param {string} [params.studyId] - ID ca chụp
 * @param {string} [params.sequenceName] - Tên chuỗi xung
 * @param {string} params.fileName - Tên tệp
 * @param {Buffer} params.buffer - Dữ liệu nhị phân
 * @param {string} [params.mimeType] - MimeType
 * @param {string} [params.patientId] - ID bệnh nhân
 * @param {string} [params.uploadedBy] - ID người tải lên
 * @param {boolean} [params.syncToDrive=true] - Có đồng bộ lên Drive không
 * @returns {Promise<StoredMedicalFile>}
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
}) => {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error("Dữ liệu tệp không hợp lệ (cần Buffer).");
  }

  const fileId = crypto.randomUUID();
  const logicalPath = buildLogicalPath({ category, studyId, sequenceName, fileName, patientName });

  // 1. Ghi tệp ngay lập tức vào Local Storage (Bản chính - 100% không nghẽn mạng)
  const { localPath, sizeBytes } = await writeLocalFile(logicalPath, buffer);
  const sha256 = computeSha256(buffer);

  // 2. Tạo bản ghi quản trị tệp tin trong Database với trạng thái PENDING
  const fileRecord = await StoredMedicalFile.create({
    fileId,
    category,
    studyId,
    sequenceName,
    fileName,
    logicalPath,
    localPath,
    sha256,
    sizeBytes,
    mimeType,
    syncStatus: "PENDING",
    patientId,
    uploadedBy,
  });

  // 3. Đưa tác vụ mã hóa & tải lên Drive vào tiến trình chạy ngầm
  if (syncToDrive && category !== "ai_temp") {
    const relativeDir = path.dirname(logicalPath);
    triggerDriveSyncAsync(fileRecord._id, buffer, relativeDir, fileName, mimeType);
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
      const decrypted = decryptBuffer(encryptedBuffer, null, file.encryptionIv, file.encryptionAuthTag);

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
 * @param {string} fileId
 */
export const deleteFile = async (fileId) => {
  const file = await StoredMedicalFile.findOne({ fileId });
  if (!file) return;

  // Xóa local
  await deleteLocalFile(file.localPath);

  // Xóa Drive nếu có
  if (file.driveFileId) {
    await deleteDriveFile(file.driveFileId);
  }

  // Xóa bản ghi DB
  await StoredMedicalFile.deleteOne({ _id: file._id });
};

export default {
  put: putFile,
  get: getFileStream,
  getBuffer: getFileBuffer,
  delete: deleteFile,
};
