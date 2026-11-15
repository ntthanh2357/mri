import { EventEmitter } from "node:events";

/**
 * Kênh sự kiện hàng đợi theo từng bệnh viện (in-process SSE pub/sub, không phụ thuộc thư viện ngoài).
 * Chỉ phát tín hiệu thay đổi trạng thái (không chứa thông tin nhạy cảm của bệnh nhân).
 */
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

const channelOf = (hospitalId) => {
  const id = hospitalId ? String(hospitalId).trim() : "";
  return id ? `queue:${id}` : null;
};

/** Phát sự kiện thay đổi số thứ tự / lượt khám trong phạm vi đúng một bệnh viện. */
export const publishQueueEvent = (hospitalId, payload = {}) => {
  const channel = channelOf(hospitalId);
  if (!channel) return false;
  emitter.emit(channel, {
    type: payload.type || "queue.updated",
    number: payload.number ?? null,
    dateKey: payload.dateKey ?? null,
    timestamp: Date.now(),
  });
  return true;
};

/** Đăng ký lắng nghe sự kiện hàng đợi của một bệnh viện; trả về hàm hủy đăng ký. */
export const subscribeQueueEvents = (hospitalId, listener) => {
  const channel = channelOf(hospitalId);
  if (!channel || typeof listener !== "function") return () => {};
  emitter.on(channel, listener);
  return () => {
    emitter.off(channel, listener);
  };
};

/** Định dạng frame Server-Sent Events (SSE). */
export const formatSseEvent = (eventName, data) =>
  `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;

