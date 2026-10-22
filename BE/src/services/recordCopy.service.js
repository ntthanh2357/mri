import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { RecordCopyRequest } from "../models/recordCopyRequest.model.js";
import { User } from "../models/user.model.js";
import { Hospital } from "../models/hospital.model.js";
import { getJwtSecret } from "../config/jwt.config.js";
import { buildSharedRecord } from "./sharedRecord.service.js";
import { createNotificationInternal } from "../controllers/notification.controller.js";
import { buildRecordCopyPdf, oneLine } from "./recordCopyPdf.service.js";
import { getPdfSigner } from "./pdfSignature.service.js";

/**
 * Xin bản sao bệnh án: bệnh nhân gửi yêu cầu → lễ tân / quản lý bệnh viện duyệt hoặc từ chối → bệnh nhân tải PDF có ký số.
 * Nội dung bản sao dùng đúng bộ lọc của bệnh án chia sẻ QR (không CCCD/BHYT, không ghi chú tâm thần/HIV/di truyền)
 * và chỉ gồm dữ liệu của bệnh viện duyệt. Mọi truy vấn lọc tường minh theo bệnh nhân / bệnh viện (bỏ qua tenancy).
 */

const BYPASS = { bypassTenancy: true };
const httpError = (status, message) => Object.assign(new Error(message), { status });

/** Nhóm bệnh viện cấp bản sao được (không gồm dị ứng tự khai và giấy tờ bệnh nhân tự quét: đó không phải hồ sơ của bệnh viện). */
export const COPY_SECTIONS = ["visits", "imaging", "prescriptions", "labs", "vitals", "inpatient", "papers"];
export const MAX_PENDING = 3;
export const MAX_PER_DAY = 10; // kể cả yêu cầu đã huỷ: chặn vòng gửi - huỷ làm ngập danh sách của bệnh viện
export const MAX_REASON = 500;
const LIST_LIMIT = 50;
const startOfVnDay = (now = new Date()) => new Date(Date.UTC(...new Date(now.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10).split("-").map((n, i) => (i === 1 ? n - 1 : +n))) - 7 * 3600 * 1000);

const isId = (v) => mongoose.isValidObjectId(v) && String(new mongoose.Types.ObjectId(String(v))) === String(v);
const notFound = () => httpError(404, "Không tìm thấy yêu cầu bản sao.");

const cleanSections = (raw) => {
  if (!Array.isArray(raw) || !raw.length || raw.length > 20 || !raw.every((s) => typeof s === "string" && COPY_SECTIONS.includes(s))) {
    throw httpError(400, "Hãy chọn ít nhất 1 phần bệnh án cần sao.");
  }
  return COPY_SECTIONS.filter((s) => raw.includes(s));
};

const cleanText = (raw, { required = false, field = "Lý do" } = {}) => {
  if (raw === undefined || raw === null) raw = "";
  if (typeof raw !== "string") throw httpError(400, `${field} không hợp lệ.`);
  const text = raw.trim();
  if (text.length > MAX_REASON) throw httpError(400, `${field} tối đa ${MAX_REASON} ký tự.`);
  if (required && !text) throw httpError(400, `Hãy ghi ${field.toLowerCase()}.`);
  return text;
};

/** Phần bệnh nhân được xem về yêu cầu của mình (không có bản chụp bệnh án, không có mã nội bộ). */
const toPatientView = (r) => ({
  _id: r._id,
  sections: r.sections,
  reason: r.reason,
  status: r.status,
  createdAt: r.createdAt,
  reviewedAt: r.reviewedAt,
  reviewedByName: r.status === "approved" || r.status === "rejected" ? r.reviewedByName : "",
  rejectReason: r.status === "rejected" ? r.rejectReason : "",
});

// ── Bệnh nhân ───────────────────────────────────────────────────────────────

export const createCopyRequest = async (patientId, { sections, reason } = {}) => {
  const chosen = cleanSections(sections);
  const why = cleanText(reason);
  const user = await User.findById(patientId).select("hospitalId role profile.name").setOptions(BYPASS).lean();
  if (!user?.hospitalId) throw httpError(409, "Tài khoản của bạn chưa gắn với bệnh viện nào nên chưa gửi được yêu cầu. Hãy hỏi quầy tiếp đón.");
  const tooManyPending = () => httpError(429, `Bạn đang có ${MAX_PENDING} yêu cầu chờ duyệt. Hãy đợi bệnh viện xử lý hoặc huỷ bớt yêu cầu.`);
  if ((await RecordCopyRequest.countDocuments({ patientId, status: "pending" }).setOptions(BYPASS)) >= MAX_PENDING) throw tooManyPending();
  if ((await RecordCopyRequest.countDocuments({ patientId, createdAt: { $gte: startOfVnDay() } }).setOptions(BYPASS)) >= MAX_PER_DAY) {
    throw httpError(429, `Hôm nay bạn đã gửi ${MAX_PER_DAY} yêu cầu. Vui lòng gửi lại vào ngày mai.`);
  }
  const doc = await RecordCopyRequest.create({
    patientId, hospitalId: user.hospitalId, sections: chosen, reason: why, patientName: oneLine(user.profile?.name || "Bệnh nhân", 100),
  });
  // nhiều yêu cầu gửi cùng lúc có thể cùng lọt qua bước đếm → đếm lại sau khi tạo
  if ((await RecordCopyRequest.countDocuments({ patientId, status: "pending" }).setOptions(BYPASS)) > MAX_PENDING) {
    await RecordCopyRequest.deleteOne({ _id: doc._id }).setOptions(BYPASS);
    throw tooManyPending();
  }
  return toPatientView(doc.toObject());
};

export const listMyCopyRequests = async (patientId) =>
  (await RecordCopyRequest.find({ patientId }).select("-snapshot").sort({ createdAt: -1 }).limit(LIST_LIMIT).setOptions(BYPASS).lean()).map(toPatientView);

export const cancelMyCopyRequest = async (patientId, id) => {
  if (!isId(id)) throw notFound();
  const updated = await RecordCopyRequest.findOneAndUpdate(
    { _id: id, patientId, status: "pending" },
    { $set: { status: "cancelled", cancelledAt: new Date() } },
    { new: true, lean: true },
  ).setOptions(BYPASS);
  if (updated) return toPatientView(updated);
  if (await RecordCopyRequest.exists({ _id: id, patientId }).setOptions(BYPASS)) throw httpError(409, "Yêu cầu này đã được xử lý, không huỷ được nữa.");
  throw notFound();
};

// ── Bệnh viện ───────────────────────────────────────────────────────────────

export const listCopyRequestsForHospital = async (hospitalId, { status } = {}) => {
  if (!hospitalId) return [];
  const filter = { hospitalId };
  if (typeof status === "string" && ["pending", "approved", "rejected", "cancelled"].includes(status)) filter.status = status;
  const rows = await RecordCopyRequest.find(filter).select("-snapshot").sort({ createdAt: -1 }).limit(100)
    .populate({ path: "patientId", select: "profile.name profile.medicalId email", options: BYPASS })
    .setOptions(BYPASS).lean();
  return rows.map((r) => ({
    _id: r._id,
    sections: r.sections,
    reason: r.reason,
    status: r.status,
    createdAt: r.createdAt,
    reviewedAt: r.reviewedAt,
    reviewedByName: r.reviewedByName,
    rejectReason: r.rejectReason,
    // tên lúc gửi (chính tên sẽ in trên bản sao), không phải tên hiện tại bệnh nhân có thể đã đổi
    patient: { name: r.patientName || r.patientId?.profile?.name || "Bệnh nhân", medicalId: r.patientId?.profile?.medicalId || "", email: r.patientId?.email || "" },
  }));
};

const reviewerOf = async (reviewer) => {
  const u = await User.findById(reviewer.id).select("profile.name role").setOptions(BYPASS).lean();
  return { reviewedBy: reviewer.id, reviewedByName: u?.profile?.name || "Nhân viên bệnh viện", reviewedByRole: u?.role || reviewer.role || "" };
};

/** Lấy yêu cầu đang chờ của đúng bệnh viện người duyệt; không có → 404, đã xử lý → 409. */
const pendingOf = async (reviewer, id) => {
  if (!isId(id) || !reviewer?.hospitalId) throw notFound();
  const req = await RecordCopyRequest.findOne({ _id: id, hospitalId: reviewer.hospitalId }).select("-snapshot").setOptions(BYPASS).lean();
  if (!req) throw notFound();
  if (req.status !== "pending") throw httpError(409, "Yêu cầu này đã được xử lý.");
  return req;
};

const notifyPatient = (req, title, message) => createNotificationInternal({
  hospitalId: req.hospitalId, recipientId: req.patientId, type: "other", title, message, relatedId: req._id,
}).catch((err) => console.error("[record-copy] Không gửi được thông báo:", err.message));

const hospitalNameOf = async (hospitalId) => (await Hospital.findById(hospitalId).select("name").setOptions(BYPASS).lean())?.name || "";

/** `signer` truyền vào được để test; mặc định chứng thư của máy chủ. */
export const approveCopyRequest = async (reviewer, id, { signer = getPdfSigner() } = {}) => {
  const req = await pendingOf(reviewer, id);
  // chốt nội dung lúc duyệt; chỉ dữ liệu của bệnh viện này. Tên in theo tên lúc gửi (đúng tên lễ tân đã thấy khi duyệt)
  const snapshot = await buildSharedRecord(req.patientId, req.sections, { onlyHospitalId: req.hospitalId });
  snapshot.patient = { ...snapshot.patient, name: req.patientName || snapshot.patient?.name };
  const review = { status: "approved", reviewedAt: new Date(), snapshot, ...(await reviewerOf(reviewer)) };
  // tạo + ký PDF đúng 1 lần ở đây; các lần tải sau chỉ gửi lại file đã lưu
  const pdf = await buildRecordCopyPdf({ ...req, ...review }, { hospitalName: await hospitalNameOf(req.hospitalId), signer });
  const updated = await RecordCopyRequest.findOneAndUpdate(
    { _id: req._id, status: "pending" }, // 2 người cùng bấm duyệt: chỉ 1 người thành công
    { $set: { ...review, pdf } },
    { new: true, lean: true, projection: { snapshot: 0, pdf: 0 } },
  ).setOptions(BYPASS);
  if (!updated) throw httpError(409, "Yêu cầu này đã được xử lý.");
  await notifyPatient(updated, "Bản sao bệnh án đã sẵn sàng", "Bệnh viện đã duyệt yêu cầu bản sao bệnh án của bạn. Vào mục \"Bản sao bệnh án\" để tải file PDF.");
  return { ...toPatientView(updated), reviewedByName: updated.reviewedByName };
};

export const rejectCopyRequest = async (reviewer, id, reason) => {
  const why = cleanText(reason, { required: true, field: "Lý do từ chối" });
  const req = await pendingOf(reviewer, id);
  const updated = await RecordCopyRequest.findOneAndUpdate(
    { _id: req._id, status: "pending" },
    { $set: { status: "rejected", rejectReason: why, reviewedAt: new Date(), ...(await reviewerOf(reviewer)) } },
    { new: true, lean: true, projection: { snapshot: 0, pdf: 0 } },
  ).setOptions(BYPASS);
  if (!updated) throw httpError(409, "Yêu cầu này đã được xử lý.");
  await notifyPatient(updated, "Yêu cầu bản sao bệnh án bị từ chối", `Lý do: ${why}`);
  return toPatientView(updated);
};

// ── Tải PDF qua link ngắn hạn ───────────────────────────────────────────────
const TOKEN_PURPOSE = "record-copy-pdf";
const tokenSecret = () => `${getJwtSecret()}:${TOKEN_PURPOSE}`; // khoá dẫn xuất riêng: token đăng nhập không dùng thay được

export const createCopyDownloadToken = async (patientId, id) => {
  if (!isId(id)) throw notFound();
  const req = await RecordCopyRequest.findOne({ _id: id, patientId }).select("status").setOptions(BYPASS).lean();
  if (!req) throw notFound();
  if (req.status !== "approved") throw httpError(409, "Bản sao chưa được bệnh viện duyệt.");
  return jwt.sign({ cid: String(req._id), uid: String(patientId), purpose: TOKEN_PURPOSE }, tokenSecret(), { algorithm: "HS256", expiresIn: "10m" });
};

export const loadCopyForDownload = async (token) => {
  let payload;
  try {
    payload = jwt.verify(String(token), tokenSecret(), { algorithms: ["HS256"] });
    if (payload.purpose !== TOKEN_PURPOSE || !isId(payload.cid)) throw new Error("sai mục đích");
  } catch {
    throw httpError(401, "Liên kết tải bản sao đã hết hạn hoặc không hợp lệ. Vui lòng bấm tải lại.");
  }
  const { pdf, ...request } = await RecordCopyRequest.findOne({ _id: payload.cid, patientId: payload.uid, status: "approved" })
    .select("+pdf").setOptions(BYPASS).lean() || {};
  if (!request._id || !request.snapshot) throw notFound();
  const hospitalName = await hospitalNameOf(request.hospitalId);
  if (pdf) return { request, hospitalName, pdf: Buffer.from(pdf.buffer || pdf) };
  // bản duyệt trước khi có lưu PDF: tạo 1 lần rồi lưu lại
  const fresh = await buildRecordCopyPdf(request, { hospitalName, signer: getPdfSigner() });
  await RecordCopyRequest.updateOne({ _id: request._id, pdf: null }, { $set: { pdf: fresh } }).setOptions(BYPASS);
  return { request, hospitalName, pdf: fresh };
};
