/**
 * Nạp ảnh từ nguồn do client cung cấp một cách AN TOÀN (P0-5).
 *
 * Trước đây controller ghép `path.join(__dirname, "../../..", imageUrl)` và gọi `fetch(imageUrl)`
 * trực tiếp → cho phép path traversal đọc file hệ thống và SSRF vào mạng nội bộ / metadata cloud.
 *
 * Quy tắc:
 *  - Chỉ chấp nhận đường dẫn nội bộ dạng `/uploads/<file>` nằm trong thư mục uploads.
 *  - URL http(s) phải trỏ ra Internet công cộng (chặn loopback, private, link-local, .internal).
 *  - Giới hạn kích thước và bắt buộc Content-Type là ảnh.
 */
import fs from "fs";
import path from "path";
import dns from "dns/promises";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");
export const MAX_REMOTE_IMAGE_BYTES = 50 * 1024 * 1024; // 50MB / ảnh

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./, // link-local + cloud metadata 169.254.169.254
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^\[?::1\]?$/,
  /^\[?fc00:/i,
  /^\[?fd[0-9a-f]{2}:/i,
  /^\[?fe80:/i,
  /\.internal$/i,
  /\.local$/i,
];

export const isPrivateHostname = (hostname = "") => {
  const host = String(hostname).trim().toLowerCase().replace(/^\[|\]$/g, "");
  return PRIVATE_HOST_PATTERNS.some((re) => re.test(host));
};

/** IP sau khi phân giải DNS cũng phải kiểm tra (chặn DNS trỏ về mạng nội bộ). */
export const isPrivateIp = (address = "") => {
  let ip = String(address).trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (ip.startsWith("::ffff:")) ip = ip.slice("::ffff:".length); // IPv4-mapped IPv6
  return [
    /^127\./, /^0\./, /^10\./, /^192\.168\./, /^169\.254\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^::$/, /^::1$/, /^fc00:/i, /^fd[0-9a-f]{2}:/i, /^fe80:/i,
  ].some((re) => re.test(ip));
};

/**
 * Chặn SSRF kể cả khi tên miền công khai được cấu hình trỏ về IP nội bộ (DNS rebinding đơn giản).
 * Ném lỗi 400 nếu bất kỳ bản ghi nào của tên miền là IP nội bộ.
 */
export const assertPublicHostname = async (hostname) => {
  const host = String(hostname || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || isPrivateHostname(host)) {
    const err = new Error("Không cho phép tải ảnh từ địa chỉ mạng nội bộ hoặc giao thức không hợp lệ.");
    err.statusCode = 400;
    throw err;
  }

  let records;
  try {
    records = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    const err = new Error("Không phân giải được tên miền của ảnh.");
    err.statusCode = 400;
    throw err;
  }
  if (records.length === 0 || records.some((r) => isPrivateIp(r.address))) {
    const err = new Error("Không cho phép tải ảnh từ địa chỉ mạng nội bộ hoặc giao thức không hợp lệ.");
    err.statusCode = 400;
    throw err;
  }
};

/** `/uploads/abc.png` → đường dẫn tuyệt đối, luôn nằm trong UPLOADS_DIR (chống path traversal). */
export const resolveLocalUploadPath = (urlPath) => {
  const raw = String(urlPath || "").split("?")[0].split("#")[0];
  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    const err = new Error("Đường dẫn hình ảnh không hợp lệ.");
    err.statusCode = 400;
    throw err;
  }
  if (decoded.includes("\0")) {
    const err = new Error("Đường dẫn hình ảnh không hợp lệ.");
    err.statusCode = 400;
    throw err;
  }
  if (!decoded.startsWith("/uploads/")) {
    const err = new Error("Đường dẫn hình ảnh không hợp lệ.");
    err.statusCode = 400;
    throw err;
  }
  const absolutePath = path.resolve(UPLOADS_DIR, `.${decoded.slice("/uploads".length)}`);
  if (absolutePath !== UPLOADS_DIR && !absolutePath.startsWith(UPLOADS_DIR + path.sep)) {
    const err = new Error("Đường dẫn hình ảnh không hợp lệ.");
    err.statusCode = 400;
    throw err;
  }
  return absolutePath;
};

/**
 * Trả về { buffer, fileName, mimeType } cho ảnh cần phân tích AI.
 * Ném lỗi có `statusCode` để controller trả đúng mã HTTP.
 */
export const loadImageBuffer = async (imageUrl, { maxBytes = MAX_REMOTE_IMAGE_BYTES } = {}) => {
  const value = typeof imageUrl === "string" ? imageUrl.trim() : "";
  if (!value) {
    const err = new Error("Thiếu đường dẫn hình ảnh cần phân tích.");
    err.statusCode = 400;
    throw err;
  }

  // ── 1. Tệp nội bộ trong thư mục uploads ────────────────────────────────
  if (value.startsWith("/uploads/")) {
    const absolutePath = resolveLocalUploadPath(value);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      const err = new Error(`Không tìm thấy tệp ảnh tại đường dẫn cục bộ: ${value}`);
      err.statusCode = 404;
      throw err;
    }
    if (fs.statSync(absolutePath).size > maxBytes) {
      const err = new Error("Tệp ảnh vượt quá dung lượng cho phép để phân tích AI.");
      err.statusCode = 413;
      throw err;
    }
    const fileName = path.basename(absolutePath);
    const ext = path.extname(fileName).toLowerCase();
    return {
      buffer: fs.readFileSync(absolutePath),
      fileName,
      mimeType: ext === ".png" ? "image/png" : "image/jpeg",
    };
  }

  // ── 2. URL công khai (Firebase/Google Storage...) ──────────────────────
  if (!/^https?:\/\//i.test(value)) {
    const err = new Error("Đường dẫn hình ảnh không hợp lệ.");
    err.statusCode = 400;
    throw err;
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    const err = new Error("Đường dẫn hình ảnh không hợp lệ.");
    err.statusCode = 400;
    throw err;
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    const err = new Error("Không cho phép tải ảnh từ địa chỉ mạng nội bộ hoặc giao thức không hợp lệ.");
    err.statusCode = 400;
    throw err;
  }
  // Kiểm tra cả tên miền lẫn IP sau phân giải DNS (chống SSRF qua DNS nội bộ)
  await assertPublicHostname(url.hostname);

  const allowlist = String(process.env.AI_IMAGE_HOST_ALLOWLIST || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.length > 0 && !allowlist.some((h) => url.hostname.toLowerCase() === h || url.hostname.toLowerCase().endsWith(`.${h}`))) {
    const err = new Error("Tên miền của ảnh không nằm trong danh sách cho phép.");
    err.statusCode = 400;
    throw err;
  }

  const downloadRes = await fetch(value, { redirect: "follow", signal: AbortSignal.timeout(15000) });

  // Chặn redirect dẫn tới mạng nội bộ
  try {
    const finalUrl = new URL(downloadRes.url || value);
    await assertPublicHostname(finalUrl.hostname);
  } catch (e) {
    if (e.statusCode) throw e;
  }

  if (!downloadRes.ok) {
    const err = new Error(`Tải ảnh từ URL thất bại với mã trạng thái ${downloadRes.status}`);
    err.statusCode = 400;
    throw err;
  }

  const contentType = (downloadRes.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("image/")) {
    const err = new Error("URL không trả về tệp ảnh hợp lệ.");
    err.statusCode = 400;
    throw err;
  }

  const contentLength = Number(downloadRes.headers.get("content-length") || 0);
  if (contentLength && contentLength > maxBytes) {
    const err = new Error("Tệp ảnh vượt quá dung lượng cho phép để phân tích AI.");
    err.statusCode = 413;
    throw err;
  }

  const arrayBuffer = await downloadRes.arrayBuffer();
  if (arrayBuffer.byteLength > maxBytes) {
    const err = new Error("Tệp ảnh vượt quá dung lượng cho phép để phân tích AI.");
    err.statusCode = 413;
    throw err;
  }

  return {
    buffer: Buffer.from(arrayBuffer),
    fileName: path.basename(url.pathname) || "scan.jpg",
    mimeType: contentType.split(";")[0],
  };
};
