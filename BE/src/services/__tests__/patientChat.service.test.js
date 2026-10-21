import mongoose from 'mongoose';
import {
  askHealthQuestion, MAX_MESSAGE, MAX_QUESTIONS_PER_DAY, MAX_UNSURE_REFUNDS_PER_DAY, MAX_CONCURRENT,
  getChatConsent, grantChatConsent, revokeChatConsent, CHAT_CONSENT_VERSION,
} from '../patientChat.service.js';
import { ChatUsage, ChatConsent } from '../../models/chatUsage.model.js';

const statusOf = async (fn) => { try { await fn(); return 200; } catch (e) { return e.status || 500; } };
const used = async (patientId) => (await ChatUsage.findOne({ patientId }).lean())?.count || 0;

describe('Hỏi đáp sức khỏe (chatbot cho bệnh nhân)', () => {
  const me = new mongoose.Types.ObjectId();
  const busy = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/neuroscan_test_logic';
    if (mongoose.connection.readyState === 0) await mongoose.connect(mongoUri);
    await ChatUsage.init();
    await ChatConsent.init();
    for (const p of [me, busy]) await grantChatConsent(p, CHAT_CONSENT_VERSION);
  });
  afterAll(async () => {
    await ChatUsage.deleteMany({ patientId: { $in: [me, busy] } });
    await ChatConsent.deleteMany({ patientId: { $in: [me, busy] } });
  });

  it('câu hỏi rỗng, sai kiểu hoặc quá dài: 400, không gọi AI, không tính lượt', async () => {
    let calls = 0;
    const ask = async () => { calls += 1; return 'x'; };
    for (const bad of ['', '   ', null, 123, { $ne: 1 }, ['a'], 'a'.repeat(MAX_MESSAGE + 1)]) {
      expect(await statusOf(() => askHealthQuestion(me, bad, { ask }))).toBe(400);
    }
    expect(calls).toBe(0);
    expect(await used(me)).toBe(0);
  });

  it('hỏi được: trả lời của AI, tính 1 lượt; AI chỉ nhận bí danh, không nhận mã tài khoản', async () => {
    const seen = [];
    const r = await askHealthQuestion(me, '  Sau chụp MRI có cần kiêng gì không?  ', { ask: async (msg, who) => { seen.push({ msg, who }); return '  Không cần kiêng gì đặc biệt.  ' }, });
    expect(r.answer).toBe('Không cần kiêng gì đặc biệt.');
    expect(seen[0].msg).toBe('Sau chụp MRI có cần kiêng gì không?');
    expect(seen[0].who.includes(String(me))).toBe(false);
    expect(seen[0].who.length > 8).toBe(true);
    const again = await askHealthQuestion(me, 'Câu khác', { ask: async (msg, who) => { seen.push({ msg, who }); return 'ok'; } });
    expect(again.answer).toBe('ok');
    expect(seen[1].who).toBe(seen[0].who); // cùng bệnh nhân → cùng bí danh (để AI service ghi nhật ký)
    expect(await used(me)).toBe(2);
  });

  it('AI lỗi hoặc trả lời rỗng: 503 và hoàn lượt; câu hỏi bị bộ lọc của AI chặn: 400 và hoàn lượt', async () => {
    const before = await used(me);
    expect(await statusOf(() => askHealthQuestion(me, 'Hỏi', { ask: async () => { throw new Error('ECONNREFUSED'); } }))).toBe(503);
    expect(await statusOf(() => askHealthQuestion(me, 'Hỏi', { ask: async () => '   ' }))).toBe(503);
    expect(await statusOf(() => askHealthQuestion(me, 'Hỏi', { ask: async () => { throw Object.assign(new Error('chặn'), { code: 'BLOCKED' }); } }))).toBe(400);
    expect(await used(me)).toBe(before);
  });

  it(`tối đa ${MAX_QUESTIONS_PER_DAY} câu hỏi mỗi ngày: hết lượt thì 429, không gọi AI`, async () => {
    let calls = 0;
    const ask = async () => { calls += 1; return 'ok'; };
    for (let i = 0; i < MAX_QUESTIONS_PER_DAY; i += 1) await askHealthQuestion(busy, `Câu ${i}`, { ask });
    expect(await statusOf(() => askHealthQuestion(busy, 'Thêm 1 câu', { ask }))).toBe(429);
    expect(calls).toBe(MAX_QUESTIONS_PER_DAY);
    // sang ngày mới thì hỏi tiếp được
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    expect((await askHealthQuestion(busy, 'Ngày mai', { ask, now: tomorrow })).answer).toBe('ok');
  });

  it('câu trả lời quá dài bị cắt bớt', async () => {
    const r = await askHealthQuestion(me, 'Hỏi dài', { ask: async () => 'a'.repeat(20000) });
    expect(r.answer.length <= 8000).toBe(true);
  });
});

describe('Hỏi đáp sức khỏe: hoàn lượt có trần, giới hạn số câu đang xử lý', () => {
  const unsure = new mongoose.Types.ObjectId();
  const many = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
  beforeAll(async () => { for (const p of [unsure, ...many]) await grantChatConsent(p, CHAT_CONSENT_VERSION); });
  afterAll(async () => {
    await ChatUsage.deleteMany({ patientId: { $in: [unsure, ...many] } });
    await ChatConsent.deleteMany({ patientId: { $in: [unsure, ...many] } });
  });

  it(`lỗi "không chắc đã gọi Gemini" (quá giờ, AI báo lỗi, trả lời rỗng) chỉ hoàn ${MAX_UNSURE_REFUNDS_PER_DAY} lần/ngày; không kết nối được AI thì luôn hoàn`, async () => {
    const fail = async () => { throw new Error('AI service báo lỗi: 503'); };
    for (let i = 0; i < MAX_UNSURE_REFUNDS_PER_DAY; i += 1) await statusOf(() => askHealthQuestion(unsure, 'Hỏi', { ask: fail }));
    expect(await used(unsure)).toBe(0);
    await statusOf(() => askHealthQuestion(unsure, 'Hỏi', { ask: async () => '  ' })); // vượt trần: trả lời rỗng vẫn tính lượt
    expect(await used(unsure)).toBe(1);
    for (let i = 0; i < 3; i += 1) {
      await statusOf(() => askHealthQuestion(unsure, 'Hỏi', { ask: async () => { throw Object.assign(new Error('ECONNREFUSED'), { code: 'UNREACHABLE' }); } }));
    }
    expect(await used(unsure)).toBe(1);
  });

  it(`tối đa ${MAX_CONCURRENT} câu hỏi được xử lý cùng lúc (không làm nghẽn AI service dùng chung); xong thì hỏi tiếp được`, async () => {
    const gates = [];
    const slow = () => new Promise((resolve) => gates.push(() => resolve('ok')));
    const running = [askHealthQuestion(many[0], 'Câu 1', { ask: slow }), askHealthQuestion(many[1], 'Câu 2', { ask: slow })];
    await new Promise((r) => setTimeout(r, 50));
    expect(await statusOf(() => askHealthQuestion(many[2], 'Câu 3', { ask: async () => 'ok' }))).toBe(503);
    expect(await used(many[2])).toBe(0); // bị từ chối trước khi trừ lượt
    gates.forEach((open) => open());
    await Promise.all(running);
    expect((await askHealthQuestion(many[2], 'Câu 3', { ask: async () => 'ok' })).answer).toBe('ok');
  });
});

describe('Hỏi đáp sức khỏe: phải đồng ý trước khi hỏi', () => {
  const p = new mongoose.Types.ObjectId();
  afterAll(async () => {
    await ChatUsage.deleteMany({ patientId: p });
    await ChatConsent.deleteMany({ patientId: p });
  });

  it('chưa đồng ý: 403 CONSENT_REQUIRED, không gọi AI, không tính lượt', async () => {
    let calls = 0;
    expect(await getChatConsent(p)).toEqual({ granted: false, grantedAt: null, version: CHAT_CONSENT_VERSION });
    let err;
    try { await askHealthQuestion(p, 'Hỏi', { ask: async () => { calls += 1; return 'ok'; } }); } catch (e) { err = e; }
    expect(err.status).toBe(403);
    expect(err.code).toBe('CONSENT_REQUIRED');
    expect(calls).toBe(0);
    expect(await used(p)).toBe(0);
  });

  it('đồng ý thì hỏi được, có ghi thời điểm; rút lại thì dừng; đồng ý theo nội dung cũ thì 409', async () => {
    const t = new Date('2026-10-21T08:00:00Z');
    expect(await grantChatConsent(p, CHAT_CONSENT_VERSION, t)).toEqual({ granted: true, grantedAt: t, version: CHAT_CONSENT_VERSION });
    expect((await askHealthQuestion(p, 'Hỏi', { ask: async () => 'ok' })).answer).toBe('ok');
    expect((await revokeChatConsent(p)).granted).toBe(false);
    expect(await statusOf(() => askHealthQuestion(p, 'Hỏi', { ask: async () => 'ok' }))).toBe(403);
    for (const v of ['cu-hon', undefined, { $gt: '' }]) {
      let err;
      try { await grantChatConsent(p, v); } catch (e) { err = e; }
      expect(err.status).toBe(409);
      expect(err.code).toBe('CONSENT_OUTDATED');
    }
    expect((await getChatConsent(p)).granted).toBe(false);
    await ChatConsent.updateOne({ patientId: p }, { $set: { version: 'cu-hon', revokedAt: null } });
    expect((await getChatConsent(p)).granted).toBe(false); // đồng ý theo bản thông báo cũ thì phải hỏi lại
  });
});
