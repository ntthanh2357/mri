import * as copyService from "../services/recordCopy.service.js";
import { successResponse, errorResponse } from "../utils/response.util.js";

// Xin bản sao bệnh án. Phân quyền role ở routes; quyền trên từng yêu cầu (đúng bệnh nhân / đúng bệnh viện) ở service.

const wrap = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    return next(err);
  }
};

// ── Bệnh nhân: /api/v1/patient/record-copies ──
// POST { sections: [...], reason? }
export const createMine = wrap(async (req, res) =>
  successResponse(res, await copyService.createCopyRequest(req.user.id, { sections: req.body?.sections, reason: req.body?.reason }), "Đã gửi yêu cầu. Bệnh viện sẽ xem xét và báo cho bạn.", 201));

export const listMine = wrap(async (req, res) => successResponse(res, await copyService.listMyCopyRequests(req.user.id)));

// PUT /:id/cancel
export const cancelMine = wrap(async (req, res) =>
  successResponse(res, await copyService.cancelMyCopyRequest(req.user.id, req.params.id), "Đã huỷ yêu cầu."));

// POST /:id/download → link tải PDF sống 10 phút (không đưa token đăng nhập vào URL)
export const downloadMine = wrap(async (req, res) => {
  const token = await copyService.createCopyDownloadToken(req.user.id, req.params.id);
  return successResponse(res, { pdfPath: `/api/v1/record-copies/file/${token}` });
});

// ── Bệnh viện: /api/v1/record-copies ──
// GET ?status=pending|approved|rejected|cancelled
export const listForHospital = wrap(async (req, res) =>
  successResponse(res, await copyService.listCopyRequestsForHospital(req.user.hospitalId, { status: req.query.status })));

const reviewerOf = (req) => ({ id: req.user.id, hospitalId: req.user.hospitalId, role: req.user.role });

export const approve = wrap(async (req, res) =>
  successResponse(res, await copyService.approveCopyRequest(reviewerOf(req), req.params.id), "Đã duyệt. Bệnh nhân tải được bản sao trong ứng dụng."));

// PUT /:id/reject { reason }
export const reject = wrap(async (req, res) =>
  successResponse(res, await copyService.rejectCopyRequest(reviewerOf(req), req.params.id, req.body?.reason), "Đã từ chối yêu cầu."));

// GET /file/:token — công khai theo token ngắn hạn do downloadMine cấp
export const streamFile = async (req, res, next) => {
  try {
    const { request, pdf } = await copyService.loadCopyForDownload(req.params.token); // PDF đã ký sẵn lúc duyệt
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="ban-sao-benh-an-${request._id}.pdf"`);
    res.setHeader("Cache-Control", "no-store");
    return res.send(pdf);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    console.error("[record-copy] Lỗi tạo PDF:", err);
    return next(err);
  }
};
