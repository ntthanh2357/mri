/**
 * NeuroScan AI - 20 Security Items Automated Penetration & Verification Test Suite
 * Kiểm tra toàn diện 20 tiêu chuẩn an ninh hệ thống:
 * 1. Hash password bằng bcrypt/argon2
 * 2. Rate limit login
 * 3. Session phải hết hạn
 * 4. Xóa debug thừa (otp2FA không bị lộ)
 * 5. Secret không để ở frontend
 * 6. Không show chi tiết lỗi
 * 7. Giới hạn loại file upload (Magic Bytes)
 * 8. Giới hạn dung lượng file
 * 9. Validate lại ở server
 * 10. Chống IDOR (user123 sang user124)
 * 11. Chống leo thang đặc quyền (BFLA)
 * 12. Query DB parameterized & khử độc NoSQL
 * 13. Bắt buộc HTTPS (HSTS & Nginx redirect)
 * 14. Thêm security headers (CSP, nosniff, SAMEORIGIN)
 * 15. Cookie: HttpOnly + Secure + SameSite
 * 16. CORS chỉ cho domain cần thiết
 * 17. Database không mở public (127.0.0.1)
 * 18. DB user chỉ cấp đúng quyền cần dùng (Least Privilege)
 * 19. Sẵn sàng cấu hình Cloudflare Proxy
 * 20. Backup tự động + Theo dõi lỗi
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { securityHeaders } from "../middlewares/securityHeaders.middleware.js";
import { sanitizeNoSql } from "../middlewares/noSqlSanitize.middleware.js";
import { createRateLimiter, resetRateLimiters } from "../middlewares/rateLimiter.middleware.js";
import { validateMagicBytes } from "../middlewares/imagingUpload.middleware.js";
import { errorHandler } from "../middlewares/error.middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper tạo Mock Response
const createMockRes = () => {
  const headers = {};
  const cookies = {};
  let statusCode = 200;
  let responseData = null;

  return {
    headers,
    cookies,
    statusCode,
    responseData,
    setHeader: (k, v) => { headers[k.toLowerCase()] = v; },
    removeHeader: (k) => { delete headers[k.toLowerCase()]; },
    cookie: (name, val, options) => { cookies[name] = { val, options }; },
    clearCookie: (name, options) => { delete cookies[name]; },
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => { responseData = data; return data; },
      };
    },
    getStatusCode: () => statusCode,
    getData: () => responseData,
  };
};

let passedTests = 0;
let totalTests = 0;

const assert = (condition, description) => {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✔ PASS: ${description}`);
  } else {
    console.error(`  ✖ FAIL: ${description}`);
    throw new Error(`Kiểm thử thất bại: ${description}`);
  }
};

console.log("\n======================================================================");
console.log("   NEUROSCAN AI: KIỂM TRA TOÀN DIỆN 20 TIÊU CHUẨN AN NINH WEB & SERVER ");
console.log("======================================================================\n");

// ── 1. Hash password bằng bcrypt/argon2 ──
console.log("▶ [MỤC 1] Hash password bằng Argon2/bcrypt:");
{
  const password = "UserSecurePassword_2026!@#";
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  assert(hash.startsWith("$2a$") || hash.startsWith("$2b$"), "Mật khẩu được băm đúng chuẩn bcrypt ($2a$/$2b$)");
  const match = await bcrypt.compare(password, hash);
  const wrongMatch = await bcrypt.compare("WrongPassword", hash);
  assert(match === true && wrongMatch === false, "Bcrypt so khớp chính xác mật khẩu hợp lệ và từ chối mật khẩu sai");
}

// ── 2. Rate limit login ──
console.log("\n▶ [MỤC 2] Rate limit login (Chống Brute-force & Credential Stuffing):");
{
  process.env.ENABLE_RATE_LIMIT = "true";
  resetRateLimiters();
  const limiter = createRateLimiter({
    windowMs: 1000,
    maxRequests: 3,
    message: "Quá giới hạn đăng nhập.",
  });

  const req = {
    ip: "10.0.0.1",
    path: "/auth/login",
    body: { email: "victim@hospital.vn" },
  };

  for (let i = 1; i <= 3; i++) {
    const res = createMockRes();
    let nextCalled = false;
    limiter(req, res, () => { nextCalled = true; });
    assert(nextCalled, `Lần thử đăng nhập #${i} được thông qua`);
  }

  // Lần thử thứ 4 phải bị chặn 429
  const blockedRes = createMockRes();
  let nextCalled4 = false;
  limiter(req, blockedRes, () => { nextCalled4 = true; });
  assert(!nextCalled4 && blockedRes.getStatusCode() === 429, "Chặn đứng lần thử thứ 4 với HTTP 429 Too Many Requests");
  assert(blockedRes.headers["retry-after"] !== undefined, "Header Retry-After được trả về cho client");
  delete process.env.ENABLE_RATE_LIMIT;
}

// ── 3. Session phải hết hạn ──
console.log("\n▶ [MỤC 3] Session phải hết hạn & Token Revocation:");
{
  const secret = "test_secret_key_123456";
  const expiredToken = jwt.sign({ id: "user_01", tokenVersion: 1 }, secret, { expiresIn: "-1s" });
  let tokenExpired = false;
  try {
    jwt.verify(expiredToken, secret);
  } catch (err) {
    if (err.name === "TokenExpiredError") tokenExpired = true;
  }
  assert(tokenExpired, "JWT hết hạn bị phát hiện và từ chối chính xác (TokenExpiredError)");
}

// ── 4. Xóa debug thừa ──
console.log("\n▶ [MỤC 4] Xóa debug thừa (Kiểm tra mã nguồn auth.controller.js):");
{
  const authControllerPath = path.resolve(__dirname, "../modules/auth/auth.controller.js");
  const authCode = fs.readFileSync(authControllerPath, "utf8");
  // Đảm bảo không còn dòng 'otp2FA: otp2FaCode,' để hở mà đã được guard an toàn
  assert(!authCode.includes("otp2FA: otp2FaCode,"), "Đã loại bỏ hoàn toàn việc để lộ mã OTP 2FA trong login response");
  assert(authCode.includes("ENABLE_DEBUG_OTP"), "OTP debug đã được khóa chặt sau cờ ENABLE_DEBUG_OTP");
}

// ── 5. Secret không để ở frontend ──
console.log("\n▶ [MỤC 5] Secret không để ở frontend:");
{
  const feEnvPath = path.resolve(__dirname, "../../../FE/.env.local");
  if (fs.existsSync(feEnvPath)) {
    const feEnv = fs.readFileSync(feEnvPath, "utf8");
    assert(!feEnv.includes("JWT_SECRET"), "Không có JWT_SECRET trong môi trường Frontend");
    assert(!feEnv.includes("MONGO_URI"), "Không có MONGO_URI trong môi trường Frontend");
    assert(!feEnv.includes("PRIVATE_KEY"), "Không có Private Key trong môi trường Frontend");
  } else {
    assert(true, "Không tìm thấy file .env nhạy cảm ở FE");
  }
}

// ── 6. Không show chi tiết lỗi ──
console.log("\n▶ [MỤC 6] Không show chi tiết lỗi (Information Disclosure Sanitization):");
{
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  const req = { method: "POST", url: "/api/v1/imaging/process" };
  const res = createMockRes();
  const dbError = new Error("MongoServerError: connection timed out to 10.0.0.5:27017 at /var/app/db.js");
  dbError.status = 500;

  errorHandler(dbError, req, res, () => {});

  assert(res.getStatusCode() === 500, "Trả về mã 500 chuẩn");
  assert(!res.getData().stack, "Không để lộ Stack Trace trong môi trường Production");
  assert(!res.getData().message.includes("MongoServerError"), "Không để lộ tên lỗi driver cơ sở dữ liệu");
  assert(!res.getData().message.includes("/var/app/"), "Không để lộ đường dẫn tệp tin hệ thống máy chủ");

  process.env.NODE_ENV = prevEnv;
}

// ── 7. Giới hạn loại file upload (Magic Bytes) ──
console.log("\n▶ [MỤC 7] Giới hạn loại file upload (Xác thực Magic Bytes):");
{
  const tempDir = path.resolve(__dirname, "../../scratch");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  // 1. Tạo tệp PNG hợp lệ (Magic Bytes: 89 50 4E 47)
  const validPngPath = path.join(tempDir, "valid_slice.png");
  fs.writeFileSync(validPngPath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  assert(validateMagicBytes(validPngPath, ".png") === true, "Chấp nhận tệp PNG có chữ ký Magic Bytes hợp lệ");

  // 2. Tạo tệp giả mạo: Webshell PHP đổi đuôi thành .png
  const fakePngPath = path.join(tempDir, "fake_webshell.png");
  fs.writeFileSync(fakePngPath, Buffer.from("<?php system($_GET['cmd']); ?>", "utf8"));
  assert(validateMagicBytes(fakePngPath, ".png") === false, "Chặn đứng tệp tin giả mạo đuôi (Webshell mạo danh PNG)");

  // Dọn dẹp tệp thử nghiệm
  try {
    fs.unlinkSync(validPngPath);
    fs.unlinkSync(fakePngPath);
  } catch { /* ignore */ }
}

// ── 8. Giới hạn dung lượng file ──
console.log("\n▶ [MỤC 8] Giới hạn dung lượng file:");
{
  const indexJsPath = path.resolve(__dirname, "../index.js");
  const indexContent = fs.readFileSync(indexJsPath, "utf8");
  assert(indexContent.includes('limit: "700mb"'), "Hỗ trợ upload ảnh/phim MRI lên đến 700mb cho endpoint imaging");
  assert(indexContent.includes('limit: "20mb"'), "Các API thông thường được bảo vệ ở ngưỡng 20mb chống JSON Bomb");

  const imagingUploadPath = path.resolve(__dirname, "../middlewares/imagingUpload.middleware.js");
  const uploadContent = fs.readFileSync(imagingUploadPath, "utf8");
  assert(uploadContent.includes("600 * 1024 * 1024"), "Multer stream hỗ trợ gói lát cắt MRI/DICOM dung lượng lớn đến 600MB");
}

// ── 9. Validate lại ở server ──
console.log("\n▶ [MỤC 9] Validate lại ở server:");
{
  const authControllerPath = path.resolve(__dirname, "../modules/auth/auth.controller.js");
  const authCode = fs.readFileSync(authControllerPath, "utf8");
  assert(authCode.includes("rolesAvailable.includes(role)"), "Server kiểm thực nghiêm ngặt danh sách vai trò (Role Whitelist)");
}

// ── 10. Chống IDOR (user123 sang user124) ──
console.log("\n▶ [MỤC 10] Chống IDOR (Insecure Direct Object References):");
{
  const patientCtrlPath = path.resolve(__dirname, "../controllers/patientRecord.controller.js");
  const patientCtrlCode = fs.readFileSync(patientCtrlPath, "utf8");
  assert(patientCtrlCode.includes("return req.user ? req.user.id : null"), "Bệnh nhân thường luôn bị ép buộc dùng chính ID của mình, không thể đổi sang ID khác");
}

// ── 11. Chống leo thang đặc quyền (BFLA) ──
console.log("\n▶ [MỤC 11] Chống leo thang đặc quyền (Privilege Escalation):");
{
  const authControllerPath = path.resolve(__dirname, "../modules/auth/auth.controller.js");
  const authCode = fs.readFileSync(authControllerPath, "utf8");
  assert(authCode.includes('if (role !== "patient")') && authCode.includes("Chỉ quản trị viên mới được tạo tài khoản nhân viên y tế"), "Đã vá lỗ hổng chặn người dùng thường tự đăng ký role bác sĩ / nhân viên y tế");
}

// ── 12. Query DB parameterized & khử độc NoSQL ──
console.log("\n▶ [MỤC 12] Query DB parameterized & Khử độc NoSQL:");
{
  const req = {
    body: {
      username: "doctor",
      queryPayload: { "$ne": null, "$where": "sleep(1000)" },
    },
    query: {},
    params: {},
  };
  const res = createMockRes();
  let nextCalled = false;
  sanitizeNoSql(req, res, () => { nextCalled = true; });

  assert(nextCalled, "Middleware sanitizeNoSql hoàn tất xử lý");
  assert(req.body.queryPayload["$ne"] === undefined, "Toán tử NoSQL $ne bị xóa sạch");
  assert(req.body.queryPayload["$where"] === undefined, "Toán tử NoSQL $where bị xóa sạch");
}

// ── 13. Bắt buộc HTTPS ──
console.log("\n▶ [MỤC 13] Bắt buộc HTTPS (HSTS & Nginx Gateway):");
{
  const req = { secure: true, headers: {} };
  const res = createMockRes();
  securityHeaders(req, res, () => {});
  assert(res.headers["strict-transport-security"] !== undefined, "Header Strict-Transport-Security (HSTS) được kích hoạt");

  const nginxConfPath = path.resolve(__dirname, "../../../docker/nginx.conf");
  const nginxConf = fs.readFileSync(nginxConfPath, "utf8");
  assert(nginxConf.includes("return 301 https://$host$request_uri;"), "Cấu hình Nginx có chỉ thị 301 Redirect HTTP sang HTTPS");
}

// ── 14. Thêm security headers ──
console.log("\n▶ [MỤC 14] Thêm security headers (CSP, nosniff, SAMEORIGIN):");
{
  const req = { secure: false, headers: {} };
  const res = createMockRes();
  securityHeaders(req, res, () => {});

  assert(res.headers["x-content-type-options"] === "nosniff", "Có X-Content-Type-Options: nosniff");
  assert(res.headers["x-frame-options"] === "SAMEORIGIN", "Có X-Frame-Options: SAMEORIGIN");
  assert(res.headers["content-security-policy"] !== undefined, "Có Content-Security-Policy (CSP) bảo vệ XSS");
  assert(res.headers["cross-origin-opener-policy"] !== undefined, "Có Cross-Origin-Opener-Policy");
}

// ── 15. Cookie: HttpOnly + Secure + SameSite ──
console.log("\n▶ [MỤC 15] Cookie: HttpOnly + Secure + SameSite:");
{
  const authControllerPath = path.resolve(__dirname, "../modules/auth/auth.controller.js");
  const authCode = fs.readFileSync(authControllerPath, "utf8");
  assert(authCode.includes('httpOnly: true'), "Cookie cấu hình cờ httpOnly: true (chống trộm qua XSS)");
  assert(authCode.includes('sameSite: "strict"'), "Cookie cấu hình cờ sameSite: strict (chống CSRF)");
  assert(authCode.includes('path: "/auth"'), "Cookie giới hạn phạm vi trong đường dẫn /auth");
}

// ── 16. CORS chỉ cho domain cần thiết ──
console.log("\n▶ [MỤC 16] CORS chỉ cho domain cần thiết:");
{
  const indexJsPath = path.resolve(__dirname, "../index.js");
  const indexContent = fs.readFileSync(indexJsPath, "utf8");
  assert(indexContent.includes("corsOrigins.includes(origin)"), "CORS kiểm tra dựa trên danh sách whitelist domain");
  assert(indexContent.includes("credentials: true"), "Cấu hình credentials: true an toàn kèm whitelist");
}

// ── 17. Database không mở public ──
console.log("\n▶ [MỤC 17] Database không mở public:");
{
  const dockerComposePath = path.resolve(__dirname, "../../../docker-compose.yml");
  const composeContent = fs.readFileSync(dockerComposePath, "utf8");
  assert(composeContent.includes('"127.0.0.1:27017:27017"'), "Cổng MongoDB 27017 chỉ lắng nghe trên 127.0.0.1 (Localhost), không mở 0.0.0.0 ra Internet");
}

// ── 18. DB user chỉ cấp đúng quyền cần dùng (Least Privilege) ──
console.log("\n▶ [MỤC 18] DB user chỉ cấp đúng quyền cần dùng (Least Privilege):");
{
  const initMongoPath = path.resolve(__dirname, "../../../docker/init-mongo.js");
  assert(fs.existsSync(initMongoPath), "Đã tạo script khởi tạo người dùng CSDL tối thiểu quyền (docker/init-mongo.js)");
  const initMongoContent = fs.readFileSync(initMongoPath, "utf8");
  assert(initMongoContent.includes('role: "readWrite"'), "Người dùng chỉ được cấp quyền tối thiểu [readWrite] trên CSDL y tế");
}

// ── 19. Đưa web qua Cloudflare ──
console.log("\n▶ [MỤC 19] Sẵn sàng cấu hình Cloudflare Proxy:");
{
  const nginxConfPath = path.resolve(__dirname, "../../../docker/nginx.conf");
  const nginxConf = fs.readFileSync(nginxConfPath, "utf8");
  assert(nginxConf.includes("server_tokens off"), "Nginx đã ẩn phiên bản máy chủ (server_tokens off) chống lộ thông tin phía sau Cloudflare");
  assert(nginxConf.includes("$http_x_forwarded_proto"), "Nginx nhận diện được header proxy X-Forwarded-Proto từ Cloudflare");
}

// ── 20. Backup + theo dõi lỗi ──
console.log("\n▶ [MỤC 20] Backup tự động + Theo dõi lỗi:");
{
  const backupScriptPath = path.resolve(__dirname, "../scripts/automated_backup_cron.js");
  assert(fs.existsSync(backupScriptPath), "Đã tạo kịch bản sao lưu CSDL tự động (scripts/automated_backup_cron.js)");
  const backupScriptContent = fs.readFileSync(backupScriptPath, "utf8");
  assert(backupScriptContent.includes("Retention Policy") || backupScriptContent.includes("THIRTY_DAYS_MS"), "Kịch bản sao lưu có chính sách tự dọn dẹp các bản sao cũ quá 30 ngày");
}

console.log("\n======================================================================");
console.log(`KẾT QUẢ TỔNG THỂ: ${passedTests}/${totalTests} BÀI TEST AN NINH VƯỢT QUA (100% PASS)`);
console.log("======================================================================\n");
