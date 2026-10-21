import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { createRequire } from "module";

/**
 * Ký số file PDF theo chuẩn PAdES (adbe.pkcs7.detached) bằng chứng thư PKCS#12.
 * - Phần mật mã (PKCS#7, băm SHA-256) do node-forge + @signpdf/signpdf làm; file này đọc chứng thư (1 lần) và chèn chỗ giữ chữ ký vào PDF.
 * - Chứng thư: biến môi trường PDF_SIGNING_P12_PATH + PDF_SIGNING_P12_PASSWORD. Ngoài production, nếu không khai báo thì dùng
 *   BE/certs/dev-pdf-signing.p12 (tạo bằng `node scripts/create_pdf_signing_cert.js`, không đưa lên git).
 * - Không có chứng thư → PDF vẫn tạo nhưng KHÔNG ký, và trên PDF ghi rõ "chưa được ký số".
 */

const require = createRequire(import.meta.url);
const forge = require("node-forge");
const { Signer } = require("@signpdf/utils");
const signpdf = require("@signpdf/signpdf").default;

const BE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const DEV_P12_PATH = path.join(BE_ROOT, "certs", "dev-pdf-signing.p12");

// ─── Chứng thư ──────────────────────────────────────────────────────────────

/** Tạo chứng thư tự ký (RSA 2048, SHA-256) đóng gói PKCS#12 — cho môi trường thử nghiệm. Trả Buffer .p12. */
export const createSelfSignedP12 = ({ commonName = "NeuroScan AI Test Signing", organization = "NeuroScan", passphrase = "", years = 2 } = {}) => {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = `01${crypto.randomBytes(15).toString("hex")}`; // số dương, ngẫu nhiên
  cert.validity.notBefore = new Date(Date.now() - 60 * 1000);
  cert.validity.notAfter = new Date(Date.now() + years * 365 * 24 * 3600 * 1000);
  const attrs = [{ name: "commonName", value: commonName }, { name: "organizationName", value: organization }, { name: "countryName", value: "VN" }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: "basicConstraints", cA: false },
    { name: "keyUsage", digitalSignature: true, nonRepudiation: true },
    { name: "subjectKeyIdentifier" },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], passphrase, { algorithm: "aes256" });
  return Buffer.from(forge.asn1.toDer(asn1).getBytes(), "binary");
};

/**
 * Đọc chứng thư ký. Trả null (không ký) nếu chưa cấu hình, sai mật khẩu, hoặc chứng thư hết hạn — có ghi log để người vận hành biết.
 * `devPath`: file dùng khi chạy ngoài production mà không khai báo PDF_SIGNING_P12_PATH.
 */
export const loadSigningCert = ({ env = process.env, devPath = DEV_P12_PATH } = {}) => {
  const p12Path = env.PDF_SIGNING_P12_PATH || (env.NODE_ENV !== "production" ? devPath : null);
  if (!p12Path || !fs.existsSync(p12Path)) return null;
  if (!env.PDF_SIGNING_P12_PATH) console.warn(`[pdf-signing] Đang dùng chứng thư THỬ NGHIỆM ${p12Path}. Môi trường thật phải đặt PDF_SIGNING_P12_PATH.`);
  const p12 = fs.readFileSync(p12Path);
  const passphrase = env.PDF_SIGNING_P12_PASSWORD || "";
  try {
    const parsed = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(p12.toString("binary")), passphrase);
    const certs = (parsed.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || []).map((b) => b.cert);
    const keyBag = parsed.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
      || parsed.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0];
    const privateKey = keyBag?.key;
    if (!privateKey) throw new Error("không có khoá bí mật trong file");
    // chứng thư khớp với khoá bí mật (file có thể kèm chứng thư của CA)
    const cert = certs.find((c) => c.publicKey.n.compareTo(privateKey.n) === 0 && c.publicKey.e.compareTo(privateKey.e) === 0);
    if (!cert) throw new Error("không có chứng thư khớp với khoá bí mật");
    const now = new Date();
    if (now < cert.validity.notBefore || now > cert.validity.notAfter) {
      console.error("[pdf-signing] Chứng thư ký PDF đã hết hạn hoặc chưa tới ngày hiệu lực, PDF sẽ không được ký.");
      return null;
    }
    // giải mã file PKCS#12 (PBKDF2, chậm) đúng 1 lần ở đây; mỗi lần ký chỉ còn băm + ký RSA
    return {
      privateKey,
      cert,
      chain: certs,
      signerName: String(cert.subject.getField("CN")?.value || "NeuroScan AI"),
      selfSigned: cert.isIssuer(cert),
      notAfter: cert.validity.notAfter,
    };
  } catch (err) {
    console.error("[pdf-signing] Không đọc được chứng thư ký PDF (sai mật khẩu hoặc file hỏng), PDF sẽ không được ký:", err.message);
    return null;
  }
};

let cachedSigner;
/** Chứng thư dùng chung của máy chủ (đọc 1 lần). */
export const getPdfSigner = () => {
  if (cachedSigner === undefined) cachedSigner = loadSigningCert();
  return cachedSigner;
};

/** Dòng chữ in trên PDF cho người đọc biết tài liệu đã ký số chưa, ký bởi ai. */
export const signatureNote = (signer) => {
  if (!signer) return "Bản này chưa được ký số.";
  return signer.selfSigned
    ? `Tài liệu được ký số bởi "${signer.signerName}" (chứng thư thử nghiệm do hệ thống tự cấp, chưa được tổ chức chứng thực công nhận).`
    : `Tài liệu được ký số bởi "${signer.signerName}". Mở bằng Adobe Acrobat Reader để kiểm tra chữ ký.`;
};

// ─── Chèn chỗ giữ chữ ký vào PDF đang tạo bằng pdfkit ────────────────────────
// Phỏng theo @signpdf/placeholder-pdfkit 3.3.0 (MIT License, Copyright (c) 2019 The Authors,
// https://github.com/vbuch/node-signpdf). Chép lại vì gói đó chỉ khai báo hỗ trợ pdfkit ^0.11 còn dự án dùng 0.20.
const SIGNATURE_LENGTH = 8192; // số byte dành cho PKCS#7 trong /Contents
const BYTE_RANGE_PLACEHOLDER = "**********"; // @signpdf/signpdf tìm đúng chuỗi này để điền ByteRange
const SIG_FLAGS = { SIGNATURES_EXIST: 1, APPEND_ONLY: 2 };

/**
 * Gọi ngay trước `doc.end()`, khi trang cuối đang mở. Không gọi `.end()` cho các đối tượng tạo ra:
 * chữ ký và widget đóng ở đây, AcroForm do `doc.end()` đóng.
 */
export const addSignaturePlaceholder = (doc, { reason, name, location = "Việt Nam", contactInfo = "", signingTime = new Date() }) => {
  /* eslint-disable no-underscore-dangle, no-new-wrappers */
  const signature = doc.ref({
    Type: "Sig",
    Filter: "Adobe.PPKLite",
    SubFilter: "adbe.pkcs7.detached",
    ByteRange: [0, BYTE_RANGE_PLACEHOLDER, BYTE_RANGE_PLACEHOLDER, BYTE_RANGE_PLACEHOLDER],
    Contents: Buffer.from(String.fromCharCode(0).repeat(SIGNATURE_LENGTH)),
    Reason: new String(reason),
    M: signingTime,
    ContactInfo: new String(contactInfo),
    Name: new String(name),
    Location: new String(location),
    // giá trị chuỗi thường được pdfkit ghi thành tên PDF (/Ten): không được có dấu cách, không thì hỏng cấu trúc file
    Prop_Build: { Filter: { Name: "Adobe.PPKLite" }, App: { Name: "NeuroScan" } },
  });
  if (!doc._acroform) doc.initForm();
  const form = doc._root.data.AcroForm;
  form.data = {
    Type: "AcroForm",
    SigFlags: SIG_FLAGS.SIGNATURES_EXIST | SIG_FLAGS.APPEND_ONLY,
    Fields: form.data.Fields,
    DR: form.data.DR,
  };
  const widget = doc.ref({
    Type: "Annot",
    Subtype: "Widget",
    FT: "Sig",
    Rect: [0, 0, 0, 0], // chữ ký vô hình: phần hiển thị là dòng chữ do service tạo PDF tự in
    V: signature,
    T: new String(`Signature${form.data.Fields.length + 1}`),
    P: doc.page.dictionary,
  });
  doc.page.annotations.push(widget);
  form.data.Fields.push(widget);
  signature.end();
  widget.end();
  /* eslint-enable no-underscore-dangle, no-new-wrappers */
};

/**
 * Bộ ký dùng khoá đã đọc sẵn. Phỏng theo P12Signer của @signpdf/signer-p12 3.3.0 (MIT), bỏ bước giải mã PKCS#12 mỗi lần ký.
 * Thứ tự authenticatedAttributes giữ như bản gốc (cần cho kiểm chữ ký theo chuẩn châu Âu).
 */
class PreparsedSigner extends Signer {
  constructor({ privateKey, cert, chain }) {
    super();
    this.privateKey = privateKey;
    this.cert = cert;
    this.chain = chain || [cert];
  }

  async sign(pdfBuffer, signingTime = undefined) {
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(pdfBuffer.toString("binary"));
    this.chain.forEach((c) => p7.addCertificate(c));
    p7.addSigner({
      key: this.privateKey,
      certificate: this.cert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.signingTime, value: signingTime ?? new Date() },
        { type: forge.pki.oids.messageDigest },
      ],
    });
    p7.sign({ detached: true });
    return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), "binary");
  }
}

/** Ký file PDF đã có chỗ giữ chữ ký. */
export const signPdf = (pdfBuffer, signer) => signpdf.sign(pdfBuffer, new PreparsedSigner(signer));
