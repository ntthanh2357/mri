import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import { getLocalRoot } from "../../services/storage/localAdapter.js";
import { Visit } from "../../models/visit.model.js";
import { successResponse, errorResponse } from "../../utils/response.util.js";
import { inputErrorStatus } from "../../utils/inputError.util.js";
import {
  appendBatchToTriageSession,
  appendZipToTriageSession,
  cancelTriageSession,
  finalizeTriageSession,
  getTriagePreviewFile,
  initTriageSession,
  runTriageSessionAnalysis,
} from "./triageStaging.service.js";

const MAX_ZIP_BYTES = 600 * 1024 * 1024;
const MAX_BATCH_FILE_BYTES = 25 * 1024 * 1024;
const MAX_BATCH_FILES = 80;

const batchMulter = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: MAX_BATCH_FILES,
    fileSize: MAX_BATCH_FILE_BYTES,
    fieldSize: 5 * 1024 * 1024,
  },
}).array("files", MAX_BATCH_FILES);

const zipDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      const tmpDir = path.resolve(getLocalRoot(), "_triage_staging", "_tmp_zips");
      fs.mkdirSync(tmpDir, { recursive: true });
      cb(null, tmpDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (_req, _file, cb) => {
    cb(null, `${Date.now()}_${crypto.randomBytes(6).toString("hex")}.zip`);
  },
});

const zipMulter = multer({
  storage: zipDiskStorage,
  limits: { fileSize: MAX_ZIP_BYTES, files: 1 },
}).single("archive");

const wrapMulter = (middleware) => (req, res, next) => {
  middleware(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      const msg =
        err.code === "LIMIT_FILE_SIZE"
          ? "Tệp tải lên vượt quá giới hạn dung lượng cho phép."
          : err.code === "LIMIT_FILE_COUNT"
          ? `Mỗi lượt chỉ gửi tối đa ${MAX_BATCH_FILES} ảnh (hệ thống tự chia nhiều lượt).`
          : err.message;
      return errorResponse(res, msg, status);
    }
    return errorResponse(res, err.message || "Lỗi tải tệp sàng lọc.", 400);
  });
};

export const uploadTriageBatchMiddleware = wrapMulter(batchMulter);
export const uploadTriageZipMiddleware = wrapMulter(zipMulter);

const handleTriageError = (res, error, fallbackMsg) => {
  const status = error?.statusCode || inputErrorStatus(error, 500);
  if (status >= 500) {
    console.error("[triage.controller] Server error:", error);
  }
  return errorResponse(res, error?.message || fallbackMsg, status);
};

export const initTriage = async (req, res) => {
  try {
    const {
      visitId = null,
      patientId = null,
      protocolCode = null,
      withContrast = false,
      clientIgnoredCount = 0,
    } = req.body || {};

    let resolvedPatientId = patientId;
    let resolvedProtocol = protocolCode;
    let resolvedContrast = withContrast;

    if (visitId) {
      if (!/^[a-f\d]{24}$/i.test(String(visitId))) {
        return errorResponse(res, "Mã lượt khám (visitId) không hợp lệ.", 400);
      }
      const visit = await Visit.findOne({
        _id: visitId,
        hospitalId: req.user.hospitalId,
      })
        .select("patientId mriOrder")
        .setOptions({ bypassTenancy: true })
        .lean();

      if (!visit) {
        return errorResponse(res, "Không tìm thấy lượt khám trong cơ sở hiện tại.", 404);
      }
      if (!resolvedPatientId && visit.patientId) {
        resolvedPatientId = String(visit.patientId);
      }
      if (!resolvedProtocol && visit.mriOrder?.protocolCode) {
        resolvedProtocol = visit.mriOrder.protocolCode;
      }
      if (withContrast === undefined || withContrast === null) {
        resolvedContrast = Boolean(visit.mriOrder?.withContrast);
      }
    }

    const session = await initTriageSession({
      user: req.user,
      visitId,
      patientId: resolvedPatientId,
      protocolCode: resolvedProtocol,
      withContrast: Boolean(resolvedContrast),
      clientIgnoredCount,
    });

    return successResponse(res, session, "Khởi tạo phiên sàng lọc ảnh MRI thành công.", 201);
  } catch (error) {
    return handleTriageError(res, error, "Không thể khởi tạo phiên sàng lọc ảnh.");
  }
};

export const uploadTriageBatch = async (req, res) => {
  try {
    const { sessionId } = req.params;
    let relativePaths = [];
    if (req.body?.relativePaths) {
      if (Array.isArray(req.body.relativePaths)) {
        relativePaths = req.body.relativePaths;
      } else if (typeof req.body.relativePaths === "string") {
        try {
          const parsed = JSON.parse(req.body.relativePaths);
          if (Array.isArray(parsed)) relativePaths = parsed;
        } catch {
          return errorResponse(res, "relativePaths không đúng định dạng JSON.", 400);
        }
      }
    }

    const files = Array.isArray(req.files) ? req.files : [];
    const clientIgnoredCount = Number(req.body?.clientIgnoredCount || 0) || 0;
    if (files.length === 0 && clientIgnoredCount === 0) {
      return errorResponse(res, "Không có ảnh nào trong lượt gửi lên.", 400);
    }

    const result = await appendBatchToTriageSession({
      sessionId,
      user: req.user,
      files,
      relativePaths,
      clientIgnoredCount,
    });

    return successResponse(res, result, "Đã tiếp nhận lô ảnh MRI vào hàng đợi sàng lọc.");
  } catch (error) {
    return handleTriageError(res, error, "Lỗi nạp lô ảnh vào phiên sàng lọc.");
  }
};

export const uploadTriageZip = async (req, res) => {
  const tempPath = req.file?.path;
  try {
    const { sessionId } = req.params;
    if (!req.file || !tempPath) {
      return errorResponse(res, "Vui lòng chọn tệp nén .zip chứa ảnh MRI.", 400);
    }
    const ext = path.extname(req.file.originalname || "").toLowerCase();
    if (ext !== ".zip") {
      return errorResponse(res, "Chỉ hỗ trợ giải nén định dạng .zip.", 400);
    }

    const result = await appendZipToTriageSession({
      sessionId,
      user: req.user,
      zipFilePath: tempPath,
    });

    return successResponse(res, result, "Đã giải nén và lọc thô chuỗi ảnh từ tệp ZIP.");
  } catch (error) {
    return handleTriageError(res, error, "Không thể xử lý tệp ZIP.");
  } finally {
    if (tempPath) {
      fs.promises.unlink(tempPath).catch(() => {});
    }
  }
};

export const runTriage = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const {
      protocolCode = null,
      withContrast = null,
      topK = 10,
      candidateLimit = 120,
      geminiConflictLimit = 5,
    } = req.body || {};

    const result = await runTriageSessionAnalysis({
      sessionId,
      user: req.user,
      protocolCode,
      withContrast,
      topK,
      candidateLimit,
      geminiConflictLimit,
    });

    return successResponse(res, result, "Đã hoàn tất sàng lọc và xếp hạng các lát cắt rõ khối u nhất.");
  } catch (error) {
    return handleTriageError(res, error, "Không thể chạy AI sàng lọc hàng loạt.");
  }
};

export const previewTriageSlice = async (req, res) => {
  try {
    const { sessionId, sliceKey } = req.params;
    const { diskPath, mimeType } = await getTriagePreviewFile({
      sessionId,
      sliceKey,
      user: req.user || null,
      bypassOwnership: Boolean(req.signedFileAccess),
    });

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "private, max-age=300");
    return fs.createReadStream(diskPath).pipe(res);
  } catch (error) {
    return handleTriageError(res, error, "Không tải được ảnh xem trước.");
  }
};

export const finalizeTriage = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { selectedSliceKeys = [], primarySliceKey = null } = req.body || {};

    const result = await finalizeTriageSession({
      sessionId,
      user: req.user,
      selectedSliceKeys,
      primarySliceKey,
    });

    return successResponse(
      res,
      {
        ...result,
        images: result.rawImageUrls,
      },
      `Đã lưu mã hóa ${result.promotedCount} lát cắt vào PACS và dọn tệp tạm.`
    );
  } catch (error) {
    return handleTriageError(res, error, "Không thể xác nhận và lưu các lát cắt đã chọn.");
  }
};

export const cancelTriage = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await cancelTriageSession({ sessionId, user: req.user });
    return successResponse(res, result, "Đã hủy phiên sàng lọc và xóa dữ liệu tạm.");
  } catch (error) {
    return handleTriageError(res, error, "Không thể hủy phiên sàng lọc.");
  }
};

