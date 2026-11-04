import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import StoredMedicalFile from "../models/storedMedicalFile.model.js";
import storageService from "../services/storage/storageService.js";
import {
  getLocalRoot,
  ensureDirectory,
  existsOnLocal,
  deleteLocalFile,
} from "../services/storage/localAdapter.js";
import {
  resolveDriveFolderPath,
  setCustomFolderCreatorForTest,
  clearDriveFolderCache,
} from "../services/storage/driveMirrorAdapter.js";
import {
  configurePacsQueues,
  enqueueAiTask,
  getPacsQueueStatus,
} from "../services/storage/pacsQueue.service.js";
import {
  computeSha256,
  computeFileSha256Stream,
} from "../utils/cryptoStorage.util.js";
import {
  initChunkedUpload,
  uploadChunkPart,
  completeChunkedUpload,
} from "../modules/storage/storage.controller.js";

const makeRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe("Tối ưu Lưu trữ Cục bộ (Stream/Chunked/Dedup) & Hàng đợi Google Drive / AI (PACS Concurrent Storage Suite)", () => {
  const tempFilesToClean = [];
  const createdFileIds = [];

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017/neuroscan_test_logic"
      );
    }
    process.env.DRIVE_ROOT_FOLDER_ID = "TEST_ROOT_FOLDER_ID";
  });

  afterAll(async () => {
    setCustomFolderCreatorForTest(null);
    configurePacsQueues({ customDriveUploader: undefined });
    clearDriveFolderCache();

    for (const fPath of tempFilesToClean) {
      try {
        if (existsOnLocal(fPath)) await deleteLocalFile(fPath);
      } catch {
        // ignore
      }
    }
    for (const fileId of createdFileIds) {
      try {
        await storageService.delete(fileId);
      } catch {
        // ignore
      }
    }
  });

  it("1. Stream SHA-256 & putFromPath (Zero-RAM-Spike): Băm tệp bằng Stream khớp 100% và lưu trực tiếp từ đĩa", async () => {
    const root = getLocalRoot();
    const tempDir = path.join(root, "ai-temp", "stream_test");
    ensureDirectory(tempDir);

    const sourceFilePath = path.join(tempDir, `mri_slice_${Date.now()}.bin`);
    const samplePayload = crypto.randomBytes(256 * 1024); // 256KB binary slice
    await fs.promises.writeFile(sourceFilePath, samplePayload);
    tempFilesToClean.push(sourceFilePath);

    const expectedSha = computeSha256(samplePayload);
    const streamed = await computeFileSha256Stream(sourceFilePath);

    expect(streamed.sha256).toBe(expectedSha);
    expect(streamed.sizeBytes).toBe(samplePayload.length);

    // Lưu vào kho PACS qua putFromPath mà không đọc ngược toàn bộ tệp vào RAM
    const saved = await storageService.putFromPath({
      category: "pacs",
      studyId: `STREAM_${Date.now()}`,
      sequenceName: "T2_FLAIR",
      fileName: "slice_001.dcm",
      sourceFilePath,
      moveFile: true,
      syncToDrive: false,
    });
    createdFileIds.push(saved.fileId);

    expect(saved.sha256).toBe(expectedSha);
    expect(saved.sizeBytes).toBe(samplePayload.length);
    expect(existsOnLocal(saved.localPath)).toBe(true);
    // Tệp nguồn tạm đã được move sang kho PACS nên không còn ở thư mục tạm
    expect(existsOnLocal(sourceFilePath)).toBe(false);
  });

  it("2. Chống lưu trùng SHA-256 (Local & Cloud Deduplication): 5 ca tải cùng 1 tệp chỉ ghi 1 bản vật lý và kế thừa ngay driveFileId", async () => {
    let driveUploadCallCount = 0;
    configurePacsQueues({
      drive: { maxConcurrency: 2, rateLimitDelayMs: 5, baseRetryDelayMs: 20, maxRetries: 2 },
      customDriveUploader: async (_encBuf, relativeDir, fileName) => {
        driveUploadCallCount++;
        await sleep(15);
        return {
          driveFileId: `DRIVE_FILE_${driveUploadCallCount}_${fileName}`,
          driveFolderId: `DRIVE_FOLDER_${relativeDir}`,
          md5Checksum: "mock_md5",
          size: 1024,
        };
      },
    });

    const uniquePayload = Buffer.from(`DICOM_UNIQUE_PAYLOAD_${Date.now()}_${Math.random()}`);

    // Lần 1: Tải tệp gốc và chờ đồng bộ lên Google Drive hoàn tất
    const firstRecord = await storageService.put({
      category: "pacs",
      studyId: "DEDUP_STUDY_1",
      fileName: "t1c_slice_01.jpg",
      buffer: uniquePayload,
      mimeType: "image/jpeg",
      syncToDrive: true,
    });
    createdFileIds.push(firstRecord.fileId);

    // Chờ DriveSyncQueue xử lý xong bản đầu tiên
    for (let i = 0; i < 30; i++) {
      const check = await StoredMedicalFile.findById(firstRecord._id).lean();
      if (check?.syncStatus === "SYNCED") break;
      await sleep(20);
    }

    const syncedFirst = await StoredMedicalFile.findById(firstRecord._id).lean();
    expect(syncedFirst.syncStatus).toBe("SYNCED");
    expect(driveUploadCallCount).toBe(1);

    // Lần 2..5: 4 KTV khác tải lên đúng tệp đó cùng một lúc
    const duplicateUploads = await Promise.all(
      [2, 3, 4, 5].map((idx) =>
        storageService.put({
          category: "pacs",
          studyId: `DEDUP_STUDY_${idx}`,
          fileName: `t1c_slice_dup_${idx}.jpg`,
          buffer: uniquePayload,
          mimeType: "image/jpeg",
          syncToDrive: true,
        })
      )
    );
    duplicateUploads.forEach((r) => createdFileIds.push(r.fileId));

    // Cả 4 bản ghi sau phải trỏ tới CÙNG 1 localPath vật lý và kế thừa luôn trạng thái SYNCED + driveFileId mà KHÔNG gọi thêm Google Drive API!
    for (const dup of duplicateUploads) {
      expect(dup.localPath).toBe(syncedFirst.localPath);
      expect(dup.syncStatus).toBe("SYNCED");
      expect(dup.driveFileId).toBe(syncedFirst.driveFileId);
    }
    expect(driveUploadCallCount).toBe(1);
  });

  it("3. Native Chunked Upload (Băm nhỏ file -> Tải lên đảo thứ tự -> Ghép Stream -> Kiểm định SHA-256 & Instant Dedup)", async () => {
    configurePacsQueues({
      customDriveUploader: async () => ({
        driveFileId: `DRIVE_CHUNKED_${Date.now()}`,
        driveFolderId: "FOLDER_CHUNKED",
        md5Checksum: "md5",
        size: 4096,
      }),
    });

    const part0 = Buffer.from("PART_0_HEADER_DICOM_128_BYTES_".repeat(20));
    const part1 = Buffer.from("PART_1_T2_FLAIR_SLICE_DATA_".repeat(25));
    const part2 = Buffer.from("PART_2_T1C_CONTRAST_DATA_".repeat(25));
    const part3 = Buffer.from("PART_3_FOOTER_CHECKSUM_END_".repeat(15));
    const fullBuffer = Buffer.concat([part0, part1, part2, part3]);
    const fullSha256 = computeSha256(fullBuffer);

    const mockUser = { id: new mongoose.Types.ObjectId().toString(), role: "technician" };

    // Bước 1: Init phiên tải lên phân mảnh (4 mảnh)
    const initRes = makeRes();
    await initChunkedUpload(
      {
        user: mockUser,
        body: {
          fileName: "brain_mri_study_archive.zip",
          totalChunks: 4,
          totalSizeBytes: fullBuffer.length,
          mimeType: "application/zip",
          category: "pacs",
          studyId: `CHUNK_STUDY_${Date.now()}`,
          expectedSha256: fullSha256,
        },
      },
      initRes
    );

    expect(initRes.statusCode).toBe(201);
    expect(initRes.body.instantDedup).toBe(false);
    const { uploadSessionId } = initRes.body.data;
    expect(uploadSessionId).toBeDefined();

    // Bước 2: Đẩy 4 mảnh lên theo thứ tự NGẪU NHIÊN (2 -> 0 -> 3 -> 1) như mạng thực tế
    const parts = [
      { idx: 2, buf: part2 },
      { idx: 0, buf: part0 },
      { idx: 3, buf: part3 },
      { idx: 1, buf: part1 },
    ];

    for (const p of parts) {
      const partRes = makeRes();
      await uploadChunkPart(
        {
          user: mockUser,
          body: {
            uploadSessionId,
            chunkIndex: p.idx,
            chunkBase64: p.buf.toString("base64"),
          },
        },
        partRes
      );
      expect(partRes.statusCode).toBe(200);
    }

    // Bước 3: Complete -> Ghép Stream và đối soát SHA-256
    const compRes = makeRes();
    await completeChunkedUpload(
      {
        user: mockUser,
        body: {
          uploadSessionId,
          expectedSha256: fullSha256,
        },
      },
      compRes
    );

    expect(compRes.statusCode).toBe(201);
    expect(compRes.body.data.sha256).toBe(fullSha256);
    expect(compRes.body.data.sizeBytes).toBe(fullBuffer.length);
    createdFileIds.push(compRes.body.data.fileId);

    // Bước 4: Gọi lại Init với cùng mã băm expectedSha256 -> Phải kích hoạt Instant Dedup ngay lập tức!
    const dedupInitRes = makeRes();
    await initChunkedUpload(
      {
        user: mockUser,
        body: {
          fileName: "brain_mri_study_archive_copy.zip",
          totalChunks: 4,
          totalSizeBytes: fullBuffer.length,
          mimeType: "application/zip",
          category: "pacs",
          studyId: `CHUNK_STUDY_COPY_${Date.now()}`,
          expectedSha256: fullSha256,
        },
      },
      dedupInitRes
    );

    expect(dedupInitRes.statusCode).toBe(200);
    expect(dedupInitRes.body.instantDedup).toBe(true);
    expect(dedupInitRes.body.data.sha256).toBe(fullSha256);
    createdFileIds.push(dedupInitRes.body.data.fileId);
  });

  it("4. In-Flight Folder Mutex Lock & DriveSyncQueue Retry: 15 luồng đồng thời không tạo trùng thư mục & tự động Retry khi gặp lỗi 429 Rate Limit", async () => {
    clearDriveFolderCache();
    const folderCreationCalls = [];

    setCustomFolderCreatorForTest(async (folderName, parentId) => {
      folderCreationCalls.push(`${parentId}/${folderName}`);
      await sleep(25); // Giả lập độ trễ mạng Google Drive API 25ms
      return `FOLDER_ID_${folderName}`;
    });

    // Bắn đồng loạt 15 luồng cùng yêu cầu đường dẫn "pacs/2026/11/study_CONCURRENT_999" tại cùng 1 mili-giây
    const concurrentPaths = await Promise.all(
      Array.from({ length: 15 }, () => resolveDriveFolderPath("pacs/2026/11/study_CONCURRENT_999"))
    );

    // Tất cả 15 luồng phải nhận về cùng 1 Folder ID đích
    for (const folderId of concurrentPaths) {
      expect(folderId).toBe("FOLDER_ID_study_CONCURRENT_999");
    }
    // Nhờ In-Flight Mutex Lock, mỗi cấp thư mục (pacs, 2026, 11, study_CONCURRENT_999) chỉ được tạo ĐÚNG 1 LẦN (tổng 4 lần gọi thay vì 15 * 4 = 60 lần!)
    expect(folderCreationCalls.length).toBe(4);

    // Kiểm tra cơ chế Tự động Retry (Exponential Backoff) khi Google Drive trả lỗi 429 Too Many Requests
    let attemptCounter = 0;
    configurePacsQueues({
      drive: { maxConcurrency: 2, rateLimitDelayMs: 5, baseRetryDelayMs: 25, maxRetries: 3 },
      customDriveUploader: async () => {
        attemptCounter++;
        if (attemptCounter === 1) {
          const rateErr = new Error("429 Too Many Requests: User Rate Limit Exceeded");
          rateErr.code = 429;
          throw rateErr;
        }
        return {
          driveFileId: "DRIVE_RECOVERED_AFTER_429",
          driveFolderId: "FOLDER_RECOVERED",
          md5Checksum: "md5_ok",
          size: 512,
        };
      },
    });

    const retryFile = await storageService.put({
      category: "pacs",
      studyId: "RETRY_429_STUDY",
      fileName: "slice_retry_429.png",
      buffer: Buffer.from(`UNIQUE_RETRY_429_DATA_${Date.now()}`),
      mimeType: "image/png",
      syncToDrive: true,
    });
    createdFileIds.push(retryFile.fileId);

    // Chờ hàng đợi thực hiện Retry lần 2 và thành công
    for (let i = 0; i < 40; i++) {
      const check = await StoredMedicalFile.findById(retryFile._id).lean();
      if (check?.syncStatus === "SYNCED") break;
      await sleep(25);
    }

    const updatedRetryFile = await StoredMedicalFile.findById(retryFile._id).lean();
    expect(updatedRetryFile.syncStatus).toBe("SYNCED");
    expect(updatedRetryFile.driveFileId).toBe("DRIVE_RECOVERED_AFTER_429");
    expect(attemptCounter).toBe(2);
  });

  it("5. Hàng đợi Ưu tiên AI (Priority AI Queue): Ca Cấp cứu (priority=1) tự động nhảy lên chạy trước các ca khám thường (priority=5)", async () => {
    configurePacsQueues({
      ai: { maxConcurrency: 1 }, // Đặt 1 worker để kiểm chứng rõ thứ tự ưu tiên xếp hàng
    });

    const executionOrder = [];

    // Ca 1 vào trước và chạy ngay lập tức
    const p1 = enqueueAiTask({
      priority: 5,
      visitId: "VISIT_ROUTINE_1",
      label: "Ca thường 1 (Đang chạy)",
      taskFn: async () => {
        await sleep(50);
        executionOrder.push("ROUTINE_1");
        return "ok1";
      },
    });

    // Chờ 5ms để Ca 1 chiếm slot Worker duy nhất
    await sleep(5);

    // Trong lúc Ca 1 đang chạy, đẩy tiếp 2 ca thường (priority = 5) và 1 ca CẤP CỨU (priority = 1) vào hàng đợi
    const p2 = enqueueAiTask({
      priority: 5,
      visitId: "VISIT_ROUTINE_2",
      label: "Ca thường 2",
      taskFn: async () => {
        await sleep(10);
        executionOrder.push("ROUTINE_2");
        return "ok2";
      },
    });

    const p3 = enqueueAiTask({
      priority: 5,
      visitId: "VISIT_ROUTINE_3",
      label: "Ca thường 3",
      taskFn: async () => {
        await sleep(10);
        executionOrder.push("ROUTINE_3");
        return "ok3";
      },
    });

    const pEmergency = enqueueAiTask({
      priority: 1, // Cấp cứu thoát vị não!
      visitId: "VISIT_EMERGENCY_STAT",
      label: "Ca CẤP CỨU Thoát vị não",
      taskFn: async () => {
        await sleep(10);
        executionOrder.push("EMERGENCY_STAT");
        return "ok_stat";
      },
    });

    await Promise.all([p1, p2, p3, pEmergency]);

    // Kết quả bắt buộc: Sau khi ROUTINE_1 xong, EMERGENCY_STAT (priority=1) phải chạy ngay thứ 2, trước cả ROUTINE_2 và ROUTINE_3!
    expect(executionOrder[0]).toBe("ROUTINE_1");
    expect(executionOrder[1]).toBe("EMERGENCY_STAT");
    expect(executionOrder[2]).toBe("ROUTINE_2");
    expect(executionOrder[3]).toBe("ROUTINE_3");

    const status = getPacsQueueStatus();
    expect(status.aiQueue.pendingCount).toBe(0);
    expect(status.memoryUsageMb.heapUsed).toBeGreaterThan(0);

    // Khôi phục maxConcurrency = 2 mặc định
    configurePacsQueues({ ai: { maxConcurrency: 2 } });
  });
});
