import crypto from "crypto";
import path from "path";
import fs from "fs";
import StoredMedicalFile from "../../models/storedMedicalFile.model.js";
import {
  buildLogicalPath,
  writeLocalFile,
  writeLocalStreamExclusive,
  createLocalReadStream,
  readLocalBuffer,
  existsOnLocal,
  deleteLocalFile,
  getLocalRoot,
} from "./localAdapter.js";
import {
  downloadEncryptedFile,
  deleteDriveFile,
} from "./driveMirrorAdapter.js";
import {
  encryptBuffer,
  decryptBuffer,
  createEncryptionStream,
  createDecryptionStream,
  computeSha256,
  computeFileSha256Stream,
} from "../../utils/cryptoStorage.util.js";
import { enqueueDriveSync } from "./pacsQueue.service.js";

/**
 * Kho tệp y tế (Local-First + Drive mirror).
 *
 * - Mỗi tệp có đường dẫn vật lý riêng (tiền tố mã tệp) và không bao giờ ghi đè tệp đã có.
 *   Trước đây đường dẫn chỉ gồm thư mục ca + tên tệp gốc: hai tệp trùng tên của hai bệnh nhân ghi đè nhau.
 * - Bản chính trên máy chủ được mã hóa AES-256-GCM (FILE_ENCRYPTION_KEY). Bản sao Drive là đúng bản mã đó.
 *   Dữ liệu cũ (localEncrypted=false) là bản rõ: vẫn đọc được, kèm kiểm tra toàn vẹn.
 * - Trước khi trả nội dung, đối chiếu kích thước (và mã băm với tệp cũ bản rõ): không khớp thì khôi phục từ Drive
 *   nếu có, không có thì từ chối — không bao giờ trả nội dung của tệp khác.
 */

// Tệp cũ bản rõ lớn hơn ngưỡng này chỉ kiểm tra kích thước (băm cả tệp lớn mỗi lần xem quá tốn)
const LEGACY_HASH_CHECK_MAX_BYTES = 25 * 1024 * 1024;

const integrityError = (message) => Object.assign(new Error(message), { status: 409, code: "STORED_FILE_INTEGRITY" });

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

// localPath là đường dẫn tuyệt đối lúc ghi (vd. C:\\... trên Windows). Chạy ở máy khác thì tìm lại theo logicalPath dưới thư mục kho.
export const resolveStoredLocalPath = (file) => {
  if (file?.localPath && existsOnLocal(file.localPath)) return file.localPath;
  const byLogical = file?.logicalPath ? path.join(getLocalRoot(), file.logicalPath) : null;
  return byLogical && existsOnLocal(byLogical) ? byLogical : file?.localPath;
};

/**
 * Tìm bản ghi tệp tin đã tồn tại theo SHA-256 để chống lưu trùng (Content-Addressable Deduplication)
 * @param {string} sha256
 * @param {{ hospitalId?, uploadedBy?, localEncryptedOnly?: boolean }} [options]
 * @returns {Promise<StoredMedicalFile|null>}
 */
export const findExistingBySha256 = async (sha256, options = {}) => {
  if (!sha256) return null;
  try {
    // [BUG-STORAGE-001] Luôn cô lập: có viện thì trong viện, không có viện thì trong chính người tải lên.
    // Không truyền gì cũng không được khớp sang tệp của viện khác hay người khác.
    const query = options?.hospitalId
      ? { sha256, hospitalId: options.hospitalId }
      : { sha256, hospitalId: null, uploadedBy: options?.uploadedBy || null };
    // Ghi mới chỉ dùng chung bản chính ĐÃ mã hóa (không gắn tệp mới vào bản rõ đời cũ)
    if (options?.localEncryptedOnly) {
      Object.assign(query, { localEncrypted: true, encryptionIv: { $ne: null }, encryptionAuthTag: { $ne: null } });
    }
    const candidates = await StoredMedicalFile.find(query)
      .sort({ syncStatus: -1, createdAt: -1 })
      .limit(5)
      .lean();
    for (const item of candidates) {
      const localPath = resolveStoredLocalPath(item);
      if (localPath && existsOnLocal(localPath) && fs.statSync(localPath).size === item.sizeBytes) {
        return { ...item, localPath };
      }
    }
    return null;
  } catch {
    return null;
  }
};

/** Trường dùng chung khi một bản ghi mới trỏ vào bản chính đã mã hóa sẵn có (chống lưu trùng). */
const dedupFieldsFrom = (existing) => {
  const alreadySyncedOnDrive = Boolean(existing.syncStatus === "SYNCED" && existing.driveFileId);
  return {
    logicalPath: existing.logicalPath,
    localPath: existing.localPath,
    sizeBytes: existing.sizeBytes,
    localEncrypted: true,
    isEncrypted: true,
    encryptionIv: existing.encryptionIv,
    encryptionAuthTag: existing.encryptionAuthTag,
    syncStatus: alreadySyncedOnDrive ? "SYNCED" : "PENDING",
    driveFileId: alreadySyncedOnDrive ? existing.driveFileId : null,
    driveFolderId: alreadySyncedOnDrive ? existing.driveFolderId : null,
    alreadySyncedOnDrive,
  };
};

const createRecordAndQueueSync = async ({ fields, category, syncToDrive, priority }) => {
  const { alreadySyncedOnDrive, ...recordFields } = fields;
  const fileRecord = await StoredMedicalFile.create(recordFields);
  if (syncToDrive && category !== "ai_temp" && !alreadySyncedOnDrive) {
    enqueueDriveSync({
      fileRecordId: fileRecord._id,
      relativeDir: path.posix.dirname(fileRecord.logicalPath),
      fileName: fileRecord.fileName,
      mimeType: fileRecord.mimeType,
      ...(priority !== undefined ? { priority } : {}),
    });
  }
  return fileRecord;
};

/**
 * Ghi tệp tin mới vào hệ thống từ Buffer (Local-First mã hóa + SHA-256 Deduplication + Queued Drive Mirror)
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
  hospitalId = null,
  syncToDrive = true,
  enableDeduplication = true,
}) => {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error("Dữ liệu tệp không hợp lệ (cần Buffer).");
  }

  const fileId = crypto.randomUUID();
  const sha256 = computeSha256(buffer);
  const base = { fileId, category, studyId, sequenceName, fileName, sha256, mimeType, hospitalId: hospitalId || null, patientId, uploadedBy };

  // 1. Chống lưu trùng (chỉ trong cùng viện / cùng người tải, chỉ với bản chính đã mã hóa)
  const existing = enableDeduplication
    ? await findExistingBySha256(sha256, { hospitalId, uploadedBy, localEncryptedOnly: true })
    : null;
  if (existing) {
    return createRecordAndQueueSync({ fields: { ...base, ...dedupFieldsFrom(existing) }, category, syncToDrive });
  }

  // 2. Mã hóa rồi ghi bản chính vào đường dẫn riêng của tệp (không ghi đè)
  const logicalPath = buildLogicalPath({ category, studyId, sequenceName, fileName, patientName, uniqueId: fileId });
  const { encryptedBuffer, ivHex, authTagHex } = encryptBuffer(buffer);
  const written = await writeLocalFile(logicalPath, encryptedBuffer, { exclusive: true });

  return createRecordAndQueueSync({
    fields: {
      ...base,
      logicalPath,
      localPath: written.localPath,
      sizeBytes: buffer.length,
      localEncrypted: true,
      isEncrypted: true,
      encryptionIv: ivHex,
      encryptionAuthTag: authTagHex,
      syncStatus: "PENDING",
      driveFileId: null,
      driveFolderId: null,
      alreadySyncedOnDrive: false,
    },
    category,
    syncToDrive,
  });
};

/**
 * Ghi tệp tin vào hệ thống trực tiếp từ đường dẫn đĩa (Zero-RAM-Spike Stream)
 * Dành cho tệp lớn từ Multer hoặc Chunked Upload mà KHÔNG nạp toàn bộ tệp vào RAM.
 * moveFile=true: xóa tệp nguồn (tệp tạm) sau khi đã lưu bản mã vào kho.
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
  hospitalId = null,
  syncToDrive = true,
  enableDeduplication = true,
  priority = 5,
}) => {
  if (!sourceFilePath || !existsOnLocal(sourceFilePath)) {
    throw new Error(`Tệp nguồn không tồn tại: ${sourceFilePath}`);
  }

  const fileId = crypto.randomUUID();
  // 1. Tính SHA-256 bằng Stream (từng mảnh 64KB, không tốn RAM)
  const { sha256, sizeBytes } = await computeFileSha256Stream(sourceFilePath);
  const base = { fileId, category, studyId, sequenceName, fileName, sha256, mimeType, hospitalId: hospitalId || null, patientId, uploadedBy };

  // 2. Chống lưu trùng
  const existing = enableDeduplication
    ? await findExistingBySha256(sha256, { hospitalId, uploadedBy, localEncryptedOnly: true })
    : null;
  if (existing) {
    if (moveFile && path.resolve(sourceFilePath) !== path.resolve(existing.localPath)) {
      await fs.promises.unlink(sourceFilePath).catch(() => {});
    }
    return createRecordAndQueueSync({ fields: { ...base, ...dedupFieldsFrom(existing) }, category, syncToDrive, priority });
  }

  // 3. Mã hóa dạng stream vào đường dẫn riêng của tệp (không ghi đè)
  const logicalPath = buildLogicalPath({ category, studyId, sequenceName, fileName, patientName, uniqueId: fileId });
  const { cipher, ivHex, getAuthTagHex } = createEncryptionStream();
  const written = await writeLocalStreamExclusive(logicalPath, fs.createReadStream(sourceFilePath, { highWaterMark: 64 * 1024 }), cipher);
  const authTagHex = getAuthTagHex();
  if (moveFile) await fs.promises.unlink(sourceFilePath).catch(() => {});

  return createRecordAndQueueSync({
    fields: {
      ...base,
      logicalPath,
      localPath: written.localPath,
      sizeBytes,
      localEncrypted: true,
      isEncrypted: true,
      encryptionIv: ivHex,
      encryptionAuthTag: authTagHex,
      syncStatus: "PENDING",
      driveFileId: null,
      driveFolderId: null,
      alreadySyncedOnDrive: false,
    },
    category,
    syncToDrive,
    priority,
  });
};

/**
 * Tạo bản ghi mới trỏ vào bản chính đã có (dùng cho Instant Dedup của upload phân mảnh) —
 * không đọc lại tệp, không mã hóa lại.
 */
export const createDedupReference = async (existing, { category, studyId = null, sequenceName = null, fileName, mimeType, patientId = null, uploadedBy = null, hospitalId = null, syncToDrive = true }) => {
  if (!existing?.localEncrypted) throw new Error("Chỉ dùng chung được bản chính đã mã hóa.");
  return createRecordAndQueueSync({
    fields: {
      fileId: crypto.randomUUID(), category, studyId, sequenceName, fileName, sha256: existing.sha256,
      mimeType: mimeType || existing.mimeType, hospitalId: hospitalId || null, patientId, uploadedBy,
      ...dedupFieldsFrom(existing),
    },
    category,
    syncToDrive,
  });
};

/**
 * Khôi phục bản chính từ bản sao mã hóa trên Drive vào một đường dẫn MỚI (không ghi đè tệp đang có ở đường dẫn cũ —
 * với dữ liệu cũ, đường dẫn cũ có thể đang là tệp của bệnh nhân khác). Bản ghi chuyển sang bản chính mã hóa.
 */
const restoreFromDrive = async (file, reason) => {
  if (!(file.driveFileId && file.encryptionIv && file.encryptionAuthTag)) return null;
  console.warn(`[Self-Healing] ${reason}: tệp ${file.fileId}. Đang phục hồi từ bản sao Drive...`);
  const encryptedBuffer = await downloadEncryptedFile(file.driveFileId);
  const decrypted = decryptBuffer(encryptedBuffer, file.encryptionIv, file.encryptionAuthTag);
  if (computeSha256(decrypted) !== file.sha256) {
    throw integrityError("Bản sao trên Drive không khớp mã băm của tệp gốc.");
  }
  const dir = path.posix.dirname(file.logicalPath || `restored/${file.fileId}`);
  const logicalPath = path.posix.join(dir, `restored_${file.fileId}_${path.posix.basename(file.logicalPath || file.fileName || "file")}`);
  let localPath = path.join(getLocalRoot(), logicalPath);
  if (!existsOnLocal(localPath)) {
    localPath = (await writeLocalFile(logicalPath, encryptedBuffer, { exclusive: true })).localPath;
  }
  // Mọi bản ghi đang dùng chung bản sao Drive này (chống lưu trùng) cùng chuyển sang bản đã khôi phục
  await StoredMedicalFile.updateMany(
    { driveFileId: file.driveFileId, encryptionIv: file.encryptionIv, sha256: file.sha256 },
    { $set: { localPath, logicalPath, localEncrypted: true, isEncrypted: true } }
  );
  console.log(`✅ [Self-Healing] Đã phục hồi tệp ${file.fileId} từ Drive.`);
  return { ...(typeof file.toObject === "function" ? file.toObject() : file), localPath, logicalPath, localEncrypted: true, isEncrypted: true };
};

const sha256OfFile = async (filePath) => (await computeFileSha256Stream(filePath)).sha256;

/**
 * Tìm bản chính hợp lệ của tệp: tồn tại, đúng kích thước, (tệp cũ bản rõ) đúng mã băm.
 * Không hợp lệ → khôi phục từ Drive nếu có, nếu không thì ném lỗi 404/409. Trả về bản ghi (có thể đã cập nhật đường dẫn).
 */
const resolveVerifiedFile = async (file) => {
  const localPath = resolveStoredLocalPath(file);
  if (!localPath || !existsOnLocal(localPath)) {
    try {
      const restored = await restoreFromDrive(file, "Không còn bản chính trên máy chủ");
      if (restored) return restored;
    } catch (err) {
      console.error("❌ [Self-Healing Thất Bại]", err.message);
      throw Object.assign(new Error("Tệp tin bị hỏng hoặc không thể phục hồi từ bản sao lưu: " + err.message), { status: err.status || 500, code: err.code });
    }
    throw Object.assign(new Error("Tệp tin không còn tồn tại trên cả máy chủ và bản sao lưu đám mây."), { status: 404 });
  }

  let reason = null;
  const size = fs.statSync(localPath).size;
  if (size !== file.sizeBytes) reason = "Kích thước bản chính không khớp bản ghi";
  else if (!file.localEncrypted && size <= LEGACY_HASH_CHECK_MAX_BYTES && (await sha256OfFile(localPath)) !== file.sha256) {
    reason = "Mã băm bản chính không khớp bản ghi";
  }
  if (!reason) return { ...(typeof file.toObject === "function" ? file.toObject() : file), localPath };

  let restored = null;
  try {
    restored = await restoreFromDrive(file, reason);
  } catch (err) {
    console.error("❌ [Self-Healing Thất Bại]", err.message);
  }
  if (restored) return restored;
  throw integrityError(
    "Tệp lưu trữ không còn khớp với hồ sơ (có thể đã bị ghi đè bởi tệp trùng tên trước bản sửa lỗi). Hệ thống không trả nội dung để tránh nhầm hồ sơ; liên hệ quản trị để khôi phục."
  );
};

/** Stream nội dung GỐC (đã giải mã nếu bản chính là bản mã). Lỗi xác thực GCM được đẩy ra stream. */
const openPlainStream = (file) => {
  const raw = createLocalReadStream(file.localPath);
  if (!file.localEncrypted) return raw;
  const decipher = createDecryptionStream(file.encryptionIv, file.encryptionAuthTag);
  raw.on("error", (err) => decipher.destroy(err));
  return raw.pipe(decipher);
};

/**
 * Đọc stream tệp tin (Tự động phục hồi từ Drive nếu bản chính mất hoặc không khớp)
 * @param {string} fileId
 * @returns {Promise<{ stream: import("stream").Readable, file: object }>}
 */
export const getFileStream = async (fileId) => {
  const record = await StoredMedicalFile.findOne({ fileId });
  if (!record) {
    const err = new Error("Không tìm thấy tệp tin trong hệ thống lưu trữ.");
    err.status = 404;
    throw err;
  }
  const file = await resolveVerifiedFile(record);
  return { stream: openPlainStream(file), file };
};

/**
 * Đọc nhị phân Buffer (nội dung gốc) của tệp tin, có kiểm tra toàn vẹn.
 * @param {string} fileId
 * @returns {Promise<{ buffer: Buffer, file: object }>}
 */
export const getFileBuffer = async (fileId) => {
  const record = await StoredMedicalFile.findOne({ fileId });
  if (!record) {
    const err = new Error("Không tìm thấy tệp tin trong hệ thống lưu trữ.");
    err.status = 404;
    throw err;
  }
  const file = await resolveVerifiedFile(record);
  const stored = await readLocalBuffer(file.localPath);
  const buffer = file.localEncrypted ? decryptBuffer(stored, file.encryptionIv, file.encryptionAuthTag) : stored;
  if (buffer.length !== file.sizeBytes || computeSha256(buffer) !== file.sha256) {
    throw integrityError("Nội dung tệp không khớp mã băm của hồ sơ.");
  }
  return { buffer, file };
};

/**
 * Xóa tệp tin khỏi cả Local Storage, Drive và Database.
 * Chỉ xóa tệp vật lý khi không còn bản ghi nào khác trỏ cùng đường dẫn; chỉ xóa bản Drive khi không còn bản ghi nào dùng nó.
 * @param {string} fileId
 */
export const deleteFile = async (fileId) => {
  const file = await StoredMedicalFile.findOne({ fileId });
  if (!file) return;

  const otherLocalRefs = await StoredMedicalFile.countDocuments({ _id: { $ne: file._id }, localPath: file.localPath });
  if (otherLocalRefs === 0) {
    await deleteLocalFile(resolveStoredLocalPath(file));
  }
  if (file.driveFileId) {
    const otherDriveRefs = await StoredMedicalFile.countDocuments({ _id: { $ne: file._id }, driveFileId: file.driveFileId });
    if (otherDriveRefs === 0) await deleteDriveFile(file.driveFileId);
  }

  await StoredMedicalFile.deleteOne({ _id: file._id });
};

export default {
  put: putFile,
  putFromPath: putFileFromPath,
  putFileFromPath,
  createDedupReference,
  findExistingBySha256,
  get: getFileStream,
  getBuffer: getFileBuffer,
  delete: deleteFile,
};
