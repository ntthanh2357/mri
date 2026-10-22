import { authRateLimiter, resetRateLimiters } from '../middlewares/rateLimiter.middleware.js';

/**
 * [FIX 0014] Rate limit phiên làm việc:
 *  - GET /auth/me và POST /auth/refresh KHÔNG bị giới hạn (FE gọi /auth/me
 *    3 lần mỗi lần chuyển màn → ngưỡng 10/phút/IP đá user hợp lệ, màn báo
 *    sai "Phiên hết hạn", dashboard hiển thị 0 im lặng).
 *  - Các route brute-force (login, verify-2fa...) vẫn bị giới hạn đầy đủ.
 */

const createMockRes = () => {
  const ctx = { statusCode: 200, headers: {}, body: null };
  const res = {
    setHeader(k, v) { ctx.headers[String(k).toLowerCase()] = v; },
    status(code) {
      ctx.statusCode = code;
      return { json(payload) { ctx.body = payload; } };
    },
  };
  return [res, ctx];
};

const fire = (limiter, req) => {
  const [res, ctx] = createMockRes();
  let nextCalled = false;
  limiter(req, res, () => { nextCalled = true; });
  return { nextCalled, ctx };
};

describe('Rate limit phiên làm việc — /auth/me & /auth/refresh miễn giới hạn, brute-force giữ nguyên (FIX 0014)', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'production'; // kích hoạt rate limiter như môi trường thật
    resetRateLimiters();
  });

  afterAll(() => {
    process.env.NODE_ENV = 'development';
    resetRateLimiters();
  });

  it('GET /auth/me gọi 20 lần liên tiếp vẫn qua — FE gọi 3 lần/chuyển màn không còn bị 429', () => {
    for (let i = 1; i <= 20; i++) {
      const { nextCalled, ctx } = fire(authRateLimiter, {
        method: 'GET',
        path: '/me',
        ip: '10.0.0.1',
      });
      if (!nextCalled) {
        throw new Error(`Lần thứ ${i} bị chặn với mã ${ctx.statusCode} — /auth/me phải được skip`);
      }
    }
  });

  it('GET /auth/me dạng "/me/" (trailing slash) vẫn được skip', () => {
    const { nextCalled } = fire(authRateLimiter, {
      method: 'GET',
      path: '/me/',
      ip: '10.0.0.1',
    });
    if (!nextCalled) throw new Error('path "/me/" phải được skip như "/me"');
  });

  it('POST /auth/refresh gọi 20 lần liên tiếp vẫn qua — làm mới token không bị chặn', () => {
    for (let i = 1; i <= 20; i++) {
      const { nextCalled, ctx } = fire(authRateLimiter, {
        method: 'POST',
        path: '/refresh',
        ip: '10.0.0.1',
      });
      if (!nextCalled) {
        throw new Error(`Lần thứ ${i} bị chặn với mã ${ctx.statusCode} — /auth/refresh phải được skip`);
      }
    }
  });

  it('POST /auth/login vẫn bị giới hạn 10 lần/phút — chống brute-force giữ nguyên', () => {
    for (let i = 1; i <= 10; i++) {
      const { nextCalled } = fire(authRateLimiter, {
        method: 'POST',
        path: '/login',
        body: { email: 'triso@neuroscan.com' },
        ip: '10.0.0.2',
      });
      if (!nextCalled) throw new Error(`Lần hợp lệ thứ ${i} phải được qua`);
    }
    const blocked = fire(authRateLimiter, {
      method: 'POST',
      path: '/login',
      body: { email: 'triso@neuroscan.com' },
      ip: '10.0.0.2',
    });
    if (blocked.nextCalled) throw new Error('Lần thứ 11 phải bị chặn — brute-force protection bị mất!');
    if (blocked.ctx.statusCode !== 429) {
      throw new Error(`Phải trả HTTP 429, nhận ${blocked.ctx.statusCode}`);
    }
    if (blocked.ctx.body?.code !== 'RATE_LIMIT_EXCEEDED') {
      throw new Error('Phải trả code RATE_LIMIT_EXCEEDED');
    }
  });

  it('POST /auth/verify-2fa vẫn bị giới hạn — đoán OTP bằng brute-force vẫn bị chặn', () => {
    for (let i = 1; i <= 10; i++) {
      const { nextCalled } = fire(authRateLimiter, {
        method: 'POST',
        path: '/verify-2fa',
        body: { email: 'triso@neuroscan.com' },
        ip: '10.0.0.3',
      });
      if (!nextCalled) throw new Error(`Lần hợp lệ thứ ${i} phải được qua`);
    }
    const blocked = fire(authRateLimiter, {
      method: 'POST',
      path: '/verify-2fa',
      body: { email: 'triso@neuroscan.com' },
      ip: '10.0.0.3',
    });
    if (blocked.nextCalled) throw new Error('Lần thứ 11 phải bị chặn — đoán OTP phải bị giới hạn');
    if (blocked.ctx.statusCode !== 429) {
      throw new Error(`Phải trả HTTP 429, nhận ${blocked.ctx.statusCode}`);
    }
  });

  it('GET /auth/profile (PUT-info endpoint khác) không nằm trong danh sách skip — vẫn được đếm', () => {
    // PUT /auth/profile không skip → request thứ 11 từ cùng IP bị chặn
    for (let i = 1; i <= 10; i++) {
      const { nextCalled } = fire(authRateLimiter, {
        method: 'PUT',
        path: '/profile',
        ip: '10.0.0.4',
      });
      if (!nextCalled) throw new Error(`Lần hợp lệ thứ ${i} phải được qua`);
    }
    const blocked = fire(authRateLimiter, {
      method: 'PUT',
      path: '/profile',
      ip: '10.0.0.4',
    });
    if (blocked.nextCalled) throw new Error('PUT /profile lần 11 phải bị chặn (không thuộc skip list)');
  });
});
