import jwt from 'jsonwebtoken';
import {
  buildImagingReportPdf,
  createReportToken,
  verifyReportToken,
  detectImageType,
} from '../reportPdf.service.js';
import { getJwtSecret } from '../../config/jwt.config.js';

// PNG 1x1 hợp lệ
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const SAMPLE = {
  _id: '6aba081c44f62f1f2b3dacdb',
  imagingType: 'MRI',
  medicalId: 'BN001',
  medicalRecordNumber: 'MRN-2026-9901',
  patientName: 'Nguyễn Văn Tuấn Thành',
  birthYear: 1980,
  gender: 'Nam',
  address: 'Đà Nẵng',
  orderDate: new Date('2026-09-27T13:24:00Z'),
  orderingDoctor: 'TS.BS.CKII Nguyễn Gia Huy',
  orderingDepartment: 'Ngoại Thần Kinh',
  diagnosis: 'U màng não thùy thái dương trái',
  procedure: 'Chụp cộng hưởng từ sọ não',
  technique: 'Lát cắt mỏng 3mm, có tiêm thuốc đối quang từ',
  findings: 'Khối ngoài trục vùng thái dương trái, bắt thuốc mạnh và đồng nhất, kích thước 32x28mm.',
  conclusion: 'Hình ảnh điển hình của u màng não thùy thái dương trái.',
  radiologist: 'BS.CKI Phạm Thanh Hải',
  reportDate: new Date('2026-09-28T09:00:00Z'),
  isSigned: true,
  signedAt: new Date('2026-09-28T09:05:00Z'),
};

describe('Báo cáo PDF kết quả chụp cho bệnh nhân (UC-PAT-08)', () => {
  it('tạo file PDF hợp lệ từ kết quả đã ký, kèm ảnh phim', async () => {
    const buf = await buildImagingReportPdf(SAMPLE, { hospitalName: 'Bệnh viện Bạch Mai', images: [PNG_1PX] });
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(2000);
  });

  it('không lỗi khi thiếu ảnh và các trường tuỳ chọn', async () => {
    const buf = await buildImagingReportPdf({ _id: 'x', patientName: 'A', conclusion: '' }, {});
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
  });

  it('token tải: tạo và xác minh được, đúng kết quả + người dùng', () => {
    const token = createReportToken('abc123', 'user1');
    const payload = verifyReportToken(token);
    expect(payload.rid).toBe('abc123');
    expect(payload.uid).toBe('user1');
  });

  it('token tải: từ chối chuỗi rác và token đăng nhập thông thường', () => {
    expect(() => verifyReportToken('khong.phai.token')).toThrow();
    const loginToken = jwt.sign({ id: 'user1' }, getJwtSecret(), { algorithm: 'HS256', expiresIn: '1h' });
    expect(() => verifyReportToken(loginToken)).toThrow();
  });

  it('chỉ nhận ảnh JPG/PNG (pdfkit không nhúng được định dạng khác)', () => {
    expect(detectImageType(PNG_1PX)).toBe('png');
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBe('jpg');
    expect(detectImageType(Buffer.from('GIF89a'))).toBe(null);
    expect(detectImageType(null)).toBe(null);
  });
});
