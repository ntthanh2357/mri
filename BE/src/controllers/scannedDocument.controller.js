import multer from "multer";
import { pipeline } from "stream/promises";
import * as docService from "../services/scannedDocument.service.js";
import { successResponse, errorResponse } from "../utils/response.util.js";

// UC-PAT-09 (mở rộng) — Giấy tờ bệnh nhân tự quét. Phân quyền role ở routes.

const wrap = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

// Bộ nhận file riêng cho quét giấy tờ: đúng 1 ảnh, không nhận trường chữ nào (chặn nhồi multipart làm đầy bộ nhớ)
const uploadScan = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: docService.MAX_BYTES, files: 1, fields: 0, parts: 2 },
  fileFilter: (req, file, cb) => cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)),
}).single("file");

/** Nhận 1 ảnh (field "file"); lỗi của multer (quá lớn, sai loại, thừa trường) trả 400 thay vì rơi xuống 500. */
export const receiveImage = (req, res, next) =>
  uploadScan(req, res, (err) => {
    if (err) return errorResponse(res, err.code === "LIMIT_FILE_SIZE" ? "Ảnh quá lớn (tối đa 10 MB)." : "Yêu cầu tải ảnh không hợp lệ.", 400);
    if (!req.file?.buffer) return errorResponse(res, "Chỉ nhận 1 ảnh JPEG, PNG hoặc WEBP.", 400);
    next();
  });

// POST /api/v1/patient/scanned-documents[?autocrop=0] (multipart "file") — chụp giấy tờ, AI tự cắt nền + đọc chữ + tách thông tin,
// lưu ở trạng thái chưa kiểm tra. autocrop=0: giữ nguyên khung ảnh (dùng khi tự cắt bị sai)
export const scanMine = wrap(async (req, res) => {
  const autocrop = !["0", "false"].includes(req.query.autocrop); // chỉ chuỗi "0"/"false" mới tắt tự cắt
  const { doc, ocrFailed, cropped } = await docService.scanDocument({ patientId: req.user.id, hospitalId: req.user.hospitalId, buffer: req.file.buffer, autocrop });
  return successResponse(res, { ...docService.toPublicDoc(doc), ocrFailed, cropped },
    ocrFailed ? "Đã lưu ảnh nhưng chưa đọc được chữ tự động. Bạn có thể tự gõ nội dung." : "Đã đọc chữ trong ảnh. Hãy kiểm tra lại trước khi lưu.");
});

// GET /api/v1/patient/scanned-documents — giấy tờ của tôi (mới nhất trước)
export const listMine = wrap(async (req, res) =>
  successResponse(res, (await docService.listDocuments(req.user.id, { limit: req.query.limit })).map((d) => docService.toPublicDoc(d))));

// PUT /api/v1/patient/scanned-documents/:id { title, text, fields? } — lưu sau khi kiểm tra
export const saveMine = wrap(async (req, res) => {
  const doc = await docService.saveDocument(req.user.id, req.params.id, { title: req.body?.title, text: req.body?.text, fields: req.body?.fields });
  return successResponse(res, docService.toPublicDoc(doc), "Đã lưu giấy tờ.");
});

// DELETE /api/v1/patient/scanned-documents/:id
export const deleteMine = wrap(async (req, res) => {
  await docService.deleteDocument(req.user.id, req.params.id);
  return successResponse(res, null, "Đã xoá giấy tờ.");
});

// GET /api/v1/shared-records/document-image/:token — công khai theo link ngắn hạn (token ký riêng, 15 phút)
export const streamImage = async (req, res) => {
  let payload;
  try {
    payload = docService.verifyImageToken(req.params.token);
  } catch {
    return errorResponse(res, "Liên kết ảnh đã hết hạn. Hãy tải lại trang.", 401);
  }
  let image;
  try {
    image = await docService.getImage(payload);
  } catch (err) {
    // Endpoint công khai: không trả chi tiết lỗi kho lưu ra ngoài, chỉ ghi log
    if (err.status !== 404) console.error("[scanned-document] Không đọc được ảnh:", err.message);
    return errorResponse(res, "Không tìm thấy ảnh giấy tờ.", 404);
  }
  res.set({ "Content-Type": image.mimeType, "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=600" });
  try {
    await pipeline(image.stream, res); // đóng file kể cả khi người xem ngắt kết nối giữa chừng
  } catch (err) {
    console.error("[scanned-document] Lỗi khi gửi ảnh:", err.code || err.message);
    if (!res.headersSent) return errorResponse(res, "Không tìm thấy ảnh giấy tờ.", 404);
    res.destroy();
  }
};
