import StoredMedicalFile from "../../models/storedMedicalFile.model.js";
import { readLocalBuffer, existsOnLocal } from "./localAdapter.js";
import { uploadEncryptedFile, getDriveFolderLockStats } from "./driveMirrorAdapter.js";
import { encryptBuffer } from "../../utils/cryptoStorage.util.js";

// ─── Cấu hình Hàng đợi Google Drive & AI (Có thể điều chỉnh khi chạy Test) ───
let driveQueueConfig = {
  maxConcurrency: Number(process.env.DRIVE_SYNC_CONCURRENCY || 2),
  rateLimitDelayMs: Number(process.env.DRIVE_SYNC_DELAY_MS || 200),
  baseRetryDelayMs: Number(process.env.DRIVE_SYNC_RETRY_MS || 1500),
  maxRetries: 2,
};

let aiQueueConfig = {
  maxConcurrency: Number(process.env.AI_QUEUE_CONCURRENCY || 2),
};

let customDriveUploaderForTest = null;

export const configurePacsQueues = ({ drive = {}, ai = {}, customDriveUploader = undefined } = {}) => {
  if (drive) driveQueueConfig = { ...driveQueueConfig, ...drive };
  if (ai) aiQueueConfig = { ...aiQueueConfig, ...ai };
  if (customDriveUploader !== undefined) customDriveUploaderForTest = customDriveUploader;
};

// ─── 1. DRIVE SYNC QUEUE (Zero-RAM-Hold + Rate Limit Protection + Cloud Dedup) ─
const drivePendingQueue = [];
let activeDriveWorkers = 0;
let driveStats = {
  enqueued: 0,
  synced: 0,
  deduplicatedOnCloud: 0,
  retried: 0,
  failed: 0,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientDriveError = (err) => {
  const msg = String(err?.message || "").toLowerCase();
  const code = Number(err?.code || err?.status || 0);
  if ([429, 500, 502, 503, 504].includes(code)) return true;
  if (
    msg.includes("rate limit") ||
    msg.includes("quota") ||
    msg.includes("too many requests") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("socket hang up") ||
    msg.includes("temporary")
  ) {
    return true;
  }
  return false;
};

/**
 * Xử lý 1 tác vụ đồng bộ Google Drive từ ổ cứng cục bộ (Không giữ Buffer trong hàng đợi)
 */
const executeSingleDriveSyncJob = async (job) => {
  const { fileRecordId, relativeDir, fileName, mimeType } = job;

  const record = await StoredMedicalFile.findById(fileRecordId);
  if (!record) return;
  if (record.syncStatus === "SYNCED" && record.driveFileId) return;

  // 1. Kiểm tra Cloud Deduplication theo SHA-256:
  // Nếu đã có 1 tệp cùng SHA-256 được đồng bộ thành công lên Drive trước đó -> Kế thừa luôn!
  if (record.sha256) {
    const existingSynced = await StoredMedicalFile.findOne({
      _id: { $ne: record._id },
      sha256: record.sha256,
      syncStatus: "SYNCED",
      driveFileId: { $ne: null },
      encryptionIv: { $ne: null },
      encryptionAuthTag: { $ne: null },
    }).lean();

    if (existingSynced) {
      await StoredMedicalFile.findByIdAndUpdate(record._id, {
        driveFileId: existingSynced.driveFileId,
        driveFolderId: existingSynced.driveFolderId,
        syncStatus: "SYNCED",
        encryptionIv: existingSynced.encryptionIv,
        encryptionAuthTag: existingSynced.encryptionAuthTag,
        isEncrypted: true,
        lastSyncAttemptAt: new Date(),
        syncError: null,
      });
      driveStats.deduplicatedOnCloud++;
      driveStats.synced++;
      return;
    }
  }

  // 2. Chỉ đọc tệp từ ổ cứng cục bộ KHI ĐẾN LƯỢT UPLOAD (Zero-RAM-Hold trong lúc chờ Queue)
  if (!existsOnLocal(record.localPath)) {
    throw new Error(`Tệp cục bộ không còn tồn tại để đồng bộ lên Drive: ${record.localPath}`);
  }

  const rawBuffer = await readLocalBuffer(record.localPath);
  const { encryptedBuffer, ivHex, authTagHex } = encryptBuffer(rawBuffer);
  const driveFileName = `${fileName || record.fileName}.enc`;

  const uploadFn = customDriveUploaderForTest || uploadEncryptedFile;
  const driveResult = await uploadFn(
    encryptedBuffer,
    relativeDir,
    driveFileName,
    mimeType || record.mimeType
  );

  await StoredMedicalFile.findByIdAndUpdate(record._id, {
    driveFileId: driveResult.driveFileId,
    driveFolderId: driveResult.driveFolderId,
    syncStatus: "SYNCED",
    encryptionIv: ivHex,
    encryptionAuthTag: authTagHex,
    isEncrypted: true,
    lastSyncAttemptAt: new Date(),
    syncError: null,
  });

  driveStats.synced++;
  console.log(`✅ [Storage Mirror Queue] Đã đồng bộ mã hóa tệp "${fileName || record.fileName}" lên Drive (ID: ${driveResult.driveFileId})`);
};

/**
 * Vòng lặp Worker điều tiết tốc độ đẩy lên Google Drive
 */
const drainDriveQueue = async () => {
  if (activeDriveWorkers >= driveQueueConfig.maxConcurrency) return;
  if (drivePendingQueue.length === 0) return;

  activeDriveWorkers++;
  const job = drivePendingQueue.shift();

  // Kích hoạt thêm worker nếu còn slot trống
  if (activeDriveWorkers < driveQueueConfig.maxConcurrency && drivePendingQueue.length > 0) {
    setImmediate(drainDriveQueue);
  }

  try {
    if (driveQueueConfig.rateLimitDelayMs > 0) {
      await sleep(driveQueueConfig.rateLimitDelayMs);
    }
    await executeSingleDriveSyncJob(job);
  } catch (err) {
    const canRetry = job.attempt < job.maxRetries && isTransientDriveError(err);
    if (canRetry) {
      job.attempt += 1;
      driveStats.retried++;
      const backoffMs = driveQueueConfig.baseRetryDelayMs * Math.pow(2, job.attempt - 1);
      console.warn(`⏳ [Storage Mirror Queue] Tạm nghẽn mạng/Rate-Limit cho "${job.fileName}", thử lại lần ${job.attempt}/${job.maxRetries} sau ${backoffMs}ms...`);
      setTimeout(() => {
        drivePendingQueue.push(job);
        drainDriveQueue();
      }, backoffMs);
    } else {
      driveStats.failed++;
      console.warn(`⚠️ [Storage Mirror] Lỗi khi đồng bộ ngầm tệp "${job.fileName}" lên Drive:`, err.message);
      try {
        await StoredMedicalFile.findByIdAndUpdate(job.fileRecordId, {
          syncStatus: "FAILED",
          syncError: err.message,
          lastSyncAttemptAt: new Date(),
          $inc: { syncRetries: 1 },
        });
      } catch (dbErr) {
        console.error("Lỗi cập nhật trạng thái lỗi sync vào DB:", dbErr);
      }
    }
  } finally {
    activeDriveWorkers--;
    if (drivePendingQueue.length > 0) {
      setImmediate(drainDriveQueue);
    }
  }
};

/**
 * Đưa một tệp đã lưu Local vào Hàng đợi Đồng bộ Google Drive
 * Tuyệt đối KHÔNG nhận hoặc giữ Buffer trong bộ nhớ hàng đợi.
 */
export const enqueueDriveSync = ({
  fileRecordId,
  relativeDir,
  fileName,
  mimeType = "application/octet-stream",
  priority = 5,
}) => {
  if (!fileRecordId) return;

  // Chống đẩy trùng cùng 1 fileRecordId vào hàng đợi
  const alreadyQueued = drivePendingQueue.some((j) => String(j.fileRecordId) === String(fileRecordId));
  if (alreadyQueued) return;

  drivePendingQueue.push({
    fileRecordId,
    relativeDir,
    fileName,
    mimeType,
    priority: Number(priority) || 5,
    attempt: 0,
    maxRetries: driveQueueConfig.maxRetries,
    enqueuedAt: Date.now(),
  });

  // Sắp xếp ưu tiên (1 = Cấp cứu chạy trước, 5 = Thường chạy sau)
  drivePendingQueue.sort((a, b) => a.priority - b.priority || a.enqueuedAt - b.enqueuedAt);
  driveStats.enqueued++;

  setImmediate(drainDriveQueue);
};

// ─── 2. PRIORITY AI JOB QUEUE (Chống quá tải FastAPI & Ưu tiên Cấp cứu) ────────
const aiPendingQueue = [];
let activeAiWorkers = 0;
let aiStats = {
  enqueued: 0,
  completed: 0,
  failed: 0,
};

const drainAiQueue = async () => {
  if (activeAiWorkers >= aiQueueConfig.maxConcurrency) return;
  if (aiPendingQueue.length === 0) return;

  activeAiWorkers++;
  const taskItem = aiPendingQueue.shift();

  if (activeAiWorkers < aiQueueConfig.maxConcurrency && aiPendingQueue.length > 0) {
    setImmediate(drainAiQueue);
  }

  try {
    const result = await taskItem.taskFn();
    aiStats.completed++;
    taskItem.resolve(result);
  } catch (err) {
    aiStats.failed++;
    taskItem.reject(err);
  } finally {
    activeAiWorkers--;
    if (aiPendingQueue.length > 0) {
      setImmediate(drainAiQueue);
    }
  }
};

/**
 * Đưa một tác vụ phân tích AI vào Hàng đợi Ưu tiên (Priority Queue)
 * @param {object} params
 * @param {Function} params.taskFn - Hàm async thực thi phân tích AI
 * @param {number} [params.priority=5] - 1 (Cấp cứu/Khẩn cấp) .. 5 (Thường)
 * @param {string} [params.visitId] - ID lượt khám
 * @param {string} [params.label] - Nhãn mô tả
 * @returns {Promise<any>}
 */
export const enqueueAiTask = ({ taskFn, priority = 5, visitId = null, label = "AI Analysis" }) => {
  return new Promise((resolve, reject) => {
    aiPendingQueue.push({
      taskFn,
      priority: Number(priority) || 5,
      visitId,
      label,
      enqueuedAt: Date.now(),
      resolve,
      reject,
    });

    // Sắp xếp hàng đợi: priority nhỏ hơn (1 = Cấp cứu) được nhảy lên đầu hàng đợi!
    aiPendingQueue.sort((a, b) => a.priority - b.priority || a.enqueuedAt - b.enqueuedAt);
    aiStats.enqueued++;

    setImmediate(drainAiQueue);
  });
};

/**
 * Lấy trạng thái tổng quan của Hàng đợi Đồng bộ Drive & Hàng đợi AI
 */
export const getPacsQueueStatus = () => {
  return {
    driveQueue: {
      maxConcurrency: driveQueueConfig.maxConcurrency,
      rateLimitDelayMs: driveQueueConfig.rateLimitDelayMs,
      activeWorkers: activeDriveWorkers,
      pendingCount: drivePendingQueue.length,
      stats: { ...driveStats },
      folderLocks: getDriveFolderLockStats(),
    },
    aiQueue: {
      maxConcurrency: aiQueueConfig.maxConcurrency,
      activeWorkers: activeAiWorkers,
      pendingCount: aiPendingQueue.length,
      pendingJobs: aiPendingQueue.map((j, idx) => ({
        position: idx + 1,
        priority: j.priority,
        visitId: j.visitId,
        label: j.label,
        waitingMs: Date.now() - j.enqueuedAt,
      })),
      stats: { ...aiStats },
    },
    memoryUsageMb: {
      rss: Math.round((process.memoryUsage().rss / 1024 / 1024) * 10) / 10,
      heapUsed: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 10) / 10,
    },
  };
};

export default {
  enqueueDriveSync,
  enqueueAiTask,
  getPacsQueueStatus,
  configurePacsQueues,
};
