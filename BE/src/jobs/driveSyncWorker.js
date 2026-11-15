import path from "path";
import StoredMedicalFile from "../models/storedMedicalFile.model.js";
import { readLocalBuffer, existsOnLocal, getLocalRoot } from "../services/storage/localAdapter.js";
import { uploadEncryptedFile } from "../services/storage/driveMirrorAdapter.js";
import { encryptBuffer } from "../utils/cryptoStorage.util.js";

// localPath lưu tuyệt đối lúc ghi (vd. C:\... trên Windows): chạy trong Docker Linux phải tìm lại theo logicalPath dưới thư mục kho
const resolveLocal = (file) => {
  if (file.localPath && existsOnLocal(file.localPath)) return file.localPath;
  const byLogical = file.logicalPath ? path.join(getLocalRoot(), file.logicalPath) : null;
  return byLogical && existsOnLocal(byLogical) ? byLogical : null;
};

let isSyncRunning = false;

/**
 * Thực hiện 1 đợt quét và đồng bộ bù lên Google Drive
 * @returns {Promise<{ processed: number, success: number, failed: number }>}
 */
export const runSyncBatch = async () => {
  if (isSyncRunning) {
    console.log("[Drive Sync Worker] Đang có tiến trình đồng bộ chạy, bỏ qua đợt này.");
    return { processed: 0, success: 0, failed: 0 };
  }

  isSyncRunning = true;
  let successCount = 0;
  let failedCount = 0;

  try {
    // Tìm tối đa 10 tệp cần đồng bộ
    const pendingFiles = await StoredMedicalFile.find({
      category: { $ne: "ai_temp" },
      $or: [
        { syncStatus: "PENDING" },
        { syncStatus: "FAILED", syncRetries: { $lt: 5 } },
      ],
    })
      .sort({ updatedAt: 1 })
      .limit(10);

    if (pendingFiles.length === 0) {
      isSyncRunning = false;
      return { processed: 0, success: 0, failed: 0 };
    }

    console.log(`[Drive Sync Worker] Bắt đầu đồng bộ ${pendingFiles.length} tệp tin lên Google Drive...`);

    for (const file of pendingFiles) {
      try {
        const localPath = resolveLocal(file);
        if (!localPath) {
          file.syncStatus = "FAILED";
          file.syncError = "Không tìm thấy tệp tin trên ổ cứng cục bộ để đồng bộ.";
          file.lastSyncAttemptAt = new Date();
          // Tính vào số lần thử: trước đây không tăng nên tệp mất bị thử lại mãi, 3 phút một lần
          file.syncRetries += 1;
          await file.save();
          failedCount++;
          continue;
        }

        const buffer = await readLocalBuffer(localPath);
        // Bản chính đã mã hóa: đẩy nguyên bản mã (giữ IV/tag). Dữ liệu cũ bản rõ: mã hóa cho bản sao Drive.
        const { encryptedBuffer, ivHex, authTagHex } = file.localEncrypted
          ? { encryptedBuffer: buffer, ivHex: file.encryptionIv, authTagHex: file.encryptionAuthTag }
          : encryptBuffer(buffer);

        const relativeDir = path.dirname(file.logicalPath);
        const driveFileName = `${file.fileName}.enc`;

        const driveResult = await uploadEncryptedFile(
          encryptedBuffer,
          relativeDir,
          driveFileName,
          file.mimeType
        );

        file.driveFileId = driveResult.driveFileId;
        file.driveFolderId = driveResult.driveFolderId;
        file.syncStatus = "SYNCED";
        file.encryptionIv = ivHex;
        file.encryptionAuthTag = authTagHex;
        file.syncError = null;
        file.lastSyncAttemptAt = new Date();
        await file.save();

        successCount++;
        console.log(`✅ [Drive Sync Worker] Đã đồng bộ bù thành công: ${file.fileName} -> Drive ID: ${driveResult.driveFileId}`);
      } catch (fileErr) {
        failedCount++;
        file.syncRetries += 1;
        file.syncStatus = "FAILED";
        file.syncError = fileErr.message;
        file.lastSyncAttemptAt = new Date();
        await file.save();
        console.warn(`⚠️ [Drive Sync Worker] Đồng bộ thất bại tệp "${file.fileName}" (Lần ${file.syncRetries}/5): ${fileErr.message}`);
      }
    }
  } catch (batchErr) {
    console.error("[Drive Sync Worker] Lỗi nghiêm trọng khi chạy batch đồng bộ:", batchErr);
  } finally {
    isSyncRunning = false;
  }

  return {
    processed: successCount + failedCount,
    success: successCount,
    failed: failedCount,
  };
};

/**
 * Khởi động tiến trình đồng bộ định kỳ
 * @param {number} [intervalMs=180000] - Mặc định mỗi 3 phút
 */
export const startDriveSyncCron = (intervalMs = 180000) => {
  console.log(`🚀 [Drive Sync Worker] Đã kích hoạt tiến trình đồng bộ định kỳ (${intervalMs / 1000}s/lần).`);
  // Chạy ngay 1 lần sau 10s server khởi động
  setTimeout(() => {
    runSyncBatch().catch(() => {});
  }, 10000);

  // Lặp lại định kỳ
  return setInterval(() => {
    runSyncBatch().catch(() => {});
  }, intervalMs);
};

export default {
  runSyncBatch,
  startDriveSyncCron,
};
