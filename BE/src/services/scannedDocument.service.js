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
export const MAX_SCANS_PER_DAY = 20; // mỗi bệnh nhân — mỗi lần quét tốn 1 lượt AI dùng chung với phần đọc phim
export const MAX_TEXT = 20000;
export const MAX_TITLE = 120;
export const MAX_BYTES = 10 * 1024 * 1024;
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
const cleanTitle = (t) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TITLE);
const cleanText = (t) => String(t ?? "").replace(/\r\n/g, "\n").trim().slice(0, MAX_TEXT);

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

/** Dữ liệu trả ra ngoài: không lộ fileId nội bộ, ảnh qua link ngắn hạn. */
export const toPublicDoc = (doc, { shareId = null } = {}) => ({
  _id: doc._id,
  title: doc.title,
  text: doc.text,
  ocrStatus: doc.ocrStatus,
  confirmedAt: doc.confirmedAt,
  createdAt: doc.createdAt,
  imageUrl: `/api/v1/shared-records/document-image/${createImageToken(doc._id, { shareId })}`,
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

export const scanDocument = async ({ patientId, hospitalId, buffer }, opts = {}) => {
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
    read = await ocr(buffer, kind.mime);
  } catch (err) {
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
      fileId: file.fileId,
      mimeType: "image/jpeg",
      ocrStatus: read.failed ? "failed" : "done",
    });
    // Nhiều yêu cầu chen nhau trong lúc chờ AI có thể cùng lọt qua bước đếm ở trên → đếm lại sau khi tạo
    if ((await ScannedDocument.countDocuments({ patientId })) > MAX_DOCS) throw capError();
    return { doc, ocrFailed: Boolean(read.failed) };
  } catch (err) {
    if (doc) await ScannedDocument.deleteOne({ _id: doc._id }).catch(() => {});
    await storage.deleteFile(file.fileId).catch(() => {}); // không để file mồ côi
    throw err;
  }
};

export const listDocuments = async (patientId, { limit = MAX_DOCS } = {}) =>
  ScannedDocument.find({ patientId }).sort({ createdAt: -1 }).limit(Math.min(Math.max(Number(limit) || 1, 1), MAX_DOCS)).lean();

/** Chỉ giấy tờ bệnh nhân đã kiểm tra và lưu mới được đưa vào bệnh án chia sẻ. */
export const listSharedDocuments = async (patientId) =>
  ScannedDocument.find({ patientId, confirmedAt: { $ne: null } }).sort({ createdAt: -1 }).limit(MAX_DOCS).lean();

export const saveDocument = async (patientId, docId, { title, text }, now = new Date()) => {
  assertId(docId);
  const doc = await ScannedDocument.findOneAndUpdate(
    { _id: docId, patientId },
    { $set: { title: cleanTitle(title) || defaultTitle(now), text: cleanText(text), confirmedAt: now } },
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
    // Link của người xem QR: lượt chia sẻ phải còn hiệu lực, đúng bệnh nhân, và giấy tờ đã được kiểm tra
    const live = mongoose.isValidObjectId(sid) && doc.confirmedAt
      && (await RecordShare.exists({ _id: sid, patientId: doc.patientId, revokedAt: null }));
    if (!live) throw notFound();
  }
  const { stream, file } = await storage.getFileStream(doc.fileId);
  // Phòng thủ nhiều lớp: file trong kho phải đúng loại và đúng chủ
  if (file?.category !== "patient_upload" || String(file?.patientId) !== String(doc.patientId)) {
    stream.destroy();
    throw notFound();
  }
  return { stream, mimeType: doc.mimeType };
};
