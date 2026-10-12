import crypto from "crypto";
import { RecordShare } from "../models/recordShare.model.js";
import { SHARE_SECTIONS } from "./sharedRecord.service.js";

/**
 * UC-PAT-09 — Chia sẻ bệnh án qua QR.
 * - Bệnh nhân tạo mã QR, mã mở được trong 5 phút; nhiều người quét trong 5 phút đều vào được.
 * - Người quét đổi mã QR lấy "vé xem" riêng, vé không hết hạn cho tới khi bệnh nhân thu hồi.
 * - DB chỉ lưu mã băm SHA-256 (lộ DB không dùng được mã để xem bệnh án).
 */

export const QR_TTL_MS = 5 * 60 * 1000;
const httpError = (status, message) => Object.assign(new Error(message), { status });

export const hashToken = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");
const newToken = () => crypto.randomBytes(32).toString("base64url");

/** Nhóm bệnh nhân chọn → danh sách chuẩn (bỏ trùng, đúng thứ tự). Không gửi = chia sẻ tất cả. */
export const normalizeSections = (input) => {
  if (input === undefined || input === null) return [...SHARE_SECTIONS];
  if (!Array.isArray(input)) throw httpError(400, "Danh sách nội dung chia sẻ không hợp lệ.");
  const chosen = new Set(input.map(String));
  if ([...chosen].some((s) => !SHARE_SECTIONS.includes(s))) throw httpError(400, "Nội dung chia sẻ không hợp lệ.");
  const sections = SHARE_SECTIONS.filter((s) => chosen.has(s));
  if (!sections.length) throw httpError(400, "Hãy chọn ít nhất 1 nội dung để chia sẻ.");
  return sections;
};

const sectionsOf = (share) => (share.sections?.length ? share.sections : [...SHARE_SECTIONS]);

export const createShare = async (patientId, hospitalId, now = new Date(), sections) => {
  const chosen = normalizeSections(sections);
  const qrToken = newToken();
  const share = await RecordShare.create({
    patientId,
    hospitalId: hospitalId || null,
    qrTokenHash: hashToken(qrToken),
    qrExpiresAt: new Date(now.getTime() + QR_TTL_MS),
    sections: chosen,
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
      viewerCount: s.sessions.length,
      lastViewedAt: s.sessions.reduce((m, x) => (x.lastViewedAt && (!m || x.lastViewedAt > m) ? x.lastViewedAt : m), null),
      totalViews: s.sessions.reduce((n, x) => n + (x.viewCount || 0), 0),
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

/** Người quét QR (trong 5 phút) nhận vé xem riêng. */
export const redeemQr = async (qrToken, { now = new Date(), userAgent = "" } = {}) => {
  const share = await RecordShare.findOne({ qrTokenHash: hashToken(qrToken) });
  if (!share) throw httpError(404, "Mã QR không hợp lệ.");
  if (share.revokedAt) throw httpError(410, "Bệnh nhân đã dừng chia sẻ bệnh án này.");
  if (share.qrExpiresAt <= now) throw httpError(410, "Mã QR đã hết hạn (chỉ mở được trong 5 phút). Hãy nhờ bệnh nhân tạo mã mới.");
  const viewerToken = newToken();
  share.sessions.push({ viewerTokenHash: hashToken(viewerToken), createdAt: now, userAgent: String(userAgent).slice(0, 160) });
  await share.save();
  return { viewerToken, patientId: share.patientId };
};

/** Mở bệnh án bằng vé xem (không hết hạn); ghi nhận lượt xem. */
export const resolveViewer = async (viewerToken, { now = new Date() } = {}) => {
  const h = hashToken(viewerToken);
  const share = await RecordShare.findOne({ "sessions.viewerTokenHash": h }).lean();
  if (!share) throw httpError(404, "Liên kết xem bệnh án không hợp lệ.");
  if (share.revokedAt) throw httpError(410, "Bệnh nhân đã dừng chia sẻ bệnh án này.");
  await RecordShare.updateOne(
    { _id: share._id, "sessions.viewerTokenHash": h },
    { $set: { "sessions.$.lastViewedAt": now }, $inc: { "sessions.$.viewCount": 1 } }
  );
  return { patientId: share.patientId, shareId: share._id, sections: sectionsOf(share) };
};
