import { encryptField, decryptField, isEncrypted, hashField } from '../services/fieldCrypto.service.js';
import {
  encryptBhytCardNumber,
  decryptBhytCardNumber,
  bhytCardLast4,
  maskBhytCardNumber,
  normalizeBhytCardNumber,
} from '../modules/billing/bhytCrypto.util.js';

describe('Mã hóa dữ liệu định danh nhạy cảm (P1-9)', () => {
  const card = 'DN4797932200123';

  it('số thẻ BHYT được mã hóa, không còn plaintext trong DB', () => {
    const enc = encryptBhytCardNumber(card);
    expect(enc.cardNumber.includes(card)).toBe(false);
    expect(isEncrypted(enc.cardNumber)).toBe(true);
    expect(enc.cardLast4).toBe('0123');
  });

  it('giải mã trả lại đúng số thẻ và che đúng định dạng khi trả API', () => {
    const enc = encryptBhytCardNumber(card);
    expect(decryptBhytCardNumber(enc.cardNumber)).toBe(card);
    const masked = maskBhytCardNumber({ cardNumber: enc.cardNumber, cardLast4: enc.cardLast4 });
    expect(masked.endsWith('0123')).toBe(true);
    expect(masked.includes(card)).toBe(false);
  });

  it('hash tra cứu ổn định, khác namespace và không lộ số thẻ', () => {
    const enc = encryptBhytCardNumber(card);
    expect(enc.cardNumberHash).toBe(hashField(normalizeBhytCardNumber(card), 'bhyt-card'));
    expect(enc.cardNumberHash === hashField(normalizeBhytCardNumber(card), 'other')).toBe(false);
    expect(enc.cardNumberHash.includes(card)).toBe(false);
  });

  it('hai lần mã hóa cùng số thẻ cho bản mã khác nhau (IV ngẫu nhiên) nhưng cùng hash', () => {
    const a = encryptBhytCardNumber(card);
    const b = encryptBhytCardNumber(card);
    expect(a.cardNumber === b.cardNumber).toBe(false);
    expect(a.cardNumberHash).toBe(b.cardNumberHash);
  });

  it('đọc được dữ liệu cũ còn plaintext (trước migration) và vẫn lấy đúng 4 số cuối', () => {
    expect(decryptBhytCardNumber(card)).toBe(card);
    expect(bhytCardLast4({ cardNumber: card })).toBe('0123');
  });

  it('CCCD người ký trong consent được mã hóa, không lưu plaintext', () => {
    const cccd = '079088009999';
    const enc = encryptField(cccd);
    expect(enc.includes(cccd)).toBe(false);
    expect(decryptField(enc)).toBe(cccd);
    expect(cccd.slice(-4)).toBe('9999');
  });

  it('chuẩn hóa số thẻ: bỏ khoảng trắng, viết hoa', () => {
    expect(normalizeBhytCardNumber(' dn47 9793 2200 123 ')).toBe('DN4797932200123');
  });
});
