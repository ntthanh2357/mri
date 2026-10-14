import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { ScannedDocument, ScanUsage } from "../models/scannedDocument.model.js";
import { RecordShare } from "../models/recordShare.model.js";
import { getJwtSecret } from "../config/jwt.config.js";
import * as storageService from "./storage/storageService.js";
import { ocrDocumentImage } from "./documentOcr.service.js";

/**
 * UC-PAT-09 (mở rộng) — Bệnh nhân chụp giấy tờ, AI đọc chữ, bệnh nhân kiểm tra rồi lưu; sau đó chọn chia sẻ qua QR.
 * `ocr` và `storage` truyền vào được để test không phải gọi AI server / ghi đĩa thật.
 */

export const MAX_DOCS = 30; // mỗi bệnh nhân
// mỗi bệnh nhân — mỗi lần quét tốn 2 lượt AI (đọc + đọc kiểm tra chéo), nhiều hơn khi phải thử lại; dùng chung với phần đọc phim
export const MAX_SCANS_PER_DAY = 20;
// ảnh kém bị từ chối không tốn lượt AI nên được hoàn lượt quét, nhưng chỉ chừng này lần mỗi ngày:
// AI service vẫn phải giải nén và đo ảnh, không để gửi lặp ảnh kém mà không bao giờ chạm hạn mức
export const MAX_REFUNDS_PER_DAY = 20;
export const MAX_TEXT = 20000;
export const MAX_TITLE = 120;
export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_MEDICATIONS = 30;
export const DOC_TYPES = ["prescription", "lab_result", "imaging_result", "discharge", "referral", "other"];
const httpError = (status, message) => Object.assign(new Error(message), { status });
const defaults = { ocr: ocrDocumentImage, storage: storageService };

/** Loại ảnh theo nội dung file (magic bytes) — không tin tên file hay Content-Type do client gửi. */
export const imageKind = (buf) => {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { ext: "png", mime: "image/png" };
  if (buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
};

/** Mã sai định dạng coi như không tìm thấy (tránh CastError thành lỗi 500). */
const assertId = (id) => { if (!mongoose.isValidObjectId(id)) throw httpError(404, "Không tìm thấy giấy tờ."); };
const defaultTitle = (now = new Date()) => `Giấy tờ quét ngày ${now.toLocaleDateString("vi-VN")}`;
// Cắt thô trước khi chạy regex: body JSON có thể tới 20 MB, không để 1 yêu cầu chiếm CPU của cả máy chủ.
// Chỉ nhận chuỗi/số; kiểu khác (object, mảng) coi như rỗng thay vì để String() ném lỗi thành 500.
const line = (v, max) => (typeof v === "string" || typeof v === "number" ? String(v).slice(0, max * 4).replace(/\s+/g, " ").trim().slice(0, max) : "");
const cleanTitle = (t) => line(t, MAX_TITLE);
const cleanText = (t) => (typeof t === "string" ? t.slice(0, MAX_TEXT * 2).replace(/\r\n/g, "\n").trim().slice(0, MAX_TEXT) : "");

/**
 * Thông tin có cấu trúc của giấy tờ → đúng khung, đúng độ dài. Dùng cho cả kết quả AI lẫn dữ liệu bệnh nhân gửi lên
 * (không tin định dạng của bên nào); giấy tờ cũ chưa có fields cũng ra đủ khung rỗng.
 */
export const cleanFields = (raw) => {
  const f = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const medications = (Array.isArray(f.medications) ? f.medications : [])
    .slice(0, MAX_MEDICATIONS * 5) // giới hạn số phần tử phải duyệt
    .map((m) => (m && typeof m === "object" ? { name: line(m.name, 200), quantity: line(m.quantity, 80), usage: line(m.usage, 300) } : null))
    .filter((m) => m?.name)
    .slice(0, MAX_MEDICATIONS);
  return {
    docType: DOC_TYPES.includes(f.docType) ? f.docType : "other",
    date: line(f.date, 40),
    facility: line(f.facility, 200),
    doctor: line(f.doctor, 120),
    diagnosis: line(f.diagnosis, 500),
    medications,
  };
};

// ── Link ảnh ngắn hạn (ảnh không nằm trong /uploads công khai) ──────────────
const TOKEN_PURPOSE = "scanned-document-image";
const imageSecret = () => `${getJwtSecret()}:${TOKEN_PURPOSE}`;

/** `shareId`: link cấp cho người xem QR — mất hiệu lực ngay khi bệnh nhân dừng lượt chia sẻ đó. */
export const createImageToken = (docId, { shareId = null, expiresIn = "15m" } = {}) =>
  jwt.sign({ did: String(docId), ...(shareId ? { sid: String(shareId) } : {}), purpose: TOKEN_PURPOSE }, imageSecret(), { algorithm: "HS256", expiresIn });

/** Ném lỗi nếu token sai chữ ký, hết hạn hoặc không phải token ảnh giấy tờ. */
export const verifyImageToken = (token) => {
  const payload = jwt.verify(token, imageSecret(), { algorithms: ["HS256"] });
  if (payload.purpose !== TOKEN_PURPOSE || !payload.did) throw new Error("Token ảnh không hợp lệ.");
  return payload;
};

export const MAX_CHECKS = 30;
const QUALITY_REASONS = {
  blurry: "ảnh bị mờ (giữ chắc tay và chờ máy lấy nét)",
  small: "chụp quá xa hoặc ảnh quá nhỏ (đưa máy lại gần để tờ giấy chiếm gần hết khung hình)",
  dark: "ảnh thiếu sáng (ra chỗ sáng hơn, tránh để bóng tay che giấy)",
};
const knownReasons = (list) => (Array.isArray(list) ? list : []).filter((r) => typeof r === "string" && r in QUALITY_REASONS).slice(0, 3);

/**
 * Kết quả so 2 lần đọc của AI → đúng khung. `textLength`: độ dài phần chữ đã lưu, để vị trí không vượt ra ngoài.
 * Không tin định dạng AI service trả về; giấy tờ cũ chưa có trường này = chưa kiểm tra chéo.
 */
export const cleanReview = (raw, textLength = Number.MAX_SAFE_INTEGER) => {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const pos = (v) => Math.min(Math.max(Number.isInteger(v) ? v : 0, 0), textLength);
  const checks = (Array.isArray(r.checks) ? r.checks : [])
    .slice(0, MAX_CHECKS * 5)
    .filter((c) => c && typeof c === "object" && !Array.isArray(c))
    .slice(0, MAX_CHECKS)
    .map((c) => {
      const start = pos(c.start);
      return { start, end: Math.max(pos(c.end), start), primary: line(c.primary, 120), other: line(c.other, 120) };
    });
  return {
    verified: r.verified === true,
    tooMany: (r.tooMany ?? r.too_many) === true,
    truncated: r.truncated === true,
    quality: ["fair", "poor"].includes(r.quality) ? r.quality : "good",
    qualityReasons: knownReasons(r.qualityReasons),
    checks,
  };
};

/**
 * Dữ liệu trả ra ngoài: không lộ fileId nội bộ, ảnh qua link ngắn hạn.
 * `withReview`: kèm kết quả so 2 lần đọc — chỉ cho chủ giấy tờ lúc kiểm tra, không gửi cho người xem qua QR.
 */
export const toPublicDoc = (doc, { shareId = null, withReview = false } = {}) => ({
  _id: doc._id,
  title: doc.title,
  text: doc.text,
  fields: cleanFields(doc.fields),
  ocrStatus: doc.ocrStatus,
  confirmedAt: doc.confirmedAt,
  createdAt: doc.createdAt,
  imageUrl: `/api/v1/shared-records/document-image/${createImageToken(doc._id, { shareId })}`,
  ...(withReview ? { review: cleanReview(doc.review?.toObject ? doc.review.toObject() : doc.review) } : {}),
});

// ── Hạn mức quét theo ngày ──────────────────────────────────────────────────
const vnDay = (now) => new Date(now.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);

/** Trừ 1 lượt quét trong ngày (nguyên tử). Hết lượt → 429. Xoá giấy tờ không hoàn lượt. */
const consumeScanQuota = async (patientId, now) => {
  const filter = { patientId, day: vnDay(now), count: { $lt: MAX_SCANS_PER_DAY } };
  try {
    await ScanUsage.findOneAndUpdate(filter, { $inc: { count: 1 }, $setOnInsert: { expireAt: new Date(now.getTime() + 3 * 24 * 3600 * 1000) } }, { upsert: true });
  } catch (err) {
    if (err?.code !== 11000) throw err;
    // Trùng khoá: hoặc đã hết lượt, hoặc 2 yêu cầu đầu ngày cùng tạo bản ghi → thử lại không upsert để phân biệt
    if (!(await ScanUsage.findOneAndUpdate(filter, { $inc: { count: 1 } }))) {
      throw httpError(429, `Hôm nay bạn đã quét đủ ${MAX_SCANS_PER_DAY} lần. Vui lòng quay lại vào ngày mai.`);
    }
  }
};

// ── Nghiệp vụ ───────────────────────────────────────────────────────────────
const capError = () => httpError(409, `Bạn đã lưu tối đa ${MAX_DOCS} giấy tờ. Hãy xoá bớt giấy tờ cũ trước khi quét thêm.`);
const aiDown = () => httpError(503, "Dịch vụ đọc chữ đang tạm ngưng. Vui lòng thử lại sau ít phút.");

export const scanDocument = async ({ patientId, hospitalId, buffer, autocrop = true, force = false }, opts = {}) => {
  const { ocr, storage, now } = { ...defaults, now: new Date(), ...opts };
  const kind = imageKind(buffer);
  if (!kind) throw httpError(400, "Chỉ nhận ảnh JPEG, PNG hoặc WEBP.");
  if (buffer.length > MAX_BYTES) throw httpError(400, "Ảnh quá lớn (tối đa 10 MB).");
  if ((await ScannedDocument.countDocuments({ patientId })) >= MAX_DOCS) throw capError();
  await consumeScanQuota(patientId, now);

  // AI service vừa đọc chữ vừa trả bản ảnh đã chuẩn hoá (bỏ EXIF/GPS, giới hạn kích thước).
  // Không có bản chuẩn hoá thì không lưu: không cất file gốc chưa kiểm định vào kho.
  let read;
  try {
    read = await ocr(buffer, kind.mime, { autocrop, force });
  } catch (err) {
    if (err.code === "POOR_QUALITY") {
      // Ảnh kém bị từ chối trước khi gọi model (không tốn lượt AI) → hoàn lượt quét để bệnh nhân chụp lại (có trần mỗi ngày)
      await ScanUsage.updateOne(
        { patientId, day: vnDay(now), count: { $gt: 0 }, rejected: { $not: { $gte: MAX_REFUNDS_PER_DAY } } },
        { $inc: { count: -1, rejected: 1 } }
      );
      const reasons = knownReasons(err.reasons);
      const why = reasons.map((r) => QUALITY_REASONS[r]).join("; ") || "ảnh không đủ rõ";
      throw Object.assign(httpError(422, `Máy không đọc chính xác được ảnh này: ${why}. Hãy chụp lại.`), { code: "POOR_QUALITY", reasons });
    }
    if (err.status === 400) throw err;
    console.error("[scanned-document] AI service không dùng được:", err.message);
    throw aiDown();
  }
  if (imageKind(read?.image)?.mime !== "image/jpeg" || read.image.length > MAX_BYTES) {
    console.error("[scanned-document] AI service trả ảnh chuẩn hoá không hợp lệ");
    throw aiDown();
  }

  const file = await storage.putFile({
    category: "patient_upload",
    fileName: `scan_${crypto.randomUUID()}.jpg`, // tên ngẫu nhiên: không trùng, không đoán được (kho ghi đè file trùng tên)
    buffer: read.image,
    mimeType: "image/jpeg",
    patientId: String(patientId),
    uploadedBy: String(patientId),
  });

  let doc = null;
  try {
    doc = await ScannedDocument.create({
      patientId,
      hospitalId: hospitalId || null,
      title: cleanTitle(read.title) || defaultTitle(now),
      text: cleanText(read.text),
      fields: cleanFields(read.fields),
      review: cleanReview({
        ...(read.review && typeof read.review === "object" ? read.review : {}),
        truncated: read.truncated === true,
        quality: read.quality?.level,
        qualityReasons: read.quality?.reasons,
      }, cleanText(read.text).length),
      fileId: file.fileId,
      mimeType: "image/jpeg",
      ocrStatus: read.failed ? "failed" : "done",
    });
    // Nhiều yêu cầu chen nhau trong lúc chờ AI có thể cùng lọt qua bước đếm ở trên → đếm lại sau khi tạo
    if ((await ScannedDocument.countDocuments({ patientId })) > MAX_DOCS) throw capError();
    return { doc, ocrFailed: Boolean(read.failed), cropped: Boolean(read.cropped), textOnly: Boolean(read.textOnly) };
  } catch (err) {
    if (doc) await ScannedDocument.deleteOne({ _id: doc._id }).catch(() => {});
    await storage.deleteFile(file.fileId).catch(() => {}); // không để file mồ côi
    throw err;
  }
};

export const listDocuments = async (patientId, { limit = MAX_DOCS } = {}) =>
  ScannedDocument.find({ patientId }).sort({ createdAt: -1 }).limit(Math.min(Math.max(Number(limit) || 1, 1), MAX_DOCS)).lean();

/** Chỉ giấy tờ bệnh nhân đã kiểm tra và lưu mới được đưa vào bệnh án chia sẻ; `ids` = danh sách lượt chia sẻ đã chốt. */
export const listSharedDocuments = async (patientId, ids) =>
  ScannedDocument.find({ patientId, confirmedAt: { $ne: null }, ...(ids ? { _id: { $in: ids } } : {}) }).sort({ createdAt: -1 }).limit(MAX_DOCS).lean();

/**
 * Chốt danh sách giấy tờ cho 1 lượt chia sẻ: chỉ nhận giấy tờ đã kiểm tra của chính bệnh nhân.
 * Không gửi danh sách = tất cả giấy tờ đã kiểm tra lúc này. Trả mảng rỗng nếu không có giấy tờ nào.
 */
export const resolveShareDocumentIds = async (patientId, input) => {
  const confirmed = await listSharedDocuments(patientId);
  if (input === undefined || input === null) return confirmed.map((d) => d._id);
  if (!Array.isArray(input) || input.length > MAX_DOCS || input.some((id) => typeof id !== "string")) throw httpError(400, "Danh sách giấy tờ chia sẻ không hợp lệ.");
  const chosen = new Set(input);
  const mine = new Set(confirmed.map((d) => String(d._id)));
  if ([...chosen].some((id) => !mine.has(id))) throw httpError(400, "Giấy tờ được chọn không hợp lệ hoặc chưa được kiểm tra.");
  return confirmed.filter((d) => chosen.has(String(d._id))).map((d) => d._id);
};

export const saveDocument = async (patientId, docId, { title, text, fields }, now = new Date()) => {
  assertId(docId);
  const doc = await ScannedDocument.findOneAndUpdate(
    { _id: docId, patientId },
    // không gửi fields (bản giao diện cũ) thì giữ nguyên thông tin đang có.
    // Bỏ các đoạn của lần đọc thứ hai: chỉ dùng lúc kiểm tra, không giữ bản AI đọc gốc mà bệnh nhân có thể đã xoá khỏi phần chữ
    {
      $set: {
        title: cleanTitle(title) || defaultTitle(now),
        text: cleanText(text),
        confirmedAt: now,
        "review.checks": [],
        ...(fields === undefined ? {} : { fields: cleanFields(fields) }),
      },
    },
    { new: true }
  ).lean();
  if (!doc) throw httpError(404, "Không tìm thấy giấy tờ.");
  return doc;
};

export const deleteDocument = async (patientId, docId, { storage } = defaults) => {
  assertId(docId);
  const doc = await ScannedDocument.findOneAndDelete({ _id: docId, patientId }).lean();
  if (!doc) throw httpError(404, "Không tìm thấy giấy tờ.");
  // bản ghi đã xoá; lỗi xoá file chỉ ghi log để không báo sai cho bệnh nhân
  await storage.deleteFile(doc.fileId).catch((err) => console.error("[scanned-document] Không xoá được file:", err.message));
  return doc;
};

/**
 * Ảnh của 1 giấy tờ, theo nội dung token ảnh đã kiểm chữ ký ({ did, sid? }).
 * Trả stream để controller pipe thẳng ra response (không giữ cả ảnh trong RAM, luôn đóng file).
 */
export const getImage = async ({ did, sid }, { storage } = defaults) => {
  const notFound = () => httpError(404, "Không tìm thấy ảnh giấy tờ.");
  if (!mongoose.isValidObjectId(did)) throw notFound();
  const doc = await ScannedDocument.findById(did).select("fileId mimeType patientId confirmedAt").lean();
  if (!doc) throw notFound();
  if (sid) {
    // Link của người xem QR: lượt chia sẻ phải còn hiệu lực, đúng bệnh nhân, có nhóm giấy tờ và gồm đúng giấy tờ này
    const share = mongoose.isValidObjectId(sid) && doc.confirmedAt
      ? await RecordShare.findOne({ _id: sid, patientId: doc.patientId, revokedAt: null }).select("sections documentIds").lean()
      : null;
    const included = share?.sections?.includes("documents")
      && (!share.documentIds || share.documentIds.some((id) => String(id) === String(doc._id)));
    if (!included) throw notFound();
  }
  const { stream, file } = await storage.getFileStream(doc.fileId);
  // Phòng thủ nhiều lớp: file trong kho phải đúng loại và đúng chủ
  if (file?.category !== "patient_upload" || String(file?.patientId) !== String(doc.patientId)) {
    stream.destroy();
    throw notFound();
  }
  return { stream, mimeType: doc.mimeType };
};
