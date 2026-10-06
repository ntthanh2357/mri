import { encryptField, decryptField, maskTail, isEncrypted } from '../fieldCrypto.service.js';

describe('Mã hoá trường dữ liệu nhạy cảm AES-256-GCM (UC-PAT-02: CCCD, thẻ BHYT)', () => {
  it('mã hoá rồi giải mã ra đúng giá trị, bản mã không chứa giá trị gốc', () => {
    const enc = encryptField('079201001234');
    expect(isEncrypted(enc)).toBe(true);
    expect(enc.includes('079201001234')).toBe(false);
    expect(decryptField(enc)).toBe('079201001234');
  });

  it('cùng một giá trị mã hoá 2 lần cho 2 bản mã khác nhau (IV ngẫu nhiên)', () => {
    expect(encryptField('HS4010123456789') === encryptField('HS4010123456789')).toBe(false);
  });

  it('phát hiện bản mã bị sửa (GCM auth tag) thay vì trả dữ liệu sai', () => {
    const enc = encryptField('079201001234');
    const parts = enc.split(':');
    const c = Buffer.from(parts[3], 'base64');
    c[0] = c[0] ^ 0xff;
    parts[3] = c.toString('base64');
    expect(() => decryptField(parts.join(':'))).toThrow();
  });

  it('giá trị rỗng giữ nguyên rỗng; dữ liệu cũ chưa mã hoá đọc ra nguyên văn', () => {
    expect(encryptField('')).toBe('');
    expect(decryptField('')).toBe('');
    expect(decryptField('HS4010123456789')).toBe('HS4010123456789');
  });

  it('maskTail chỉ để lộ 4 ký tự cuối', () => {
    expect(maskTail('079201001234')).toBe('********1234');
    expect(maskTail('123')).toBe('***');
    expect(maskTail('')).toBe('');
  });
});
