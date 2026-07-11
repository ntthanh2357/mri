import * as service from "../services/patientRecord.service.js";
import { User } from "../models/user.model.js";
import { successResponse, errorResponse } from "../utils/response.util.js";

const getTargetPatientId = async (req) => {
  if (req.user && req.user.role !== 'patient') {
    const patientId = req.query.patientId || req.body.patientId || req.user.id;
    if (patientId !== req.user.id) {
      const patient = await User.findById(patientId);
      if (!patient || (patient.hospitalId && patient.hospitalId.toString() !== req.user.hospitalId.toString())) {
        throw { status: 403, message: "Không tìm thấy bệnh nhân hoặc không có quyền truy cập." };
      }
    }
    return patientId;
  }
  return req.user ? req.user.id : null;
};

// ── Identity ──────────────────────────────────────────────────────────────────

export const getIdentity = async (req, res, next) => {
  try {
    const targetId = await getTargetPatientId(req);
    const profile = await service.getOrCreateProfile(targetId);
    return successResponse(res, profile);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const updateIdentity = async (req, res, next) => {
  try {
    const targetId = await getTargetPatientId(req);
    const profile = await service.updateProfile(targetId, req.body);
    return successResponse(res, profile, "Cập nhật thông tin thành công.");
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

// ── Visits ────────────────────────────────────────────────────────────────────

export const listVisits = async (req, res, next) => {
  try {
    const targetId = await getTargetPatientId(req);
    const visits = await service.listVisits(targetId);
    return successResponse(res, visits);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const createVisit = async (req, res, next) => {
  try {
    const { facility, visitType } = req.body;
    if (!facility || !visitType) {
      return errorResponse(res, "Thiếu trường bắt buộc: facility, visitType.", 400);
    }
    const targetId = await getTargetPatientId(req);
    const visit = await service.createVisit(targetId, req.body);
    return successResponse(res, visit, "Đã tạo lượt khám.", 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const getVisit = async (req, res, next) => {
  try {
    const targetId = await getTargetPatientId(req);
    const visit = await service.getVisit(targetId, req.params.visitId);
    return successResponse(res, visit);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const updateVisit = async (req, res, next) => {
  try {
    const targetId = await getTargetPatientId(req);
    const visit = await service.updateVisit(targetId, req.params.visitId, req.body);
    return successResponse(res, visit, "Đã cập nhật lượt khám.");
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const deleteVisit = async (req, res, next) => {
  try {
    const targetId = await getTargetPatientId(req);
    await service.deleteVisit(targetId, req.params.visitId);
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

    const targetId = await getTargetPatientId(req);
    const visit = await service.addDocumentUpload(targetId, req.params.visitId, {
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

    const targetId = await getTargetPatientId(req);
    const visit = await service.addDocumentManual(targetId, req.params.visitId, {
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
    const targetId = await getTargetPatientId(req);
    const visit = await service.deleteDocument(
      targetId,
      req.params.visitId,
      req.params.docId
    );
    return successResponse(res, visit, "Đã xóa tài liệu.");
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};
