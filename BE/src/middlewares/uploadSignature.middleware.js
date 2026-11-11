import crypto from "crypto";
import { getJwtSecret } from "../config/jwt.config.js";

/**
 * Tệp trong /uploads là ảnh và tài liệu y khoa, nhưng thẻ <img> không gửi được Bearer token.
 * Vì vậy mỗi lần API trả về đường dẫn /uploads/..., máy chủ gắn thêm chữ ký có hạn dùng. Ai được API
 * trả dữ liệu thì mới có link, nên quyền đọc tệp đi theo đúng quyền đọc hồ sơ. Không có chữ ký thì 401.
 * DB chỉ lưu đường dẫn gốc: chữ ký được bỏ khỏi dữ liệu client gửi lên.
 */
export const UPLOAD_LINK_TTL_MS = 12 * 60 * 60 * 1000;

const uploadSecret = () => process.env.UPLOAD_URL_SECRET || getJwtSecret();

const normalizePath = (filePath) => {
  try {
    return decodeURIComponent(filePath);
  } catch {
    return filePath;
  }
};

const computeSignature = (filePath, expires) =>
  crypto.createHmac("sha256", uploadSecret()).update(`${normalizePath(filePath)}|${expires}`).digest("base64url");

export const signUploadPath = (filePath, now = Date.now()) => {
  const expires = now + UPLOAD_LINK_TTL_MS;
  return `${filePath}?exp=${expires}&sig=${computeSignature(filePath, expires)}`;
};

// Khớp đúng chuỗi JSON có toàn bộ giá trị là đường dẫn upload, tránh động vào văn bản có nhắc tới /uploads
const UPLOAD_JSON_VALUE = /"((?:https?:\/\/[^"/]+)?)(\/uploads\/[^"?#]+|\/api\/v1\/storage\/files\/[^"?#/]+)"/g;

export const signUploadUrlsInResponse = (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (body === undefined || body === null) return originalJson(body);
    let text;
    try {
      text = JSON.stringify(body);
    } catch {
      return originalJson(body);
    }
    // Gửi luôn chuỗi đã có, không để res.json stringify lại lần nữa (danh sách lớn tốn gấp đôi bộ nhớ)
    const sendText = (payload) => {
      if (!res.get("Content-Type")) res.set("Content-Type", "application/json; charset=utf-8");
      return res.send(payload);
    };
    if (!text || !(text.includes("/uploads/") || text.includes("/api/v1/storage/files/"))) return sendText(text);
    return sendText(text.replace(UPLOAD_JSON_VALUE, (_, origin, filePath) => `"${origin}${signUploadPath(filePath)}"`));
  };
  next();
};

const isValidSignature = (filePath, expires, provided) => {
  const expected = Buffer.from(computeSignature(filePath, expires));
  const actual = Buffer.from(provided);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

const SIGNED_FILE_SUFFIX = /((?:\/uploads\/|\/api\/v1\/storage\/files\/)[^?#]*)\?exp=(\d+)&sig=([\w-]+)$/;

const INTERNAL_FILE_URL = /^(?:https?:\/\/[^/?#]+)?(\/uploads\/[^?#]+|\/api\/v1\/storage\/files\/[^/?#]+)$/i;

// mentioned: mọi đường dẫn tệp nội bộ xuất hiện NGUYÊN GIÁ TRỊ trong body (đã ký hay chưa)
const stripSignature = (value, verifiedPaths, mentioned) => {
  if (typeof value === "string") {
    const stripped = value.replace(SIGNED_FILE_SUFFIX, (_, filePath, exp, sig) => {
      const expires = Number(exp);
      if (expires >= Date.now() && isValidSignature(filePath, expires, sig)) verifiedPaths.add(filePath);
      return filePath;
    });
    const internal = stripped.trim().match(INTERNAL_FILE_URL);
    if (internal) mentioned.add(internal[1]);
    return stripped;
  }
  if (Array.isArray(value)) return value.map((item) => stripSignature(item, verifiedPaths, mentioned));
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    for (const key of Object.keys(value)) value[key] = stripSignature(value[key], verifiedPaths, mentioned);
  }
  return value;
};

/**
 * Chống "signing oracle": phản hồi tự ký mọi giá trị là đường dẫn tệp (signUploadUrlsInResponse), nên trước đây
 * client gửi một đường dẫn tùy ý (vd. đặt tên hồ sơ = "/uploads/<tệp người khác>") là nhận lại link đã ký và tải được tệp.
 * Đường dẫn tệp nội bộ trong body chỉ hợp lệ khi kèm chữ ký còn hạn do chính máy chủ cấp cho người gọi.
 * Link hết hạn (trang mở quá 12 giờ) cũng bị từ chối: tải lại trang để nhận link mới.
 */
export const stripUploadSignatures = (req, res, next) => {
  req.signedFilePaths = new Set();
  const mentioned = new Set();
  if (req.body && typeof req.body === "object") req.body = stripSignature(req.body, req.signedFilePaths, mentioned);
  for (const filePath of mentioned) {
    if (!req.signedFilePaths.has(filePath)) {
      return res.status(403).json({
        success: false,
        code: "UPLOAD_LINK_INVALID",
        message: "Liên kết tệp không hợp lệ hoặc đã hết hạn, vui lòng tải lại trang.",
      });
    }
  }
  next();
};

/**
 * Ảnh client gửi để máy chủ tự đọc từ đĩa thì không đi qua kiểm tra chữ ký của route tệp.
 * Vì vậy tệp trong hệ thống phải là link đã ký mà API cấp cho người gọi. URL bên ngoài giữ nguyên để
 * loadImageBuffer kiểm tra SSRF. Trả 403 vì 401 sẽ bị hiểu nhầm là hết phiên đăng nhập.
 */
export const resolveClientImageUrl = (req, imageUrl) => {
  const value = typeof imageUrl === "string" ? imageUrl.trim() : "";
  const internal = value.match(INTERNAL_FILE_URL);
  if (!internal) return value;
  if (!req.signedFilePaths?.has(internal[1])) {
    const err = new Error("Liên kết ảnh không hợp lệ hoặc đã hết hạn, vui lòng tải lại trang.");
    err.statusCode = 403;
    throw err;
  }
  return internal[1];
};

// Tệp lưu trong kho: có link đã ký thì không cần token, không có thì đi qua đăng nhập như thường
export const allowSignedStorageFile = (protect) => (req, res, next) => {
  if (!req.query?.sig) return protect(req, res, next);
  return checkSignature(`/api/v1/storage/files/${req.params.fileId}`, req, res, () => {
    req.signedFileAccess = true;
    next();
  });
};

// Gắn tại mount "/uploads" nên req.path là phần sau /uploads
export const requireSignedUpload = (req, res, next) => checkSignature(`/uploads${req.path}`, req, res, next);

const checkSignature = (filePath, req, res, next) => {
  const expires = Number(req.query?.exp);
  const provided = String(req.query?.sig || "");
  if (!Number.isFinite(expires) || !provided) {
    return res.status(401).json({ success: false, message: "Thiếu chữ ký truy cập tệp." });
  }
  if (expires < Date.now()) {
    return res.status(401).json({ success: false, code: "UPLOAD_LINK_EXPIRED", message: "Liên kết tệp đã hết hạn, vui lòng tải lại trang." });
  }
  if (!isValidSignature(filePath, expires, provided)) {
    return res.status(401).json({ success: false, message: "Chữ ký truy cập tệp không hợp lệ." });
  }
  res.setHeader("Cache-Control", "private, max-age=3600");
  next();
};
