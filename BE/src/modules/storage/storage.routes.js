import { Router } from "express";
import { protect } from "../../middlewares/auth.middleware.js";
import { streamStoredFile, getStoredFileMetadata } from "./storage.controller.js";

const router = Router();

// Toàn bộ route yêu cầu xác thực JWT
router.use(protect);

router.get("/files/:fileId", streamStoredFile);
router.get("/files/:fileId/metadata", getStoredFileMetadata);

export default router;
