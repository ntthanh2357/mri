import { QueueTicket } from "../models/queueTicket.model.js";
import { QueueCounter } from "../models/queueCounter.model.js";
import "../models/user.model.js"; // đăng ký model User cho populate
import { Hospital } from "../models/hospital.model.js";

/**
 * UC-PAT-03 — Lấy số tiếp đón online.
 * Luật gọi số: người lỡ lượt quay lại (lễ tân bấm "Đã tới") được chèn lên gọi ngay tiếp theo,
 * sau đó mới tới số kế tiếp theo thứ tự. Gọi mà vắng thì giữ số, không phải lấy lại — nên không có "khung tới muộn".
 */

export const AVG_SERVE_MINUTES = 10; // mặc định số phút tiếp nhận mỗi người; bệnh viện chỉnh ở Hospital.queueSettings
export const ACTIVE_STATUSES = ["waiting", "called", "missed", "arrived"];

const httpError = (status, message) => Object.assign(new Error(message), { status });

/** "YYYY-MM-DD" theo giờ Việt Nam. */
export const todayKey = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

const isLateArrival = (t, cursor) => t.status === "arrived" && t.number <= cursor;
const byArrival = (a, b) => new Date(a.arrivedAt || 0) - new Date(b.arrivedAt || 0) || a.number - b.number;

/** Số sẽ được gọi tiếp: người lỡ lượt đã quay lại (tới trước gọi trước) → số kế tiếp chưa gọi. */
export const pickNextTicket = (tickets, cursor) => {
  const late = tickets.filter((t) => isLateArrival(t, cursor)).sort(byArrival);
  if (late.length) return late[0];
  const next = tickets
    .filter((t) => ["waiting", "arrived"].includes(t.status) && t.number > cursor)
    .sort((a, b) => a.number - b.number);
  return next[0] || null;
};

/** Số đang gọi hiển thị: số vừa được gọi gần nhất (có thể là người lỡ lượt số nhỏ), chưa ai đang gọi thì lấy con trỏ. */
export const currentNumber = (tickets, cursor) => {
  const calling = tickets.filter((t) => t.status === "called").sort((a, b) => new Date(b.calledAt || 0) - new Date(a.calledAt || 0));
  return calling[0]?.number ?? cursor;
};

/** Thống kê cho bệnh nhân: số đang gọi, số người phía trước, giờ dự kiến tới lượt. */
export const ticketStats = (tickets, cursor, mine, now = new Date(), avgMinutes = AVG_SERVE_MINUTES) => {
  const stats = { current: currentNumber(tickets, cursor), ahead: null, estimatedAt: null };
  if (!mine) return stats;
  const lateQueue = tickets.filter((t) => isLateArrival(t, cursor)).sort(byArrival);
  let ahead = null;
  if (mine.status === "called") ahead = 0;
  else if (isLateArrival(mine, cursor)) ahead = lateQueue.findIndex((t) => String(t._id) === String(mine._id));
  else if (["waiting", "arrived"].includes(mine.status)) {
    ahead = lateQueue.length + tickets.filter((t) => ["waiting", "arrived"].includes(t.status) && t.number > cursor && t.number < mine.number).length;
  }
  if (ahead === null) return stats;
  return { ...stats, ahead, estimatedAt: new Date(now.getTime() + ahead * avgMinutes * 60000) };
};

/** Số phút tiếp nhận trung bình mỗi người: số nguyên 1–60. */
export const normalizeQueueSettings = (body = {}) => {
  const n = Number(body.avgServeMinutes);
  if (!Number.isInteger(n) || n < 1 || n > 60) return { settings: null, error: "Số phút mỗi người phải là số nguyên từ 1 đến 60." };
  return { settings: { avgServeMinutes: n }, error: null };
};

export const getQueueSettings = async (hospitalId) => {
  const h = await Hospital.findById(hospitalId).select("queueSettings").lean();
  return { avgServeMinutes: h?.queueSettings?.avgServeMinutes || AVG_SERVE_MINUTES };
};

export const saveQueueSettings = async (hospitalId, body) => {
  const { settings, error } = normalizeQueueSettings(body);
  if (error) throw httpError(400, error);
  await Hospital.updateOne({ _id: hospitalId }, { $set: { "queueSettings.avgServeMinutes": settings.avgServeMinutes } });
  return settings;
};

const loadDay = async (hospitalId, dateKey) => {
  const [tickets, counter] = await Promise.all([
    QueueTicket.find({ hospitalId, dateKey }).lean(),
    QueueCounter.findOne({ hospitalId, dateKey }).lean(),
  ]);
  return { tickets, cursor: counter?.cursor || 0 };
};

export const takeTicket = async (patientId, hospitalId, now = new Date()) => {
  if (!hospitalId) throw httpError(400, "Vui lòng chọn bệnh viện.");
  const dateKey = todayKey(now);
  const existing = await QueueTicket.findOne({ patientId, hospitalId, dateKey, status: { $in: ACTIVE_STATUSES } });
  if (existing) return existing;
  const counter = await QueueCounter.findOneAndUpdate(
    { hospitalId, dateKey },
    { $inc: { lastNumber: 1 }, $setOnInsert: { cursor: 0 } },
    { upsert: true, new: true }
  );
  return QueueTicket.create({ hospitalId, patientId, dateKey, number: counter.lastNumber });
};

export const getMyTicket = async (patientId, hospitalId, now = new Date()) => {
  const dateKey = todayKey(now);
  const ticket = await QueueTicket.findOne({ patientId, hospitalId, dateKey }).sort({ createdAt: -1 }).lean();
  const [{ tickets, cursor }, { avgServeMinutes }] = await Promise.all([loadDay(hospitalId, dateKey), getQueueSettings(hospitalId)]);
  const waiting = tickets.filter((t) => ["waiting", "arrived"].includes(t.status)).length;
  return { ticket, waiting, avgServeMinutes, ...ticketStats(tickets, cursor, ticket && ACTIVE_STATUSES.includes(ticket.status) ? ticket : null, now, avgServeMinutes) };
};

export const cancelMyTicket = async (patientId, hospitalId, now = new Date()) => {
  const ticket = await QueueTicket.findOneAndUpdate(
    { patientId, hospitalId, dateKey: todayKey(now), status: { $in: ACTIVE_STATUSES } },
    { $set: { status: "cancelled", cancelledAt: now } },
    { new: true }
  );
  if (!ticket) throw httpError(404, "Bạn không có số nào đang chờ.");
  return ticket;
};

// ── Lễ tân / điều dưỡng ──────────────────────────────────────────────────────

const PATIENT_FIELDS = "email phone profile.name profile.fullName profile.medicalId profile.phone";

export const listToday = async (hospitalId, now = new Date()) => {
  const dateKey = todayKey(now);
  const [tickets, counter, settings] = await Promise.all([
    QueueTicket.find({ hospitalId, dateKey }).populate("patientId", PATIENT_FIELDS).sort({ number: 1 }).lean(),
    QueueCounter.findOne({ hospitalId, dateKey }).lean(),
    getQueueSettings(hospitalId),
  ]);
  const cursor = counter?.cursor || 0;
  const next = pickNextTicket(tickets, cursor);
  return { tickets, current: currentNumber(tickets, cursor), nextNumber: next?.number || null, settings };
};

export const callNext = async (hospitalId, now = new Date()) => {
  const dateKey = todayKey(now);
  // Thử vài lần phòng khi 2 quầy bấm gọi cùng lúc trúng cùng 1 số
  for (let attempt = 0; attempt < 3; attempt++) {
    const { tickets, cursor } = await loadDay(hospitalId, dateKey);
    const next = pickNextTicket(tickets, cursor);
    if (!next) throw httpError(404, "Không còn số nào đang chờ.");
    const called = await QueueTicket.findOneAndUpdate(
      { _id: next._id, hospitalId, status: next.status },
      { $set: { status: "called", calledAt: now }, $inc: { callCount: 1 } },
      { new: true }
    ).populate("patientId", PATIENT_FIELDS);
    if (!called) continue;
    if (called.number > cursor) await QueueCounter.updateOne({ hospitalId, dateKey }, { $max: { cursor: called.number } });
    return called;
  }
  throw httpError(409, "Số vừa được quầy khác gọi, vui lòng bấm gọi lại.");
};

const transition = async (hospitalId, id, from, set, message) => {
  const ticket = await QueueTicket.findOneAndUpdate(
    { _id: id, hospitalId, status: { $in: from } },
    { $set: set },
    { new: true }
  ).populate("patientId", PATIENT_FIELDS);
  if (!ticket) throw httpError(409, message);
  return ticket;
};

export const markMissed = (hospitalId, id, now = new Date()) =>
  transition(hospitalId, id, ["called"], { status: "missed", missedAt: now }, "Chỉ đánh dấu vắng được số đang gọi.");

export const markArrived = (hospitalId, id, now = new Date()) =>
  transition(hospitalId, id, ["waiting", "missed"], { status: "arrived", arrivedAt: now }, "Số này không ở trạng thái chờ hoặc vắng.");

export const markServed = (hospitalId, id, now = new Date()) =>
  transition(hospitalId, id, ["called", "arrived"], { status: "served", servedAt: now }, "Chỉ tiếp nhận được số đang gọi hoặc đã có mặt.");
