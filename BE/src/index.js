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
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// 4. Khử độc NoSQL Injection trên toàn bộ req.body, req.query, req.params
app.use(sanitizeNoSql);

// 5. Cổng bảo vệ thư mục /uploads: chặn tải trực tiếp file sao lưu (.json), mã lệnh và path traversal
app.use("/uploads", secureUploadsProtection, express.static(path.join(__dirname, "../uploads")));

// 6. Rate Limiters chống Brute-Force & Credential Stuffing
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
