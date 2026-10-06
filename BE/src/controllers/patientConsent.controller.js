import * as service from "../services/contrastConsent.service.js";
import { successResponse, errorResponse } from "../utils/response.util.js";

// UC-PAT-06 — bệnh nhân xem, trả lời sàng lọc và ký phiếu đồng thuận tiêm cản quang của chính mình.
// Mọi thao tác dùng req.user.id làm patientId; service tự lọc theo patientId.

const handle = (fn) => async (req, res, next) => {
  if (req.user?.role !== "patient") return errorResponse(res, "Chỉ bệnh nhân mới thao tác trên phiếu đồng thuận của mình.", 403);
  try {
    return await fn(req, res);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

// GET /api/v1/patient/consents
export const listMyConsents = handle(async (req, res) => {
  const [items, savedSignature] = await Promise.all([
    service.listPatientConsents(req.user.id),
    service.getSavedSignature(req.user.id),
  ]);
  return successResponse(res, { items, savedSignature });
});

// PUT /api/v1/patient/consents/:id/checklist
export const submitMyChecklist = handle(async (req, res) => {
  const consent = await service.submitPatientChecklist(req.user.id, req.params.id, req.body);
  return successResponse(res, consent, consent.isBlockedByChecklist
    ? "Đã ghi nhận. Bác sĩ cần xem xét thêm trước khi bạn ký phiếu."
    : "Đã ghi nhận câu trả lời sàng lọc.");
});

// PUT /api/v1/patient/consents/:id/sign  { agree, signature: { kind, svgPath | text }, saveSignature }
export const signMyConsent = handle(async (req, res) => {
  const consent = await service.signConsentAsPatient(req.user.id, req.params.id, req.body);
  return successResponse(res, consent, "Bạn đã ký phiếu đồng thuận.");
});
