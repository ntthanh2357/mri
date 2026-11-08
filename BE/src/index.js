import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./config/db.js";
import routes from "./routes/index.js";
import { errorHandler } from "./middlewares/error.middleware.js";
// Initialize Firebase config
import "./config/firebase.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

import { securityHeaders } from "./middlewares/securityHeaders.middleware.js";
import { sanitizeNoSql } from "./middlewares/noSqlSanitize.middleware.js";
import { secureUploadsProtection } from "./middlewares/secureUploads.middleware.js";
import { authRateLimiter, b2cRateLimiter } from "./middlewares/rateLimiter.middleware.js";
import { requireSignedUpload, signUploadUrlsInResponse, stripUploadSignatures } from "./middlewares/uploadSignature.middleware.js";
import { requireJwtBeforeLargeBody } from "./middlewares/largeBodyGuard.middleware.js";
import { sanitizeServerErrors } from "./middlewares/sanitizeServerErrors.middleware.js";

// Middlewares
// 1. Gắn HTTP Security Headers chuẩn OWASP (Clickjacking, MIME-Sniffing, XSS)
app.use(securityHeaders);

// 2. CORS - cấu hình whitelist an toàn cho production & dev
const corsOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:8081', 'http://localhost:8083', 'http://localhost:80', 'http://localhost:19006', 'http://localhost:19000'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || corsOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin} không nằm trong danh sách cho phép.`));
    }
  },
  credentials: true,
}));

// 3. Body parsers
// Phân hệ hình ảnh MRI: JSON tới 50MB (ảnh base64 dự phòng); tệp lớn đi multipart hoặc chunked upload.
// Kiểm tra token trước khi đọc body để người chưa đăng nhập không đẩy được body lớn vào bộ nhớ.
app.use("/api/v1/imaging", requireJwtBeforeLargeBody, express.json({ limit: "50mb" }));
app.use("/api/v1/imaging", express.urlencoded({ limit: "50mb", extended: true }));
app.use("/api/v1/imaging-results", requireJwtBeforeLargeBody, express.json({ limit: "50mb" }));
app.use("/api/v1/imaging-results", express.urlencoded({ limit: "50mb", extended: true }));

// Các API thông thường (Auth, EMR, Bệnh nhân...): Giới hạn 20mb để chống tấn công cạn kiệt RAM / JSON Bomb
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

// 3b. Zero-dependency Cookie Parser hỗ trợ HttpOnly Cookie
app.use((req, res, next) => {
  req.cookies = {};
  const cookieHeader = req.headers?.cookie;
  if (cookieHeader) {
    cookieHeader.split(";").forEach((cookie) => {
      const parts = cookie.split("=");
      const name = parts[0]?.trim();
      const val = parts.slice(1).join("=").trim();
      if (name) {
        try {
          req.cookies[name] = decodeURIComponent(val);
        } catch {
          req.cookies[name] = val;
        }
      }
    });
  }
  next();
});

// 4. Khử độc NoSQL Injection trên toàn bộ req.body, req.query, req.params
app.use(sanitizeNoSql);

// 4b. Link tệp y khoa có chữ ký: API trả link đã ký, dữ liệu client gửi lên được bỏ chữ ký trước khi lưu
app.use(stripUploadSignatures);
app.use(signUploadUrlsInResponse);
app.use(sanitizeServerErrors);

// 5. Cổng bảo vệ thư mục /uploads: chặn tải trực tiếp file sao lưu (.json), mã lệnh và path traversal
app.use("/uploads", requireSignedUpload, secureUploadsProtection, express.static(path.join(__dirname, "../uploads")));

// 6. Rate Limiters chống Brute-Force & Credential Stuffing
// Số proxy tin cậy phía trước app (production mặc định 1 = nginx). Sai số này thì req.ip sai,
// và rate limit đếm nhầm toàn bộ người dùng vào IP của nginx hoặc tin IP do client giả.
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? (process.env.NODE_ENV === "production" ? 1 : 0));
if (trustProxyHops > 0) app.set("trust proxy", trustProxyHops);
app.use("/auth", authRateLimiter);
app.use("/api/v1/patient-b2c", b2cRateLimiter);

// Main Router (includes /auth and /api/v1)
app.use("/", routes);

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Kết nối thành công đến API NeuroScan AI (BE)!" });
});

app.get("/ping", (req, res) => {
  res.json({ message: "pong", timestamp: new Date() });
});

// 7. Bắt lỗi 404 cho toàn bộ API không khớp (trả về JSON chuẩn, chống lỗi parse HTML)
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Đường dẫn API '${req.originalUrl}' với phương thức [${req.method}] không tồn tại trên hệ thống.`,
  });
});

// Global Error Handler Middleware
app.use(errorHandler);

import { startBackgroundJobs } from "./jobs/scheduler.js";

// Database connection & start server
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend server is running on http://localhost:${PORT}`);
      startBackgroundJobs();
    });
  })
  .catch((error) => {
    console.error("Database connection failed during boot:", error);
    process.exit(1);
  });
