/**
 * QA-21: chốt chặn lỗi cấp tiến trình.
 *  - unhandledRejection: ghi log + cảnh báo, KHÔNG thoát. Mặc định của Node ≥15 là sập cả tiến trình
 *    chỉ vì một promise quên `.catch` → toàn bộ bệnh viện mất dịch vụ.
 *  - uncaughtException: trạng thái tiến trình không còn tin cậy → ghi log + cảnh báo, ngừng nhận request,
 *    đóng kết nối DB rồi exit(1) (tối đa `timeoutMs`). Docker `restart: unless-stopped` khởi động lại.
 *  - SIGTERM/SIGINT (docker stop, deploy): ngừng nhận request mới, chờ request đang chạy xong, đóng DB rồi exit(0).
 *    Docker chờ 10s trước khi SIGKILL → thời hạn mặc định 8s; quá hạn thì exit(1).
 * Cảnh báo: log JSON một dòng (cho agent thu log) + webhook tuỳ chọn OPS_ALERT_WEBHOOK_URL
 * (rơi về SLACK_SECURITY_WEBHOOK_URL). Chỉ gửi tên lỗi + thông điệp rút gọn, không gửi stack/payload.
 */
import mongoose from "mongoose";

const ALERT_COOLDOWN_MS = 60_000;
let guardedServer = null;

export const setGuardedServer = (server) => {
  guardedServer = server;
};

const summarize = (err) => ({
  name: err?.name || typeof err,
  message: String(err?.message ?? err).slice(0, 300),
});

export const postOpsAlert = async ({ kind, error }) => {
  const url = process.env.OPS_ALERT_WEBHOOK_URL || process.env.SLACK_SECURITY_WEBHOOK_URL;
  if (!url) return false;
  try {
    const text = `[NeuroScan BE][${process.env.NODE_ENV || "development"}] ${kind}: ${error.name} — ${error.message}`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, kind, ...error, at: new Date().toISOString() }),
      signal: AbortSignal.timeout(3000),
    });
    return true;
  } catch {
    return false;
  }
};

export const installProcessGuards = ({
  proc = process,
  exit = (code) => process.exit(code),
  getServer = () => guardedServer,
  closeDb = () => mongoose.connection.close(),
  alert = postOpsAlert,
  log = console.error,
  timeoutMs = 10_000,
  signalTimeoutMs = 8_000,
  signals = ["SIGTERM", "SIGINT"],
} = {}) => {
  const lastAlertAt = new Map();
  let shuttingDown = false;

  const report = (kind, err) => {
    const error = summarize(err);
    log(JSON.stringify({ level: "fatal", event: kind, ...error, stack: String(err?.stack || "").split("\n").slice(0, 6).join(" | "), at: new Date().toISOString() }));
    const key = `${kind}:${error.name}:${error.message}`;
    const now = Date.now();
    if (now - (lastAlertAt.get(key) || 0) < ALERT_COOLDOWN_MS) return Promise.resolve(false);
    lastAlertAt.set(key, now);
    return Promise.resolve(alert({ kind, error })).catch(() => false);
  };

  const onUnhandledRejection = (reason) => report("unhandledRejection", reason);

  // Đóng êm: ngừng nhận request, chờ request đang chạy, đóng DB, rồi exit(code). Quá hạn → exit(1).
  const shutdown = async (code, limitMs, before) => {
    if (shuttingDown) return;
    shuttingDown = true;
    const force = setTimeout(() => exit(1), limitMs);
    force.unref?.();
    let finalCode = code;
    try {
      if (before) await before();
      const server = getServer();
      if (server) await new Promise((resolve) => server.close(() => resolve()));
      await closeDb();
    } catch {
      if (code === 0) finalCode = 1; /* dọn dẹp lỗi khi tắt bình thường → báo mã lỗi */
    } finally {
      clearTimeout(force);
      exit(finalCode);
    }
  };

  const onUncaughtException = (err) => shutdown(1, timeoutMs, () => report("uncaughtException", err));

  const onSignal = (signal) =>
    shutdown(0, signalTimeoutMs, async () => {
      log(JSON.stringify({ level: "info", event: "shutdown", signal, at: new Date().toISOString() }));
    });

  proc.on("unhandledRejection", onUnhandledRejection);
  proc.on("uncaughtException", onUncaughtException);
  for (const sig of signals) proc.on(sig, () => onSignal(sig));
  return { onUnhandledRejection, onUncaughtException, onSignal };
};
