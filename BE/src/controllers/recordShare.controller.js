import * as shareService from "../services/recordShare.service.js";
import { buildSharedRecord } from "../services/sharedRecord.service.js";
import { successResponse, errorResponse } from "../utils/response.util.js";

// UC-PAT-09 — Chia sẻ bệnh án qua QR. Phân quyền role ở routes.

const wrap = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

// ── Bệnh nhân (đăng nhập) ────────────────────────────────────────────────────

// POST /api/v1/patient/record-shares { sections? } — tạo mã QR (mở được trong 5 phút) cho các nhóm đã chọn
export const createMine = wrap(async (req, res) => {
  const { share, qrToken } = await shareService.createShare(req.user.id, req.user.hospitalId, new Date(), req.body?.sections);
  return successResponse(res, {
    shareId: share._id,
    qrToken,
    qrExpiresAt: share.qrExpiresAt,
    sections: share.sections,
    ttlSeconds: shareService.QR_TTL_MS / 1000,
  }, "Đã tạo mã QR chia sẻ bệnh án.");
});

// GET /api/v1/patient/record-shares — các lượt chia sẻ còn hiệu lực
export const listMine = wrap(async (req, res) => successResponse(res, await shareService.listShares(req.user.id)));

// DELETE /api/v1/patient/record-shares/:id — thu hồi
export const revokeMine = wrap(async (req, res) => {
  await shareService.revokeShare(req.user.id, req.params.id);
  return successResponse(res, null, "Đã dừng chia sẻ. Người đã quét mã sẽ không xem được nữa.");
});

// ── Người xem (công khai, không đăng nhập) ──────────────────────────────────

// POST /api/v1/shared-records/redeem { qrToken } — quét QR trong 5 phút → nhận vé xem
export const redeem = wrap(async (req, res) => {
  const qrToken = String(req.body?.qrToken || "");
  if (!qrToken) return errorResponse(res, "Thiếu mã QR.", 400);
  const { viewerToken } = await shareService.redeemQr(qrToken, { userAgent: req.headers["user-agent"] || "" });
  return successResponse(res, { viewerToken });
});

// POST /api/v1/shared-records/view { viewerToken } — xem bệnh án (vé không hết hạn, trừ khi bị thu hồi)
export const view = wrap(async (req, res) => {
  const viewerToken = String(req.body?.viewerToken || "");
  if (!viewerToken) return errorResponse(res, "Thiếu mã xem.", 400);
  const { patientId, sections, shareId } = await shareService.resolveViewer(viewerToken);
  res.set("Cache-Control", "no-store");
  return successResponse(res, await buildSharedRecord(patientId, sections, { shareId }));
});
