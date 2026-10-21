// Hỏi đáp sức khỏe — hàm thuần (không import react-native) để test bằng node.

export const CHAT_MAX_MESSAGE = 1000;
// Phiên bản nội dung khung xin đồng ý (CHAT_CONSENT_POINTS ngay dưới). Sửa nội dung thì tăng cả ở đây
// và CHAT_CONSENT_VERSION phía máy chủ (patientChat.service.js), để bệnh nhân đồng ý đúng bản họ đã đọc.
export const CHAT_CONSENT_VERSION = '2026-10-21';
export const CHAT_CONSENT_POINTS = [
  'Câu hỏi của bạn được gửi tới dịch vụ AI Gemini của Google để trả lời. Câu hỏi về sức khoẻ là dữ liệu cá nhân nhạy cảm.',
  'Câu hỏi và câu trả lời được dịch vụ AI ghi lại để kiểm tra chất lượng, không kèm tên tài khoản của bạn. Đừng ghi họ tên, số điện thoại hay số CCCD.',
  'Trợ lý chỉ trả lời câu hỏi chung, không xem được bệnh án của bạn và không thay cho bác sĩ.',
  'Bạn có thể rút lại đồng ý bất cứ lúc nào. Khi rút lại, câu hỏi mới sẽ không được gửi đi nữa.',
];

export const SUGGESTED_QUESTIONS = [
  'Trước khi chụp MRI tôi cần chuẩn bị gì?',
  'Thuốc cản quang có tác dụng phụ gì không?',
  'U màng não là gì, có nguy hiểm không?',
  'Đau đầu thế nào thì cần đi khám ngay?',
];

/**
 * Dấu hiệu cần đi cấp cứu ngay (chỉ để hiện lời nhắc gọi 115, không chẩn đoán).
 * So khớp không dấu, chữ thường.
 */
const URGENT_PATTERNS = [
  'co giat', 'yeu nua nguoi', 'liet nua nguoi', 'meo mieng', 'noi kho', 'noi ngong', 'hon me', 'bat tinh', 'ngat',
  'dau dau du doi', 'dau dau dot ngot', 'mat y thuc', 'kho tho',
];
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
export const looksUrgent = (text) => URGENT_PATTERNS.some((p) => fold(text).includes(p));

let seq = 0;
/** Thêm 1 tin nhắn vào hội thoại (giữ tối đa 60 tin gần nhất trong phiên). */
export const appendMessage = (list, role, text) => [...list, { id: `${Date.now()}-${(seq += 1)}`, role, text }].slice(-60);
