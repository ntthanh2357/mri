/**
 * NeuroScan AI - Secure Uploads Static Gatekeeper Middleware
 * Intercepts requests to /uploads to prevent direct public access to database backups,
 * doctor licenses, executable scripts, and sensitive configuration files.
 */

import path from "path";

const BLOCKED_EXTENSIONS = [
  ".json",
  ".bak",
  ".sql",
  ".env",
  ".config",
  ".php",
  ".sh",
  ".bat",
  ".exe",
  ".py",
  ".js",
  ".html",
  ".htm",
  ".svg", // Prevents SVG with embedded JS (Stored XSS)
];

const BLOCKED_DIRECTORIES = [
  "/backups",
  "/licenses",
  "/private",
  "/configs",
];

export const secureUploadsProtection = (req, res, next) => {
  const requestUrl = decodeURIComponent(req.path || req.url || "").toLowerCase();

  // 1. Chặn tấn công duyệt thư mục ngược (Path Traversal: ../)
  if (requestUrl.includes("..") || requestUrl.includes("./")) {
    console.warn(`[SECURITY ALERT] Path traversal attempt blocked on /uploads: ${requestUrl}`);
    return res.status(403).json({
      success: false,
      status: "error",
      message: "Truy cập bị từ chối do phát hiện đường dẫn không hợp lệ.",
    });
  }

  // 2. Chặn tuyệt đối truy cập vào các thư mục sao lưu và chứng chỉ nội bộ
  for (const dir of BLOCKED_DIRECTORIES) {
    if (requestUrl.startsWith(dir) || requestUrl.includes(dir)) {
      console.warn(`[SECURITY ALERT] Unauthorized access attempt to restricted upload directory: ${requestUrl}`);
      return res.status(403).json({
        success: false,
        status: "error",
        message: "Truy cập thư mục dữ liệu nhạy cảm bị nghiêm cấm vì lý do bảo mật an toàn y tế.",
      });
    }
  }

  // 3. Chặn tải trực tiếp các tệp có đuôi nhạy cảm (CSDL, code, script)
  const ext = path.extname(requestUrl);
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    console.warn(`[SECURITY ALERT] Unauthorized file extension requested on /uploads: ${requestUrl}`);
    return res.status(403).json({
      success: false,
      status: "error",
      message: "Loại tệp tin này không được phép truy cập trực tiếp qua giao diện công khai.",
    });
  }

  next();
};
