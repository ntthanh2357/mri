import * as service from "../services/patientRecord.service.js";
import { successResponse, errorResponse } from "../utils/response.util.js";

const getTargetPatientId = (req) => {
  if (req.user && req.user.role !== 'patient') {
    return req.query.patientId || req.body.patientId || req.user.id;
  }
  return req.user ? req.user.id : null;
};

// ── Identity ──────────────────────────────────────────────────────────────────

export const getIdentity = async (req, res, next) => {
  try {
    const profile = await service.getOrCreateProfile(getTargetPatientId(req));
    return successResponse(res, profile);
  } catch (err) {
    next(err);
  }
};

export const updateIdentity = async (req, res, next) => {
  try {
    const profile = await service.updateProfile(getTargetPatientId(req), req.body);
    return successResponse(res, profile, "Cập nhật thông tin thành công.");
  } catch (err) {
    next(err);
  }
};

// ── Visits ────────────────────────────────────────────────────────────────────

export const listVisits = async (req, res, next) => {
  try {
    const visits = await service.listVisits(getTargetPatientId(req));
    return successResponse(res, visits);
  } catch (err) {
    next(err);
  }
};

export const createVisit = async (req, res, next) => {
  try {
    const { facility, visitType } = req.body;
    if (!facility || !visitType) {
      return errorResponse(res, "Thiếu trường bắt buộc: facility, visitType.", 400);
    }
    const visit = await service.createVisit(getTargetPatientId(req), req.body);
    return successResponse(res, visit, "Đã tạo lượt khám.", 201);
  } catch (err) {
    next(err);
  }
};

export const getVisit = async (req, res, next) => {
  try {
    const visit = await service.getVisit(getTargetPatientId(req), req.params.visitId);
    return successResponse(res, visit);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const updateVisit = async (req, res, next) => {
  try {
    const visit = await service.updateVisit(getTargetPatientId(req), req.params.visitId, req.body);
    return successResponse(res, visit, "Đã cập nhật lượt khám.");
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const deleteVisit = async (req, res, next) => {
  try {
    await service.deleteVisit(getTargetPatientId(req), req.params.visitId);
    return successResponse(res, null, "Đã xóa lượt khám.");
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

// ── Documents ─────────────────────────────────────────────────────────────────

export const uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) return errorResponse(res, "Không có file được tải lên.", 400);

    const { docKey, groupKey, label } = req.body;
    if (!docKey || !groupKey || !label) {
      return errorResponse(res, "Thiếu trường: docKey, groupKey, label.", 400);
    }

    const visit = await service.addDocumentUpload(getTargetPatientId(req), req.params.visitId, {
      docKey,
      groupKey,
      label,
      fileBuffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
    });
    return successResponse(res, visit, "Tải lên tài liệu thành công.", 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    if (err.message?.includes("GCS")) return errorResponse(res, err.message, 503);
    next(err);
  }
};

export const saveManualDocument = async (req, res, next) => {
  try {
    const { docKey, groupKey, label, manualData } = req.body;
    if (!docKey || !groupKey || !label || !manualData) {
      return errorResponse(res, "Thiếu trường: docKey, groupKey, label, manualData.", 400);
    }

    const visit = await service.addDocumentManual(getTargetPatientId(req), req.params.visitId, {
      docKey,
      groupKey,
      label,
      manualData,
    });
    return successResponse(res, visit, "Đã lưu tài liệu điền tay.", 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const deleteDocument = async (req, res, next) => {
  try {
    const visit = await service.deleteDocument(
      getTargetPatientId(req),
      req.params.visitId,
      req.params.docId
    );
    return successResponse(res, visit, "Đã xóa tài liệu.");
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};
