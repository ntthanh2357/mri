import crypto from "crypto";
import jwt from "jsonwebtoken";
import { RecordShare } from "../models/recordShare.model.js";
import { User } from "../models/user.model.js";
import { getJwtSecret } from "../config/jwt.config.js";
import { SHARE_SECTIONS, LEGACY_SHARE_SECTIONS } from "./sharedRecord.service.js";
import { resolveShareDocumentIds } from "./scannedDocument.service.js";

/**
 * UC-PAT-09 — Chia sẻ bệnh án qua QR.
 * - Bệnh nhân tạo mã QR, mã mở được trong 5 phút; nhiều người quét trong 5 phút đều vào được.
 * - Người quét đổi mã QR lấy "vé xem" riêng, vé không hết hạn cho tới khi bệnh nhân thu hồi.
 * - DB chỉ lưu mã băm SHA-256 (lộ DB không dùng được mã để xem bệnh án).
 */

export const QR_TTL_MS = 5 * 60 * 1000;
export const MAX_VIEWERS = 100; // số vé xem tối đa đổi từ 1 mã QR
const httpError = (status, message) => Object.assign(new Error(message), { status });

// token không phải chuỗi (client gửi object) coi như token rỗng → không khớp bản ghi nào
export const hashToken = (t) => crypto.createHash("sha256").update(typeof t === "string" ? t : "").digest("hex");
const newToken = () => crypto.randomBytes(32).toString("base64url");

/**
 * Nhóm bệnh nhân chọn → danh sách chuẩn (bỏ trùng, đúng thứ tự).
 * Không gửi = 8 nhóm gốc (bản giao diện cũ gửi body rỗng); "documents" chỉ được chia sẻ khi chọn rõ ràng.
 */
export const normalizeSections = (input) => {
  if (input === undefined || input === null) return [...LEGACY_SHARE_SECTIONS];
  if (!Array.isArray(input) || input.some((s) => typeof s !== "string")) throw httpError(400, "Danh sách nội dung chia sẻ không hợp lệ.");
  const chosen = new Set(input);
  if ([...chosen].some((s) => !SHARE_SECTIONS.includes(s))) throw httpError(400, "Nội dung chia sẻ không hợp lệ.");
  const sections = SHARE_SECTIONS.filter((s) => chosen.has(s));
  if (!sections.length) throw httpError(400, "Hãy chọn ít nhất 1 nội dung để chia sẻ.");
  return sections;
};

const sectionsOf = (share) => (share.sections?.length ? share.sections : [...LEGACY_SHARE_SECTIONS]);

/** `documentIds`: giấy tờ tự quét bệnh nhân chọn (chỉ xét khi có nhóm "documents"); không gửi = tất cả giấy tờ đã kiểm tra. */
export const createShare = async (patientId, hospitalId, now = new Date(), sections, documentIds) => {
  let chosen = normalizeSections(sections);
  let docIds;
  if (chosen.includes("documents")) {
    docIds = await resolveShareDocumentIds(patientId, documentIds);
    if (!docIds.length) {
      // Không có giấy tờ nào để chia sẻ → bỏ nhóm này thay vì tạo lượt chia sẻ rỗng
      chosen = chosen.filter((s) => s !== "documents");
      docIds = undefined;
      if (!chosen.length) throw httpError(400, "Chưa có giấy tờ nào được chọn để chia sẻ.");
    }
  }
  const qrToken = newToken();
  const share = await RecordShare.create({
    patientId,
    hospitalId: hospitalId || null,
    qrTokenHash: hashToken(qrToken),
    qrExpiresAt: new Date(now.getTime() + QR_TTL_MS),
    sections: chosen,
    documentIds: docIds,
  });
  return { share, qrToken };
};

/** Các lượt chia sẻ còn hiệu lực của bệnh nhân (chưa thu hồi): còn mở QR được, hoặc đã có người đang xem. */
export const listShares = async (patientId, now = new Date()) => {
  const shares = await RecordShare.find({ patientId, revokedAt: null }).sort({ createdAt: -1 }).lean();
  return shares
    .map((s) => ({
      _id: s._id,
      createdAt: s.createdAt,
      qrExpiresAt: s.qrExpiresAt,
      qrActive: new Date(s.qrExpiresAt) > now,
      sections: sectionsOf(s),
      documentCount: s.documentIds ? s.documentIds.length : null,
      viewerCount: s.sessions.length,
      lastViewedAt: s.sessions.reduce((m, x) => (x.lastViewedAt && (!m || x.lastViewedAt > m) ? x.lastViewedAt : m), null),
      totalViews: s.sessions.reduce((n, x) => n + (x.viewCount || 0), 0),
      // Nhân viên đã mở bằng cách quét trong app (có danh tính); không trả mã người dùng nội bộ
      viewers: s.sessions.filter((x) => x.viewerUserId)
        .map((x) => ({ name: x.viewerName, role: x.viewerRole, openedAt: x.createdAt, lastViewedAt: x.lastViewedAt, viewCount: x.viewCount || 0 })),
    }))
    .filter((s) => s.qrActive || s.viewerCount > 0); // QR hết hạn mà không ai vào → không cần hiện
};

export const revokeShare = async (patientId, shareId, now = new Date()) => {
  const share = await RecordShare.findOneAndUpdate(
    { _id: shareId, patientId, revokedAt: null },
    { $set: { revokedAt: now } },
    { new: true }
  );
  if (!share) throw httpError(404, "Không tìm thấy lượt chia sẻ.");
  return share;
};

/**
 * Danh tính nhân viên đang đăng nhập, để ghi vào lượt mở bệnh án.
 * Tên lấy thẳng từ DB: `req.user.profile` có lúc rỗng vì bộ nhớ đệm đăng nhập chỉ giữ bản rút gọn trong 60 giây sau khi đăng nhập.
 */
export const staffViewerOf = async (reqUser) => {
  const user = await User.findById(reqUser.id).select("profile.name profile.fullName").setOptions({ bypassTenancy: true }).lean();
  return { userId: reqUser.id, name: user?.profile?.name || user?.profile?.fullName || "Nhân viên y tế", role: reqUser.role };
};

/**
 * Người quét QR (trong 5 phút) nhận vé xem riêng.
 * `viewer` { userId, name, role }: nhân viên đang đăng nhập quét trong app — ghi lại để bệnh nhân biết ai đã mở.
 */
export const redeemQr = async (qrToken, { now = new Date(), userAgent = "", viewer = null } = {}) => {
  const share = await RecordShare.findOne({ qrTokenHash: hashToken(qrToken) });
  if (!share) throw httpError(404, "Mã QR không hợp lệ.");
  if (share.revokedAt) throw httpError(410, "Bệnh nhân đã dừng chia sẻ bệnh án này.");
  if (share.qrExpiresAt <= now) throw httpError(410, "Mã QR đã hết hạn (chỉ mở được trong 5 phút). Hãy nhờ bệnh nhân tạo mã mới.");
  if (share.sessions.length >= MAX_VIEWERS) throw httpError(429, "Mã QR này đã được mở quá nhiều lần. Hãy nhờ bệnh nhân tạo mã mới.");
  const viewerToken = newToken();
  share.sessions.push({
    viewerTokenHash: hashToken(viewerToken),
    createdAt: now,
    userAgent: String(userAgent).slice(0, 160),
    ...(viewer?.userId ? {
      viewerUserId: viewer.userId,
      viewerName: String(viewer.name || "").replace(/\s+/g, " ").trim().slice(0, 120),
      viewerRole: String(viewer.role || "").slice(0, 40),
    } : {}),
  });
  await share.save();
  return { viewerToken, patientId: share.patientId };
};

/**
 * Mã tài khoản đang đăng nhập theo header Authorization, hoặc null (không bắt buộc đăng nhập).
 * Tự kiểm token ở đây thay vì dùng middleware optionalProtect: middleware đó ghi bản người dùng rút gọn vào bộ nhớ đệm
 * đăng nhập, làm các request sau thiếu hồ sơ. Hàm này chỉ đọc, không ghi bộ nhớ đệm.
 */
export const signedInUserId = async (authorization) => {
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) return null;
  try {
    const decoded = jwt.verify(authorization.slice(7), getJwtSecret(), { algorithms: ["HS256"] });
    const user = await User.findById(decoded.id).select("tokenVersion isLocked").setOptions({ bypassTenancy: true }).lean();
    // tài khoản bị khoá hoặc đã "đăng xuất mọi thiết bị" (tokenVersion đổi) thì coi như chưa đăng nhập
    if (!user || user.isLocked || (user.tokenVersion || 0) !== (decoded.tokenVersion ?? 0)) return null;
    return String(decoded.id);
  } catch {
    return null;
  }
};

/**
 * Mở bệnh án bằng vé xem (không hết hạn); ghi nhận lượt xem.
 * Vé do nhân viên đổi trong app (có viewerUserId) chỉ dùng được khi đang đăng nhập đúng tài khoản đó:
 * vé nằm trong địa chỉ trang của máy dùng chung, người khác nhặt lại cũng không mở được và không bị tính cho nhân viên.
 * `userId`: mã tài khoản đang đăng nhập, hoặc 1 hàm trả về nó (chỉ gọi khi vé thuộc về nhân viên, đỡ tốn truy vấn).
 */
export const resolveViewer = async (viewerToken, { now = new Date(), userId = null } = {}) => {
  const h = hashToken(viewerToken);
  const share = await RecordShare.findOne({ "sessions.viewerTokenHash": h }).lean();
  if (!share) throw httpError(404, "Liên kết xem bệnh án không hợp lệ.");
  if (share.revokedAt) throw httpError(410, "Bệnh nhân đã dừng chia sẻ bệnh án này.");
  const session = share.sessions.find((x) => x.viewerTokenHash === h);
  if (session?.viewerUserId && String(session.viewerUserId) !== String(typeof userId === "function" ? await userId() : userId)) {
    throw httpError(403, "Liên kết này thuộc về tài khoản nhân viên đã quét mã. Hãy đăng nhập đúng tài khoản đó, hoặc quét lại mã của bệnh nhân.");
  }
  await RecordShare.updateOne(
    { _id: share._id, "sessions.viewerTokenHash": h },
    { $set: { "sessions.$.lastViewedAt": now }, $inc: { "sessions.$.viewCount": 1 } }
  );
  return { patientId: share.patientId, shareId: share._id, sections: sectionsOf(share), documentIds: share.documentIds };
};
