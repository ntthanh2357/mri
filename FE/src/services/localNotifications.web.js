// Bản web: trình duyệt không hẹn được thông báo khi đã đóng trang, nên không làm gì
// (nhắc uống thuốc vẫn hiện trong app). Bản điện thoại: localNotifications.js.

export const cancelScheduled = async () => {};

export const syncScheduled = async () => ({ ok: false, reason: 'web' });
