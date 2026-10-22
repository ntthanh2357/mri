/**
 * [FIX 0014] Phân loại lỗi API cho UI.
 * api client (src/api/client.js) gắn err.status + err.code khi BE trả lỗi —
 * các màn hình dùng helper này để phân biệt:
 *  - "Hệ thống đang bận tạm thời" (429 rate limit) → mời user thử lại, KHÔNG đá ra.
 *  - "Phiên hết hạn" (401/403) → đăng nhập lại.
 * Trước đây HomeScreen bắt mọi lỗi /auth/me đều báo "Phiên đăng nhập đã hết hạn",
 * khiến user bị 429 tạm thời tưởng phiên chết và bị đá khỏi hệ thống.
 */

export const isRateLimitError = (err) =>
  Boolean(
    err &&
      (err.status === 429 ||
        err.code === 'RATE_LIMIT_EXCEEDED' ||
        (typeof err.message === 'string' &&
          (err.message.includes('Quá nhiều lần') ||
            err.message.includes('quá nhiều yêu cầu') ||
            err.message.includes('thử lại sau') ||
            err.message.includes('RATE_LIMIT'))))
  );
