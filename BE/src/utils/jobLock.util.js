import { acquireDistributedLock } from "../models/systemLock.model.js";

// Giữ khóa tới hết hạn thay vì nhả ngay: instance khác không chạy lại job trong cùng chu kỳ.
export const runWithJobLock = async (name, ttlMs, job) => {
  const lock = await acquireDistributedLock(`job_${name}`, { ttlSeconds: Math.ceil(ttlMs / 1000) });
  if (!lock.acquired) return { skipped: true };
  return job();
};
