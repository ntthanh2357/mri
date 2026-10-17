import { normalizeIdentityUpdate, toPublicIdentity } from '../patientIdentity.service.js';
import { decryptField, isEncrypted } from '../fieldCrypto.service.js';

describe('Hồ sơ cá nhân & BHYT bệnh nhân tự khai (UC-PAT-02)', () => {
  it('CCCD hợp lệ được mã hoá; thẻ BHYT được chuẩn hoá chữ hoa, mã hoá và chuyển "chờ xác nhận"', () => {
    const { update, errors } = normalizeIdentityUpdate({ citizenId: ' 079201001234 ', bhytCardNumber: 'hs4010123456789', bhytRegistrationPlace: 'BV Đà Nẵng' });
    expect(Object.keys(errors).length).toBe(0);
    expect(isEncrypted(update.citizenIdEnc)).toBe(true);
    expect(decryptField(update.citizenIdEnc)).toBe('079201001234');
    expect(decryptField(update['bhytDeclared.cardNumberEnc'])).toBe('HS4010123456789');
    expect(update['bhytDeclared.status']).toBe('pending');
    expect(update['bhytDeclared.registrationPlace']).toBe('BV Đà Nẵng');
  });

  it('báo lỗi rõ ràng khi CCCD, thẻ BHYT hoặc SĐT người liên hệ sai định dạng', () => {
    const { errors } = normalizeIdentityUpdate({ citizenId: '123', bhytCardNumber: 'ABC', emergencyContact: { name: 'Mẹ', phone: '12' } });
    expect(Boolean(errors.citizenId)).toBe(true);
    expect(Boolean(errors.bhytCardNumber)).toBe(true);
    expect(Boolean(errors.emergencyContactPhone)).toBe(true);
  });

  it('dị ứng thuốc: bỏ khoảng trắng, bỏ trùng (không phân biệt hoa thường), bỏ mục rỗng', () => {
    const { update } = normalizeIdentityUpdate({ drugAllergies: ['Penicillin', ' ', 'penicillin ', 'Thuốc cản quang iod'] });
    expect(JSON.stringify(update.drugAllergies)).toBe(JSON.stringify(['Penicillin', 'Thuốc cản quang iod']));
  });

  it('gửi chuỗi rỗng để xoá CCCD; không gửi trường thì không đụng tới', () => {
    expect(normalizeIdentityUpdate({ citizenId: '' }).update.citizenIdEnc).toBe('');
    expect('citizenIdEnc' in normalizeIdentityUpdate({ address: 'Huế' }).update).toBe(false);
  });

  it('trả ra ngoài: che CCCD/thẻ BHYT; chỉ nhân viên xác nhận mới xem đủ số thẻ', () => {
    const { update } = normalizeIdentityUpdate({ citizenId: '079201001234', bhytCardNumber: 'HS4010123456789' });
    const stored = { citizenIdEnc: update.citizenIdEnc, bhytDeclared: { cardNumberEnc: update['bhytDeclared.cardNumberEnc'], status: 'pending' } };
    const forPatient = toPublicIdentity(stored);
    expect(forPatient.citizenIdMasked).toBe('********1234');
    expect(forPatient.bhyt.cardNumberMasked).toBe('***********6789');
    expect(forPatient.bhyt.cardNumber).toBe(undefined);
    expect(JSON.stringify(forPatient).includes('citizenIdEnc')).toBe(false);
    expect(toPublicIdentity(stored, { revealCard: true }).bhyt.cardNumber).toBe('HS4010123456789');
  });
});
