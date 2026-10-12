import { useCallback, useEffect, useState } from 'react';
import { get, post } from '../services/api.service';

/** Ticket hỗ trợ của người dùng + role (để chọn bộ câu hỏi thường gặp phù hợp). */
export function useSupport() {
  const [role, setRole] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const res = await get('/api/v1/support/tickets');
      if (res?.success) setTickets(res.tickets || []);
    } catch (err) {
      console.warn('Không thể tải danh sách ticket:', err.message);
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    get('/auth/me')
      .then((data) => setRole(data?.user?.role || null))
      .catch(() => setRole(null));
  }, [fetchTickets]);

  /** Trả về { ok, message } để màn hình tự hiển thị thông báo. */
  const sendTicket = useCallback(async (topic, message) => {
    setSending(true);
    try {
      const res = await post('/api/v1/support/tickets', { topic, message: message.trim(), priority: 'medium' });
      if (res?.success) {
        fetchTickets();
        return { ok: true, message: res.message || 'Yêu cầu hỗ trợ đã được ghi nhận.' };
      }
      return { ok: false, message: res?.message || 'Chưa gửi được yêu cầu. Vui lòng thử lại.' };
    } catch (err) {
      console.error('Lỗi gửi ticket:', err);
      return { ok: false, message: 'Không kết nối được máy chủ. Kiểm tra mạng rồi gửi lại.' };
    } finally {
      setSending(false);
    }
  }, [fetchTickets]);

  return { role, tickets, loadingTickets, sending, fetchTickets, sendTicket };
}
