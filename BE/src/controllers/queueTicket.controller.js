import * as service from "../services/queueTicket.service.js";
import { Hospital } from "../models/hospital.model.js";
import { successResponse, errorResponse } from "../utils/response.util.js";

// UC-PAT-03 — Lấy số tiếp đón online. Phân quyền role ở routes/queueTicket.routes.js.

const wrap = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

// Bệnh nhân lấy số ở bệnh viện gắn với tài khoản; chưa gắn thì chọn bệnh viện đang hoạt động
const patientHospitalId = async (req) => {
  if (req.user.hospitalId) return req.user.hospitalId;
  const chosen = req.body?.hospitalId || req.query?.hospitalId;
  if (!chosen) return null;
  const ok = await Hospital.exists({ _id: chosen, isActive: true, status: "active" });
  if (!ok) throw Object.assign(new Error("Bệnh viện không hợp lệ hoặc chưa hoạt động."), { status: 400 });
  return chosen;
};

// GET /api/v1/queue-tickets/hospitals — danh sách để bệnh nhân chưa gắn bệnh viện chọn
export const listHospitals = wrap(async (req, res) => {
  const hospitals = await Hospital.find({ isActive: true, status: "active" }).select("name nameShort address").sort({ name: 1 }).lean();
  return successResponse(res, { assignedHospitalId: req.user.hospitalId || null, hospitals });
});

// GET /api/v1/queue-tickets/me
export const getMine = wrap(async (req, res) => {
  const hospitalId = await patientHospitalId(req);
  if (!hospitalId) return successResponse(res, { ticket: null, needHospital: true });
  return successResponse(res, await service.getMyTicket(req.user.id, hospitalId));
});

// POST /api/v1/queue-tickets  { hospitalId? }
export const take = wrap(async (req, res) => {
  const hospitalId = await patientHospitalId(req);
  const ticket = await service.takeTicket(req.user.id, hospitalId);
  return successResponse(res, ticket, `Bạn đã lấy số ${ticket.number}.`);
});

// PUT /api/v1/queue-tickets/me/cancel
export const cancelMine = wrap(async (req, res) => {
  const hospitalId = await patientHospitalId(req);
  return successResponse(res, await service.cancelMyTicket(req.user.id, hospitalId), "Đã huỷ số.");
});

// ── Lễ tân / điều dưỡng (theo bệnh viện của tài khoản nhân viên) ─────────────

export const listToday = wrap(async (req, res) => successResponse(res, await service.listToday(req.user.hospitalId)));

export const callNext = wrap(async (req, res) => {
  const ticket = await service.callNext(req.user.hospitalId);
  return successResponse(res, ticket, `Mời số ${ticket.number}.`);
});

export const markArrived = wrap(async (req, res) =>
  successResponse(res, await service.markArrived(req.user.hospitalId, req.params.id), "Đã ghi nhận bệnh nhân có mặt."));

export const markMissed = wrap(async (req, res) =>
  successResponse(res, await service.markMissed(req.user.hospitalId, req.params.id), "Đã đánh dấu vắng, số vẫn được giữ."));

// GET/PUT /api/v1/queue-tickets/settings { avgServeMinutes }
export const getSettings = wrap(async (req, res) => successResponse(res, await service.getQueueSettings(req.user.hospitalId)));
export const updateSettings = wrap(async (req, res) =>
  successResponse(res, await service.saveQueueSettings(req.user.hospitalId, req.body), "Đã lưu số phút ước tính mỗi người."));

export const markServed = wrap(async (req, res) =>
  successResponse(res, await service.markServed(req.user.hospitalId, req.params.id), "Đã tiếp nhận."));
