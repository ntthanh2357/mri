import { toSharedEmr, toSharedImaging, toSharedSafety } from '../sharedRecord.service.js';

describe('Bệnh án chia sẻ qua QR — lọc dữ liệu (UC-PAT-09)', () => {
  it('bệnh án nội trú: bỏ ghi chú tâm thần, HIV, di truyền và dữ liệu ký số nội bộ', () => {
    const shared = toSharedEmr({
      _id: 'r1', diagnosis: 'U màng não', treatmentPlan: 'Phẫu thuật', psychiatricNotes: 'x', hivStatusNotes: 'y', geneticNotes: 'z',
      digitalSignatureMetadata: { signedHash: 'abc' }, dicomIntegrityHash: 'h', legalHold: true,
    }, { careSheets: [{ pulse: 80 }], consultations: [] });
    const json = JSON.stringify(shared);
    expect(shared.diagnosis).toBe('U màng não');
    expect(shared.careSheets.length).toBe(1);
    for (const k of ['psychiatricNotes', 'hivStatusNotes', 'geneticNotes', 'digitalSignatureMetadata', 'dicomIntegrityHash', 'legalHold']) {
      expect(json.includes(k)).toBe(false);
    }
  });

  it('phim chụp: chỉ lấy phim đã ký, giữ ảnh và kết luận bác sĩ', () => {
    expect(toSharedImaging({ isSigned: false, conclusion: 'x' })).toBeNull();
    const img = toSharedImaging({ isSigned: true, procedure: 'MRI sọ não', conclusion: 'Không thấy khối choán chỗ', images: ['/uploads/a.jpg'], storageFileId: 'drive-id', aiJobId: 'job' });
    expect(img.conclusion).toBe('Không thấy khối choán chỗ');
    expect(img.images.length).toBe(1);
    expect('storageFileId' in img).toBe(false);
    expect('aiJobId' in img).toBe(false);
  });

  it('thông tin an toàn: chỉ dị ứng thuốc và liên hệ khẩn cấp, không lộ CCCD/thẻ BHYT', () => {
    const s = toSharedSafety({ drugAllergies: ['Penicillin'], emergencyContact: { name: 'Lan', relation: 'Mẹ', phone: '0905' }, citizenIdEnc: 'v1:x', bhytDeclared: { cardNumberEnc: 'v1:y' } });
    expect(s.drugAllergies[0]).toBe('Penicillin');
    expect(s.emergencyContact.name).toBe('Lan');
    const json = JSON.stringify(s);
    expect(json.includes('citizen') || json.includes('bhyt') || json.includes('v1:')).toBe(false);
  });
});
