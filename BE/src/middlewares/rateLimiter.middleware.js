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

export const createRateLimiter = ({
  windowMs = 60 * 1000, // 1 minute window
  maxRequests = 10,     // Max requests per window
  message = "Bạn đã thực hiện quá nhiều yêu cầu. Vui lòng thử lại sau.",
  skip = () => false,
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
    const key = `${ip}:${routeKey}${accountIdentifier}`;
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
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: "Quá nhiều lần thử xác thực hoặc đăng nhập thất bại.",
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
