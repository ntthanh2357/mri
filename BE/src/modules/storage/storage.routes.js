import { Router } from "express";
import { protect, checkRole } from "../../middlewares/auth.middleware.js";
import {
  streamStoredFile,
  getStoredFileMetadata,
  initChunkedUpload,
  uploadChunkPart,
  completeChunkedUpload,
  getStorageAndAiQueueStatus,
} from "./storage.controller.js";

const router = Router();

// Toàn bộ route yêu cầu xác thực JWT
router.use(protect);

// Quan sát trạng thái Hàng đợi Đồng bộ Drive & Hàng đợi AI
router.get("/queue-status", getStorageAndAiQueueStatus);

// API Băm nhỏ tệp tin (Native Chunked Upload - Zero-RAM-Spike)
router.post(
  "/chunked/init",
  checkRole(["technician", "doctor", "radiologist", "department_head", "admin", "hospital_admin"]),
  initChunkedUpload
);
router.post(
  "/chunked/part",
  checkRole(["technician", "doctor", "radiologist", "department_head", "admin", "hospital_admin"]),
  uploadChunkPart
);
router.post(
  "/chunked/complete",
  checkRole(["technician", "doctor", "radiologist", "department_head", "admin", "hospital_admin"]),
  completeChunkedUpload
);

// Stream và lấy Metadata tệp y tế
router.get("/files/:fileId", streamStoredFile);
router.get("/files/:fileId/metadata", getStoredFileMetadata);

export default router;
