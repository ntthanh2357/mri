import { sendFcmNotification } from '../fcm.service.js';
import { sendSecuritySIEMAlert, runAuditIntegrityCheckAndAlert, getAuditIntegrityDashboardStatus } from '../auditAlert.service.js';

const SIEM_ENV = ['SECURITY_SIEM_WEBHOOK_URL', 'SLACK_SECURITY_WEBHOOK_URL'];

// Chạy fn khi không có webhook SIEM (trả lại biến môi trường cũ sau đó)
const withoutSiemWebhook = async (fn) => {
  const saved = SIEM_ENV.map((k) => [k, process.env[k]]);
  SIEM_ENV.forEach((k) => delete process.env[k]);
  try { return await fn(); } finally { saved.forEach(([k, v]) => { if (v !== undefined) process.env[k] = v; }); }
};

const alertInput = { alertType: 'TEST', severity: 'HIGH', title: 'Kiểm thử', details: 'Kiểm thử kênh cảnh báo' };

describe('Dịch vụ ngoài chưa cấu hình không được báo gửi thành công', () => {
  test('FCM chưa cấu hình: không đếm là đã gửi tới thiết bị nào', async () => {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) return; // máy có Firebase thật thì bỏ qua
    const res = await sendFcmNotification(['token-a', 'token-b'], { title: 'Nhắc lịch', body: 'Lịch hẹn MRI' });
    expect(res.successCount).toBe(0);
    expect(res.failureCount).toBe(2);
    expect(res.reason).toBe('FCM_NOT_CONFIGURED');
  });

  test('SIEM không có webhook: sent = false', async () => {
    const res = await withoutSiemWebhook(() => sendSecuritySIEMAlert(alertInput));
    expect(res.sent).toBe(false);
    expect(res.reason).toBe('SIEM_NOT_CONFIGURED');
  });

  test('SIEM webhook trả lỗi HTTP: sent = false', async () => {
    const realFetch = global.fetch;
    process.env.SECURITY_SIEM_WEBHOOK_URL = 'https://siem.example.invalid/hook';
    global.fetch = async () => ({ ok: false, status: 500 });
    try {
      const res = await sendSecuritySIEMAlert(alertInput);
      expect(res.sent).toBe(false);
      expect(res.status).toBe(500);
    } finally {
      global.fetch = realFetch;
      delete process.env.SECURITY_SIEM_WEBHOOK_URL;
    }
  });

  test('Không đọc được nhật ký: ghi "chưa kiểm được", không báo chuỗi băm hợp lệ', async () => {
    const res = await runAuditIntegrityCheckAndAlert(10, async () => { throw new Error('DB offline'); });
    expect(res.success).toBe(false);
    expect(res.checkFailed).toBe(true);
    expect(res.result.valid).toBeNull();
    expect(getAuditIntegrityDashboardStatus().valid).toBeNull();
  });

  test('Chuỗi băm bị sửa mà không có webhook: có cảnh báo nhưng alertSent = false', async () => {
    const res = await withoutSiemWebhook(() => runAuditIntegrityCheckAndAlert(10, async () => ({
      valid: false, reason: 'Hash mismatch', brokenSequenceNumber: 3, logId: 'x',
    })));
    expect(res.tampered).toBe(true);
    expect(res.alertTriggered).toBe(true);
    expect(res.alertSent).toBe(false);
  });

  test('Chuỗi băm còn nguyên: hợp lệ, không cảnh báo', async () => {
    const res = await runAuditIntegrityCheckAndAlert(10, async () => ({ valid: true, verifiedCount: 5, headHash: 'h' }));
    expect(res.success).toBe(true);
    expect(res.alertTriggered).toBe(false);
    expect(getAuditIntegrityDashboardStatus().valid).toBe(true);
  });
});
