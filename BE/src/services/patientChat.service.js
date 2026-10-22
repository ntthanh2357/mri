import crypto from "crypto";
import { ChatUsage, ChatConsent } from "../models/chatUsage.model.js";
import { getJwtSecret } from "../config/jwt.config.js";
import { aiBaseUrl } from "./documentOcr.service.js";

/**
 * Hỏi đáp sức khỏe cho bệnh nhân: chuyển câu hỏi tới chatbot có sẵn của AI service (POST /chat — hỏi đáp chung về u não,
 * chăm sóc sau chụp MRI; có bộ lọc câu hỏi vi phạm). KHÔNG gửi bệnh án của bệnh nhân. AI service tự ghi nhật ký hỏi đáp
 * theo bí danh; ứng dụng không lưu lịch sử. `ask` truyền vào được để test không phải gọi AI server.
 */

export const MAX_MESSAGE = 1000;
export const MAX_ANSWER = 8000;
export const MAX_QUESTIONS_PER_DAY = 30;
// Hoàn lượt khi không chắc Gemini đã được gọi hay chưa (quá giờ, AI báo lỗi, trả lời rỗng) — có trần, không thì hỏi vô hạn
export const MAX_UNSURE_REFUNDS_PER_DAY = 5;
// AI service gọi Gemini đồng bộ trên 1 tiến trình: nhiều câu hỏi cùng lúc làm nghẽn cả phần đọc phim của bác sĩ
export const MAX_CONCURRENT = 2;

const httpError = (status, message) => Object.assign(new Error(message), { status });
const vnDay = (now) => new Date(now.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);

/** Bí danh cố định cho mỗi bệnh nhân (AI service ghi nhật ký theo mã người hỏi): không gửi mã tài khoản thật ra ngoài. */
const aliasOf = (patientId) =>
  `patient-${crypto.createHmac("sha256", `${getJwtSecret()}:chat-alias`).update(String(patientId)).digest("hex").slice(0, 20)}`;

/**
 * Gọi chatbot của AI service. Lỗi có `code`:
 * - "BLOCKED": bộ lọc từ khoá của AI service chặn (chưa gọi Gemini);
 * - "UNREACHABLE": không kết nối được AI service (chắc chắn chưa gọi Gemini);
 * - còn lại: không chắc (quá giờ, Gemini lỗi…).
 */
export const callAiChat = async (message, userAlias, { timeoutMs = 45000 } = {}) => {
  let res;
  try {
    res = await fetch(`${aiBaseUrl()}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctor_id: userAlias, message }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    // quá giờ: AI service có thể vẫn đang gọi Gemini; lỗi khác (từ chối kết nối…): chưa tới được AI service
    throw Object.assign(new Error(`Không gọi được AI service: ${err.message}`), { code: err.name === "TimeoutError" ? "TIMEOUT" : "UNREACHABLE" });
  }
  if (!res.ok) throw new Error(`AI server trả về ${res.status}`);
  const data = await res.json();
  if (data?.error) {
    // bộ lọc từ khoá của AI service trả "CẢNH BÁO (Red Alert)..." (chưa gọi Gemini); lỗi khác là Gemini/AI hỏng
    if (/red alert/i.test(String(data.error))) throw Object.assign(new Error("Câu hỏi bị chặn"), { code: "BLOCKED" });
    throw new Error(`AI service báo lỗi: ${String(data.error).slice(0, 200)}`);
  }
  return String(data?.answer ?? "");
};

const consumeQuota = async (patientId, now) => {
  const filter = { patientId, day: vnDay(now), count: { $lt: MAX_QUESTIONS_PER_DAY } };
  const limitError = () => httpError(429, `Hôm nay bạn đã hỏi đủ ${MAX_QUESTIONS_PER_DAY} câu. Vui lòng quay lại vào ngày mai.`);
  try {
    await ChatUsage.findOneAndUpdate(filter, { $inc: { count: 1 }, $setOnInsert: { expireAt: new Date(now.getTime() + 3 * 24 * 3600 * 1000) } }, { upsert: true });
  } catch (err) {
    if (err?.code !== 11000) throw err;
    // trùng khoá: đã hết lượt, hoặc 2 câu hỏi đầu ngày cùng tạo bản ghi → thử lại không upsert để phân biệt
    if (!(await ChatUsage.findOneAndUpdate(filter, { $inc: { count: 1 } }))) throw limitError();
  }
};
/** `sure` = chắc chắn chưa gọi Gemini → luôn hoàn; không chắc → chỉ hoàn trong trần mỗi ngày. */
const refundQuota = (patientId, now, sure) => ChatUsage.updateOne(
  { patientId, day: vnDay(now), count: { $gt: 0 }, ...(sure ? {} : { refunded: { $not: { $gte: MAX_UNSURE_REFUNDS_PER_DAY } } }) },
  { $inc: { count: -1, ...(sure ? {} : { refunded: 1 }) } },
);

// ── Đồng ý gửi câu hỏi tới dịch vụ AI ───────────────────────────────────────
// Đổi khi nội dung khung xin đồng ý trên màn chat đổi (FE: utils/healthChat.js) → bệnh nhân phải đồng ý lại
export const CHAT_CONSENT_VERSION = "2026-10-21";

const consentView = (row) => {
  const granted = Boolean(row && !row.revokedAt && row.version === CHAT_CONSENT_VERSION);
  return { granted, grantedAt: granted ? row.grantedAt : null, version: CHAT_CONSENT_VERSION };
};

export const getChatConsent = async (patientId) => consentView(await ChatConsent.findOne({ patientId }).lean());

/** `version` = bản thông báo giao diện đã hiện cho bệnh nhân; khác bản hiện hành (app cũ) → 409, không ghi gì. */
export const grantChatConsent = async (patientId, version, now = new Date()) => {
  if (version !== CHAT_CONSENT_VERSION) {
    throw Object.assign(httpError(409, "Nội dung xin đồng ý đã được cập nhật. Hãy tải lại trang (hoặc cập nhật ứng dụng) để đọc bản mới."), { code: "CONSENT_OUTDATED" });
  }
  return consentView(await ChatConsent.findOneAndUpdate(
    { patientId },
    { $set: { version: CHAT_CONSENT_VERSION, grantedAt: now, revokedAt: null } },
    { upsert: true, new: true, lean: true },
  ));
};

export const revokeChatConsent = async (patientId, now = new Date()) =>
  consentView(await ChatConsent.findOneAndUpdate({ patientId, revokedAt: null }, { $set: { revokedAt: now } }, { new: true, lean: true })
    || await ChatConsent.findOne({ patientId }).lean());

let inFlight = 0;

export const askHealthQuestion = async (patientId, message, { ask = callAiChat, now = new Date() } = {}) => {
  if (typeof message !== "string" || !message.trim()) throw httpError(400, "Hãy nhập câu hỏi.");
  const text = message.trim();
  if (text.length > MAX_MESSAGE) throw httpError(400, `Câu hỏi tối đa ${MAX_MESSAGE} ký tự.`);
  if (!(await getChatConsent(patientId)).granted) {
    throw Object.assign(httpError(403, "Bạn cần đồng ý gửi câu hỏi tới dịch vụ AI trước khi hỏi."), { code: "CONSENT_REQUIRED" });
  }
  if (inFlight >= MAX_CONCURRENT) throw httpError(503, "Trợ lý đang trả lời nhiều người cùng lúc. Vui lòng thử lại sau vài giây.");
  inFlight += 1;
  try {
    await consumeQuota(patientId, now);
    let answer;
    try {
      answer = String(await ask(text, aliasOf(patientId)) || "").trim();
    } catch (err) {
      await refundQuota(patientId, now, err.code === "BLOCKED" || err.code === "UNREACHABLE");
      if (err.code === "BLOCKED") throw httpError(400, "Câu hỏi này nằm ngoài phạm vi trợ lý có thể hỗ trợ. Bạn hãy hỏi về sức khỏe, triệu chứng hoặc cách chăm sóc nhé.");
      console.error("[patient-chat] AI service không trả lời được:", err.message);
      throw httpError(503, "Trợ lý đang tạm ngưng. Vui lòng thử lại sau ít phút.");
    }
    if (!answer) {
      await refundQuota(patientId, now, false); // Gemini có thể đã chặn câu trả lời (vẫn tính phí)
      throw httpError(503, "Trợ lý chưa trả lời được câu này. Bạn thử hỏi cách khác nhé.");
    }
    return { answer: answer.slice(0, MAX_ANSWER) };
  } finally {
    inFlight -= 1;
  }
};
