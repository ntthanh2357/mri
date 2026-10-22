// Tạo chứng thư ký PDF THỬ NGHIỆM (tự ký) cho máy dev: BE/certs/dev-pdf-signing.p12, không mật khẩu.
// Chạy: cd BE && node scripts/create_pdf_signing_cert.js [--force]
// File chứa khoá bí mật: thư mục certs/ đã nằm trong .gitignore, KHÔNG đưa lên git.
// Triển khai thật: mua chứng thư từ tổ chức chứng thực (CA), rồi đặt PDF_SIGNING_P12_PATH + PDF_SIGNING_P12_PASSWORD trong .env.
import fs from "fs";
import path from "path";
import { createSelfSignedP12, DEV_P12_PATH } from "../src/services/pdfSignature.service.js";

if (fs.existsSync(DEV_P12_PATH) && !process.argv.includes("--force")) {
  console.log(`Đã có ${DEV_P12_PATH}. Thêm --force để tạo lại (PDF ký bằng chứng thư cũ vẫn kiểm được, chỉ khác người ký).`);
  process.exit(0);
}
fs.mkdirSync(path.dirname(DEV_P12_PATH), { recursive: true });
fs.writeFileSync(DEV_P12_PATH, createSelfSignedP12(), { mode: 0o600 });
console.log(`Đã tạo chứng thư thử nghiệm: ${DEV_P12_PATH}`);
