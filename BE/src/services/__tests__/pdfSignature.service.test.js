import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';
import PDFDocument from 'pdfkit';
import { createSelfSignedP12, loadSigningCert, addSignaturePlaceholder, signPdf, signatureNote } from '../pdfSignature.service.js';
import { buildImagingReportPdf } from '../reportPdf.service.js';
import { buildRecordCopyPdf } from '../recordCopyPdf.service.js';

const require = createRequire(import.meta.url);
const forge = require('node-forge');

// Tạo 1 PDF nhỏ bằng pdfkit, chèn chỗ ký ngay trước doc.end() như các service tạo PDF thật
const makePdf = (signer, reason = 'Bản sao bệnh án') => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'A4' });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);
  doc.text('Noi dung can ky');
  addSignaturePlaceholder(doc, { reason, name: signer.signerName });
  doc.end();
});

// Kiểm chữ ký độc lập với thư viện ký: đọc ByteRange, lấy PKCS#7 trong /Contents, so băm SHA-256 của phần được ký
const inspect = (pdf) => {
  const text = pdf.toString('latin1');
  const m = /\/ByteRange \[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/.exec(text);
  if (!m) return null;
  const [a, b, c, d] = m.slice(1).map(Number);
  const hex = pdf.subarray(a + b + 1, c - 1).toString('latin1').replace(/0+$/, '');
  const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(forge.util.hexToBytes(hex.length % 2 ? `${hex}0` : hex)));
  const digestAttr = p7.rawCapture.authenticatedAttributes
    .map((attr) => forge.asn1.derToOid(attr.value[0].value) === forge.pki.oids.messageDigest ? attr.value[1].value[0].value : null)
    .find(Boolean);
  const signed = Buffer.concat([pdf.subarray(a, a + b), pdf.subarray(c, c + d)]);
  return {
    coversWholeFile: a === 0 && c + d === pdf.length,
    digestMatches: Buffer.from(digestAttr, 'binary').equals(crypto.createHash('sha256').update(signed).digest()),
    signerCn: p7.certificates[0].subject.getField('CN').value,
  };
};

describe('Ký số PDF (PAdES, chứng thư tự tạo)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfsign-'));
  const p12Path = path.join(dir, 'test.p12');
  fs.writeFileSync(p12Path, createSelfSignedP12({ commonName: 'NeuroScan Test Signer', passphrase: 'mat-khau' }));

  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('đọc chứng thư theo biến môi trường; sai mật khẩu, thiếu file hoặc production không cấu hình thì không ký (null)', () => {
    const signer = loadSigningCert({ env: { PDF_SIGNING_P12_PATH: p12Path, PDF_SIGNING_P12_PASSWORD: 'mat-khau' } });
    expect(signer.signerName).toBe('NeuroScan Test Signer');
    expect(signer.selfSigned).toBe(true);
    expect(loadSigningCert({ env: { PDF_SIGNING_P12_PATH: p12Path, PDF_SIGNING_P12_PASSWORD: 'sai' } })).toBeNull();
    expect(loadSigningCert({ env: { PDF_SIGNING_P12_PATH: path.join(dir, 'khong-co.p12') } })).toBeNull();
    expect(loadSigningCert({ env: { NODE_ENV: 'production' }, devPath: p12Path })).toBeNull(); // production bắt buộc khai báo rõ
  });

  it('PDF đã ký: chữ ký phủ toàn bộ file, băm khớp nội dung, đúng người ký', async () => {
    const signer = loadSigningCert({ env: { PDF_SIGNING_P12_PATH: p12Path, PDF_SIGNING_P12_PASSWORD: 'mat-khau' } });
    const signed = await signPdf(await makePdf(signer), signer);
    const r = inspect(signed);
    expect(r.coversWholeFile).toBe(true);
    expect(r.digestMatches).toBe(true);
    expect(r.signerCn).toBe('NeuroScan Test Signer');
    // tên PDF (/Ten) không được có dấu cách: trước đây /Name /NeuroScan AI làm trình đọc PDF báo hỏng file
    expect(/\/[A-Za-z]+ \/[^\s/<>()[\]]+ [^\s/<>()[\]\d]/.test(signed.toString('latin1'))).toBe(false);
  });

  it('sửa 1 chữ trong file đã ký thì băm không còn khớp (phát hiện được bản bị sửa)', async () => {
    const signer = loadSigningCert({ env: { PDF_SIGNING_P12_PATH: p12Path, PDF_SIGNING_P12_PASSWORD: 'mat-khau' } });
    const signed = await signPdf(await makePdf(signer), signer);
    const tampered = Buffer.from(signed.toString('latin1').replace('PDFKit', 'PDFKiT'), 'latin1');
    expect(inspect(tampered).digestMatches).toBe(false);
  });

  it('PDF kết quả chụp: có chứng thư thì được ký thật; không có thì vẫn tạo được nhưng không ký', async () => {
    const signer = loadSigningCert({ env: { PDF_SIGNING_P12_PATH: p12Path, PDF_SIGNING_P12_PASSWORD: 'mat-khau' } });
    const imaging = { _id: 'x', patientName: 'Nguyễn Văn A', imagingType: 'MRI', conclusion: 'Không thấy bất thường', isSigned: true, radiologist: 'BS B' };
    const signed = inspect(await buildImagingReportPdf(imaging, { hospitalName: 'Bệnh viện A', signer }));
    expect(signed.coversWholeFile && signed.digestMatches).toBe(true);
    const plain = await buildImagingReportPdf(imaging, { hospitalName: 'Bệnh viện A' });
    expect(plain.subarray(0, 5).toString()).toBe('%PDF-');
    expect(inspect(plain)).toBeNull();
  });

  it('PDF bản sao bệnh án: in được mọi nhóm (kể cả nhóm trống), có chứng thư thì ký thật', async () => {
    const signer = loadSigningCert({ env: { PDF_SIGNING_P12_PATH: p12Path, PDF_SIGNING_P12_PASSWORD: 'mat-khau' } });
    const request = {
      _id: 'abc', reason: 'Khám nơi khác', reviewedAt: new Date(), reviewedByName: 'Lễ Tân Một', reviewedByRole: 'receptionist',
      sections: ['visits', 'imaging', 'prescriptions', 'labs', 'vitals', 'inpatient', 'papers'],
      snapshot: {
        patient: { name: 'Nguyễn Văn A', gender: 'male', dateOfBirth: '1980-05-15', medicalId: 'BN001' },
        prescriptions: [{ recorded_at: new Date(), diagnosis: 'Đau đầu', doctor_name: 'BS B', drugs: [{ name: 'Paracetamol 500mg', quantity: 10, unit: 'viên', usage: 'Uống khi đau' }] }],
        labs: [{ category: 'HUYET_HOC', results: [{ biomarker_name: 'Hồng cầu', value_result: 4.2, unit: 'T/L', reference_range_display: '3.8 - 5.5' }] }],
        vitals: [{ recorded_at: new Date(), blood_pressure: '120/80', pulse: 72 }],
      },
    };
    const plain = await buildRecordCopyPdf(request, { hospitalName: 'Bệnh viện A' });
    expect(plain.subarray(0, 5).toString()).toBe('%PDF-');
    expect(inspect(plain)).toBeNull();
    const signed = inspect(await buildRecordCopyPdf(request, { hospitalName: 'Bệnh viện A', signer }));
    expect(signed.coversWholeFile && signed.digestMatches).toBe(true);
  });

  it('dòng ghi chú trên PDF nói đúng tình trạng ký', () => {
    expect(signatureNote(null)).toContain('chưa được ký số');
    expect(signatureNote({ signerName: 'NeuroScan Test Signer', selfSigned: true })).toContain('chứng thư thử nghiệm');
    expect(signatureNote({ signerName: 'Bệnh viện A', selfSigned: false })).toContain('Bệnh viện A');
  });
});
