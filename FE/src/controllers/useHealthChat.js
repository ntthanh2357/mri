import { useCallback, useEffect, useRef, useState } from 'react';
import { get, put, del, post } from '../services/api.service';
import { appendMessage, CHAT_MAX_MESSAGE, CHAT_CONSENT_VERSION } from '../utils/healthChat';

/**
 * Hỏi đáp sức khỏe với trợ lý AI (câu hỏi chung, không gửi bệnh án). Phải đồng ý trước khi hỏi. Ứng dụng chỉ giữ hội thoại trong phiên
 * (AI service có ghi nhật ký hỏi đáp theo bí danh).
 * messages: [{ id, role: 'user' | 'assistant' | 'error', text }]
 */
export function useHealthChat() {
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const busy = useRef(false); // chặn gửi 2 lần khi bấm liên tục (state cập nhật chậm hơn)
  // Đồng ý gửi câu hỏi tới dịch vụ AI (bắt buộc trước khi hỏi, rút lại được)
  const [consent, setConsent] = useState({ loading: true, granted: false, grantedAt: null, error: null });

  const loadConsent = useCallback(async () => {
    try {
      const res = await get('/api/v1/patient/chat/consent');
      setConsent({ loading: false, granted: !!res?.data?.granted, grantedAt: res?.data?.grantedAt || null, error: null });
    } catch (err) {
      console.error('Lỗi tải trạng thái đồng ý hỏi đáp:', err);
      setConsent((c) => ({ ...c, loading: false, error: 'Không tải được trạng thái đồng ý.' }));
    }
  }, []);

  useEffect(() => { loadConsent(); }, [loadConsent]);

  /** on = true: đồng ý; false: rút lại. */
  const setConsentTo = useCallback(async (on) => {
    try {
      const res = on ? await put('/api/v1/patient/chat/consent', { version: CHAT_CONSENT_VERSION }) : await del('/api/v1/patient/chat/consent');
      setConsent({ loading: false, granted: !!res?.data?.granted, grantedAt: res?.data?.grantedAt || null, error: null });
      return { ok: true, message: res?.message };
    } catch (err) {
      return { ok: false, message: err?.message || (on ? 'Không ghi nhận được đồng ý. Vui lòng thử lại.' : 'Không rút lại được. Vui lòng thử lại.') };
    }
  }, []);

  const send = useCallback(async (text) => {
    const question = String(text || '').trim();
    if (!question || question.length > CHAT_MAX_MESSAGE || busy.current) return { ok: false };
    busy.current = true;
    setSending(true);
    setMessages((m) => appendMessage(m, 'user', question));
    try {
      const res = await post('/api/v1/patient/chat', { message: question });
      setMessages((m) => appendMessage(m, 'assistant', res?.data?.answer || ''));
      return { ok: true };
    } catch (err) {
      setMessages((m) => appendMessage(m, 'error', err?.message || 'Trợ lý chưa trả lời được. Vui lòng thử lại.'));
      loadConsent(); // đồng ý có thể đã bị rút ở thiết bị khác: hiện lại khung xin đồng ý
      return { ok: false };
    } finally {
      busy.current = false;
      setSending(false);
    }
  }, [loadConsent]);

  const clear = useCallback(() => setMessages([]), []);

  return { messages, sending, send, clear, consent, setConsentTo, reloadConsent: loadConsent };
}
