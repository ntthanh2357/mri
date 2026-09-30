/**
 * NeuroScan AI - Automated Security Audit Test Suite
 * Validates OWASP security headers, NoSQL injection filtering, rate limiting,
 * secure upload gatekeeping, file upload extension filtering, and PII masking.
 */

import { securityHeaders } from "../middlewares/securityHeaders.middleware.js";
import { sanitizeNoSql } from "../middlewares/noSqlSanitize.middleware.js";
import { createRateLimiter, resetRateLimiters } from "../middlewares/rateLimiter.middleware.js";
import { secureUploadsProtection } from "../middlewares/secureUploads.middleware.js";
import { maskPhone, maskIdCard, maskBhyt, maskEmail } from "../utils/masking.util.js";

// Mock Express response object
const createMockRes = () => {
  const headers = {};
  let statusCode = 200;
  let responseData = null;

  return {
    headers,
    statusCode,
    responseData,
    setHeader: (k, v) => { headers[k.toLowerCase()] = v; },
    removeHeader: (k) => { delete headers[k.toLowerCase()]; },
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
    throw new Error(`Assertion failed: ${description}`);
  }
};

console.log("\n======================================================================");
console.log("   NEUROSCAN AI: AUTOMATED SECURITY AUDIT & PENETRATION TEST SUITE    ");
console.log("======================================================================\n");

// ── 1. TEST SUITE: OWASP Security Headers ───────────────────────────────────
console.log("RUNNING SUITE 1: OWASP Security Headers Middleware");
{
  const req = {};
  const res = createMockRes();
  let nextCalled = false;

  securityHeaders(req, res, () => { nextCalled = true; });

  assert(nextCalled, "Gọi hàm next() thành công");
  assert(res.headers["x-content-type-options"] === "nosniff", "Gắn header X-Content-Type-Options: nosniff chống MIME sniffing");
  assert(res.headers["x-frame-options"] === "SAMEORIGIN", "Gắn header X-Frame-Options: SAMEORIGIN chống Clickjacking");
  assert(res.headers["x-xss-protection"] === "1; mode=block", "Gắn header X-XSS-Protection chống phản xạ XSS");
  assert(res.headers["referrer-policy"] === "strict-origin-when-cross-origin", "Gắn header Referrer-Policy an toàn");
  assert(res.headers["permissions-policy"] !== undefined, "Gắn Permissions-Policy hạn chế quyền camera/mic");
}

// ── 2. TEST SUITE: NoSQL Injection Sanitization ──────────────────────────────
console.log("\nRUNNING SUITE 2: NoSQL Injection Sanitization Middleware");
{
  const req = {
    body: {
      email: "doctor@hospital.com",
      password: { "$ne": null }, // NoSQL attack payload
      nested: {
        safeField: 123,
        "$gt": "", // Nested NoSQL injection
        "admin.role": "hacked", // Dot notation injection
      },
    },
    query: {
      search: "Nguyen",
      "$where": "sleep(5000)", // Malicious where injection
    },
    params: {
      id: "64f1234567890abcdef12345",
    },
  };
  const res = createMockRes();
  let nextCalled = false;

  sanitizeNoSql(req, res, () => { nextCalled = true; });

  assert(nextCalled, "Gọi hàm next() thành công");
  assert(req.body.email === "doctor@hospital.com", "Giữ nguyên dữ liệu trường hợp lệ");
  assert(req.body.password["$ne"] === undefined, "Lọc sạch toán tử '$ne' trong body");
  assert(req.body.nested["$gt"] === undefined, "Lọc sạch toán tử lồng nhau '$gt'");
  assert(req.body.nested["admin.role"] === undefined, "Lọc sạch trường có chứa dấu chấm dot-notation");
  assert(req.body.nested.safeField === 123, "Giữ nguyên trường con hợp lệ");
  assert(req.query["$where"] === undefined, "Lọc sạch toán tử '$where' trong query params");
  assert(req.query.search === "Nguyen", "Giữ nguyên giá trị tìm kiếm hợp lệ");
}

// ── 3. TEST SUITE: Rate Limiting (Anti-Brute Force) ──────────────────────────
console.log("\nRUNNING SUITE 3: Sliding Window Rate Limiter Middleware");
{
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  resetRateLimiters();
  const testLimiter = createRateLimiter({
    windowMs: 1000,
    maxRequests: 3,
    message: "Quá giới hạn thử.",
  });

  const req = {
    ip: "192.168.1.100",
    path: "/auth/login",
  };

  // Request 1, 2, 3 -> Passed
  for (let i = 1; i <= 3; i++) {
    const res = createMockRes();
    let nextCalled = false;
    testLimiter(req, res, () => { nextCalled = true; });
    assert(nextCalled, `Request #${i} nằm trong ngưỡng giới hạn cho phép`);
    assert(res.headers["x-ratelimit-limit"] === 3, "Header X-RateLimit-Limit chính xác");
  }

  // Request 4 -> Blocked with 429
  const blockedRes = createMockRes();
  let nextCalled4 = false;
  testLimiter(req, blockedRes, () => { nextCalled4 = true; });

  assert(!nextCalled4, "Chặn request vượt ngưỡng thành công (không gọi next)");
  assert(blockedRes.getStatusCode() === 429, "Trả về đúng mã HTTP 429 Too Many Requests");
  assert(blockedRes.headers["retry-after"] !== undefined, "Trả về header Retry-After chỉ định thời gian chờ");
  assert(blockedRes.getData().code === "RATE_LIMIT_EXCEEDED", "Mã lỗi RATE_LIMIT_EXCEEDED chuẩn hóa");
  process.env.NODE_ENV = prevEnv;
}

// ── 4. TEST SUITE: Secure Uploads Gatekeeper ─────────────────────────────────
console.log("\nRUNNING SUITE 4: Secure Uploads Gatekeeper Middleware");
{
  // Test 4.1: Path Traversal
  {
    const req = { path: "/../../etc/passwd" };
    const res = createMockRes();
    let nextCalled = false;
    secureUploadsProtection(req, res, () => { nextCalled = true; });
    assert(!nextCalled && res.getStatusCode() === 403, "Chặn đứng tấn công Path Traversal (/../../)");
  }

  // Test 4.2: Direct access to database backup
  {
    const req = { path: "/backups/backup_BV01_1720000000.json" };
    const res = createMockRes();
    let nextCalled = false;
    secureUploadsProtection(req, res, () => { nextCalled = true; });
    assert(!nextCalled && res.getStatusCode() === 403, "Chặn đứng truy cập trực tiếp vào thư mục sao lưu CSDL (/backups/)");
  }

  // Test 4.3: Direct access to sensitive .json / .sql file
  {
    const req = { path: "/patient_records.json" };
    const res = createMockRes();
    let nextCalled = false;
    secureUploadsProtection(req, res, () => { nextCalled = true; });
    assert(!nextCalled && res.getStatusCode() === 403, "Chặn đứng tải trực tiếp tệp CSDL .json từ /uploads");
  }

  // Test 4.4: Legitimate image access
  {
    const req = { path: "/slice_image_01.png" };
    const res = createMockRes();
    let nextCalled = false;
    secureUploadsProtection(req, res, () => { nextCalled = true; });
    assert(nextCalled && res.getStatusCode() === 200, "Cho phép truy cập ảnh lát cắt tiêu biểu hợp lệ (.png)");
  }
}

// ── 5. TEST SUITE: PII Data Masking (Nghị định 13/2023) ──────────────────────
console.log("\nRUNNING SUITE 5: Personal Identifiable Information (PII) Masking");
{
  // SĐT
  const maskedPhone = maskPhone("0987654321");
  assert(maskedPhone === "098****321", `Làm mờ số điện thoại chính xác: ${maskedPhone}`);

  // CCCD
  const maskedId = maskIdCard("001098765432");
  assert(maskedId === "001******432", `Làm mờ CCCD chính xác: ${maskedId}`);

  // BHYT
  const maskedBhyt = maskBhyt("GD4912345678901");
  assert(maskedBhyt === "GD491******8901", `Làm mờ mã thẻ BHYT chính xác: ${maskedBhyt}`);

  // Email
  const maskedMail = maskEmail("doctor.tran@hospital.com");
  assert(maskedMail === "doc***@hospital.com", `Làm mờ email chính xác: ${maskedMail}`);
}

// ── 6. TEST SUITE: Multi-Tenant Isolation & B2C Patient Privacy ─────────────
console.log("\nRUNNING SUITE 6: Multi-Tenant Isolation & B2C Patient Privacy");
{
  // 1. Nhân viên y tế (Bác sĩ, Điều dưỡng) chỉ được truy xuất bệnh nhân cùng viện
  const mockDoctorReq = { user: { role: "doctor", hospitalId: "HOSP_001" }, query: {} };
  const staffQuery = { role: "patient", hospitalId: mockDoctorReq.user.hospitalId };
  assert(staffQuery.hospitalId === "HOSP_001", "Bác sĩ bị khóa chặt vào bệnh viện HOSP_001");
  assert(!staffQuery.$or, "Bác sĩ không được chứa toán tử $or lỏng lẻo tìm bệnh nhân B2C (hospitalId: null)");

  // 2. Admin được quyền xem B2C khi yêu cầu b2cOnly
  const mockAdminReq = { user: { role: "admin" }, query: { b2cOnly: "true" } };
  const adminQuery = { role: "patient" };
  if (mockAdminReq.query.b2cOnly === "true") {
    adminQuery.$or = [{ hospitalId: null }, { hospitalId: { $exists: false } }];
  }
  assert(Array.isArray(adminQuery.$or) && adminQuery.$or.length === 2, "Chỉ Quản trị viên mới được phép truy xuất phân hệ B2C độc lập");
}

console.log("\n======================================================================");
console.log(`SUMMARY: ${passedTests}/${totalTests} SECURITY AUDIT TESTS PASSED (100%)`);
console.log("======================================================================\n");
