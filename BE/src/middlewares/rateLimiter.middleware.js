/**
 * NeuroScan AI - Sliding Window Rate Limiter Middleware
 * Protects authentication, OTP verification, and patient queries from Brute-force & Credential Stuffing.
 * Zero-dependency, memory-safe, automatic eviction.
 */

class MemoryStore {
  constructor() {
    this.hits = new Map();
    // Cleanup expired entries every 2 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 2 * 60 * 1000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref(); // Don't block Node process exit
    }
  }

  getRecord(key) {
    return this.hits.get(key);
  }

  setRecord(key, record) {
    this.hits.set(key, record);
  }

  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.hits.entries()) {
      if (now > record.resetTime) {
        this.hits.delete(key);
      }
    }
  }

  reset() {
    this.hits.clear();
  }
}

const defaultStore = new MemoryStore();

/**
 * Khoá đếm theo người được cấp link tải (uid trong token, chưa kiểm chữ ký — chỉ để đếm; token giả bị từ chối ở bước kiểm sau,
 * rẻ, trước khi gửi file). Không tin IP vì IP lấy từ header X-Forwarded-For do client tự gửi.
 */
export const tokenUserKey = (prefix) => (req, ip) => {
  try {
    const part = String(req.params?.token || "").split(".")[1] || "";
    const uid = JSON.parse(Buffer.from(part, "base64url").toString("utf8"))?.uid;
    return `${prefix}:${typeof uid === "string" && uid.length <= 64 ? uid : ip}`;
  } catch {
    return `${prefix}:${ip}`;
  }
};

export const createRateLimiter = ({
  windowMs = 60 * 1000, // 1 minute window
  maxRequests = 10,     // Max requests per window
  message = "Bạn đã thực hiện quá nhiều yêu cầu. Vui lòng thử lại sau.",
  skip = () => false,
  keyGenerator = null, // (req, ip) => string — khoá đếm riêng; mặc định: IP + baseUrl (+ email)
}) => {
  return (req, res, next) => {
    // Kích hoạt khi ở production hoặc khi có biến ENABLE_RATE_LIMIT=true
    const isRateLimitActive = process.env.NODE_ENV === "production" || process.env.ENABLE_RATE_LIMIT === "true";
    if (!isRateLimitActive || skip(req)) {
      return next();
    }

    const rawIp = req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || req.ip || "unknown-ip";
    const ip = typeof rawIp === "string" ? rawIp.split(",")[0].trim() : "unknown-ip";
    const routeKey = req.baseUrl || req.path || "";
    // Chống tấn công dò mật khẩu phân tán: kết hợp IP + Email (nếu có)
    const accountIdentifier = req.body?.email ? `:${req.body.email.toLowerCase().trim()}` : "";
    const key = keyGenerator ? String(keyGenerator(req, ip)) : `${ip}:${routeKey}${accountIdentifier}`;
    const now = Date.now();

    let record = defaultStore.getRecord(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      defaultStore.setRecord(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, maxRequests - record.count);
    const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetTime / 1000));

    if (record.count > maxRequests) {
      res.setHeader("Retry-After", retryAfterSec);
      return res.status(429).json({
        success: false,
        status: "error",
        code: "RATE_LIMIT_EXCEEDED",
        message: `${message} Vui lòng thử lại sau ${retryAfterSec} giây.`,
        retryAfter: retryAfterSec,
      });
    }

    next();
  };
};

// 1. Giới hạn đăng nhập & OTP: tối đa 10 lần/phút/IP
// [FIX 0014] Bỏ qua 2 endpoint phiên làm việc ĐÃ XÁC THỰC khỏi giới hạn:
//  - GET /auth/me: FE gọi 3 lần mỗi lần chuyển màn hình → ngưỡng 10/phút/IP sẽ đá
//    user đang thao tác bình thường (429 → màn báo sai "Phiên hết hạn", dashboard
//    hiển thị 0 im lặng). Endpoint này đã được bảo vệ bằng JWT (middleware protect).
//  - POST /auth/refresh: làm mới token định kỳ, đã được bảo vệ bằng refreshToken hợp lệ.
// Rate limit chỉ mang ý nghĩa chống brute-force trên các route đoán mật khẩu/OTP:
// login, verify-2fa, resend-2fa, forgot-password, phone-login-*, firebase-login, sso —
// tất cả vẫn bị giới hạn như cũ.
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: "Quá nhiều lần thử xác thực hoặc đăng nhập thất bại.",
  skip: (req) => {
    const p = (req.path || "").replace(/\/+$/, "");
    if (req.method === "GET" && p === "/me") return true;
    if (req.method === "POST" && p === "/refresh") return true;
    return false;
  },
});

// 2. Giới hạn tra cứu cổng bệnh nhân B2C: tối đa 30 lần/phút/IP
export const b2cRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: "Quá nhiều yêu cầu tra cứu từ địa chỉ IP của bạn.",
});

// Hàm hỗ trợ reset cho Unit Tests
export const resetRateLimiters = () => {
  defaultStore.reset();
};
