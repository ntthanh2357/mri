import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadImageBuffer,
  resolveLocalUploadPath,
  isPrivateHostname,
  isPrivateIp,
  UPLOADS_DIR,
} from '../utils/imageSource.util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const expectReject = async (promise, statusCode) => {
  let err;
  try {
    await promise;
  } catch (e) {
    err = e;
  }
  if (!err) throw new Error('Mong đợi lỗi nhưng thao tác lại thành công');
  if (statusCode && err.statusCode !== statusCode) {
    throw new Error(`Mong đợi statusCode ${statusCode}, nhận ${err.statusCode}: ${err.message}`);
  }
  return err;
};

describe('Chặn SSRF & path traversal khi nạp ảnh cho AI (P0-5)', () => {
  const tempFile = path.join(UPLOADS_DIR, `test_ssrf_${Date.now()}.png`);

  beforeAll(() => {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(tempFile, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });

  afterAll(() => {
    try { fs.unlinkSync(tempFile); } catch { /* ignore */ }
  });

  it('nhận diện đúng host nội bộ / link-local / metadata cloud', () => {
    for (const host of ['localhost', '127.0.0.1', '10.1.2.3', '192.168.1.10', '169.254.169.254', '172.20.0.5', '::1', 'svc.internal', 'printer.local']) {
      expect(isPrivateHostname(host)).toBe(true);
    }
    expect(isPrivateHostname('storage.googleapis.com')).toBe(false);
    expect(isPrivateHostname('firebasestorage.googleapis.com')).toBe(false);
  });

  it('nhận diện IP nội bộ sau phân giải DNS, kể cả IPv4-mapped IPv6', () => {
    for (const ip of ['127.0.0.1', '10.0.0.5', '192.168.0.1', '169.254.169.254', '172.16.0.9', '::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:10.1.2.3']) {
      expect(isPrivateIp(ip)).toBe(true);
    }
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('2606:4700:4700::1111')).toBe(false);
  });

  it('chặn path traversal khi đọc tệp trong /uploads', async () => {
    for (const bad of [
      '/uploads/../../../etc/passwd',
      '/uploads/../../BE/.env',
      '/uploads/%2e%2e/%2e%2e/etc/passwd',
      '/uploads/..%2f..%2fBE%2f.env',
    ]) {
      await expectReject(Promise.resolve().then(() => resolveLocalUploadPath(bad)), 400);
    }
  });

  it('chặn SSRF tới localhost, metadata cloud và giao thức lạ', async () => {
    for (const bad of [
      'http://localhost:8000/predict',
      'http://127.0.0.1:5000/api/v1/health',
      'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
      'http://10.0.0.7/internal.png',
      'http://[::1]:8000/x.png',
      'file:///etc/passwd',
      'ftp://example.com/a.png',
    ]) {
      await expectReject(loadImageBuffer(bad), 400);
    }
  });

  it('vẫn nạp được ảnh hợp lệ trong /uploads', async () => {
    const loaded = await loadImageBuffer(`/uploads/${path.basename(tempFile)}`);
    expect(loaded.buffer.length).toBe(8);
    expect(loaded.mimeType).toBe('image/png');
  });

  it('trả 404 rõ ràng khi tệp không tồn tại (không lộ đường dẫn hệ thống)', async () => {
    await expectReject(loadImageBuffer('/uploads/khong_ton_tai_12345.png'), 404);
  });
});
