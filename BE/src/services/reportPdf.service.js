import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import PDFDocument from "pdfkit";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../config/jwt.config.js";

/**
 * UC-PAT-08 — Báo cáo kết quả chụp MRI/CT dạng PDF cho bệnh nhân.
 * - Font Be Vietnam Pro (OFL) để hiển thị đúng tiếng Việt có dấu (font chuẩn của PDF không có).
 * - Link tải dùng token ngắn hạn ký bằng khóa dẫn xuất riêng → không dùng thay token đăng nhập được.
 */

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BE_ROOT = path.join(__dirname, "../..");
const FONT_DIR = path.dirname(require.resolve("@expo-google-fonts/be-vietnam-pro/package.json"));
const FONTS = {
  regular: path.join(FONT_DIR, "400Regular/BeVietnamPro_400Regular.ttf"),
  semibold: path.join(FONT_DIR, "600SemiBold/BeVietnamPro_600SemiBold.ttf"),
  bold: path.join(FONT_DIR, "700Bold/BeVietnamPro_700Bold.ttf"),
};
const COLOR = { navy: "#0B2A55", green: "#067A5E", text: "#0F172A", muted: "#475569", border: "#E2E8F0", soft: "#F8FAFC" };

// ─── Token tải file ─────────────────────────────────────────────────────────
const TOKEN_PURPOSE = "imaging-report-pdf";
const reportSecret = () => `${getJwtSecret()}:${TOKEN_PURPOSE}`;

export const createReportToken = (imagingResultId, userId, expiresIn = "10m") =>
  jwt.sign({ rid: String(imagingResultId), uid: String(userId), purpose: TOKEN_PURPOSE }, reportSecret(), {
    algorithm: "HS256",
    expiresIn,
  });

/** Ném lỗi nếu token sai chữ ký, hết hạn hoặc không phải token tải báo cáo. */
export const verifyReportToken = (token) => {
  const payload = jwt.verify(token, reportSecret(), { algorithms: ["HS256"] });
  if (payload.purpose !== TOKEN_PURPOSE || !payload.rid) throw new Error("Token tải báo cáo không hợp lệ.");
  return payload;
};

// ─── Ảnh phim ───────────────────────────────────────────────────────────────
/** pdfkit chỉ nhúng được JPEG/PNG — nhận diện qua magic bytes, không tin phần mở rộng tên file. */
export const detectImageType = (buf) => {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  return null;
};

/** Tải tối đa `limit` ảnh (file /uploads cục bộ hoặc URL http/https), bỏ qua ảnh lỗi/không hỗ trợ. */
export const loadReportImages = async (urls = [], { limit = 2, timeoutMs = 8000 } = {}) => {
  const out = [];
  for (const url of urls) {
    if (out.length >= limit) break;
    try {
      let buf = null;
      if (typeof url === "string" && url.startsWith("/uploads/")) {
        const abs = path.join(BE_ROOT, url);
        if (!abs.startsWith(path.join(BE_ROOT, "uploads"))) continue; // chặn ../ thoát thư mục
        if (fs.existsSync(abs)) buf = fs.readFileSync(abs);
      } else if (typeof url === "string" && /^https?:\/\//.test(url)) {
        const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
        if (res.ok) buf = Buffer.from(await res.arrayBuffer());
      }
      if (detectImageType(buf)) out.push(buf);
    } catch (err) {
      console.warn("[reportPdf] Bỏ qua ảnh không tải được:", err.message);
    }
  }
  return out;
};

// ─── Dựng PDF ───────────────────────────────────────────────────────────────
const fmtDate = (d, withTime = false) => {
  if (!d) return "—";
  const t = new Date(d);
  if (isNaN(t)) return "—";
  return t.toLocaleString("vi-VN", withTime
    ? { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }
    : { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
};

/**
 * @param {object} imaging  ImagingResult (lean)
 * @param {{hospitalName?: string, images?: Buffer[]}} opts  ảnh đã tải sẵn (JPEG/PNG)
 * @returns {Promise<Buffer>}
 */
export const buildImagingReportPdf = (imaging = {}, { hospitalName = "", images = [] } = {}) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 48, bottom: 56, left: 52, right: 52 },
      info: { Title: `Kết quả chụp ${imaging.imagingType || "MRI"} - ${imaging.patientName || ""}`, Author: hospitalName || "NeuroScan AI" },
    });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("R", FONTS.regular);
    doc.registerFont("S", FONTS.semibold);
    doc.registerFont("B", FONTS.bold);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;

    // Đầu phiếu
    const topY = doc.y;
    doc.font("B").fontSize(11).fillColor(COLOR.navy).text((hospitalName || "Bệnh viện").toUpperCase(), left, topY, { width: width * 0.6 });
    doc.font("R").fontSize(9).fillColor(COLOR.muted)
      .text(`Mã y tế: ${imaging.medicalId || "—"}`, left, topY, { width, align: "right" })
      .text(`Số bệnh án: ${imaging.medicalRecordNumber || "—"}`, { width, align: "right" });
    doc.moveDown(1.6);
    doc.font("B").fontSize(16).fillColor(COLOR.navy)
      .text(`KẾT QUẢ CHẨN ĐOÁN HÌNH ẢNH ${imaging.imagingType || "MRI"}`, left, doc.y, { width, align: "center" });
    doc.moveDown(0.8);

    // Thông tin hành chính (2 cột)
    const rows = [
      ["Họ và tên", imaging.patientName], ["Năm sinh", imaging.birthYear],
      ["Giới tính", imaging.gender], ["Địa chỉ", imaging.address],
      ["Bác sĩ chỉ định", imaging.orderingDoctor], ["Khoa chỉ định", imaging.orderingDepartment],
      ["Ngày chỉ định", fmtDate(imaging.orderDate)], ["Chẩn đoán lâm sàng", imaging.diagnosis],
    ];
    const boxTop = doc.y;
    const colW = (width - 24) / 2;
    let y = boxTop + 10;
    for (let i = 0; i < rows.length; i += 2) {
      let rowH = 0;
      [rows[i], rows[i + 1]].forEach((r, c) => {
        if (!r) return;
        const x = left + 12 + c * (colW + 0);
        doc.font("R").fontSize(8).fillColor(COLOR.muted).text(r[0].toUpperCase(), x, y, { width: colW - 12 });
        doc.font("S").fontSize(10).fillColor(COLOR.text).text(String(r[1] ?? "—") || "—", x, doc.y + 1, { width: colW - 12 });
        rowH = Math.max(rowH, doc.y - y);
      });
      y += rowH + 8;
    }
    doc.lineWidth(0.8).strokeColor(COLOR.border).roundedRect(left, boxTop, width, y - boxTop + 2, 6).stroke();
    doc.y = y + 14;

    const section = (title, body) => {
      if (!body) return;
      doc.x = left;
      doc.font("B").fontSize(10).fillColor(COLOR.green).text(title, left, doc.y, { width });
      doc.moveDown(0.3);
      doc.font("R").fontSize(10.5).fillColor(COLOR.text).text(String(body), { width, lineGap: 2 });
      doc.moveDown(0.9);
    };
    section("KỸ THUẬT CHỤP", [imaging.procedure, imaging.technique].filter(Boolean).join(". "));

    // Ảnh phim (tối đa 2, cạnh nhau)
    const imgs = images.filter((b) => detectImageType(b)).slice(0, 2);
    if (imgs.length) {
      doc.font("B").fontSize(10).fillColor(COLOR.green).text("HÌNH ẢNH TIÊU BIỂU", left, doc.y, { width });
      doc.moveDown(0.4);
      const gap = 12;
      const box = Math.min(220, (width - gap) / 2);
      if (doc.y + box > doc.page.height - doc.page.margins.bottom) doc.addPage();
      const imgTop = doc.y;
      imgs.forEach((buf, i) => {
        try {
          doc.image(buf, left + i * (box + gap), imgTop, { fit: [box, box], align: "center", valign: "center" });
        } catch (err) {
          console.warn("[reportPdf] Không nhúng được ảnh:", err.message);
        }
      });
      doc.y = imgTop + box + 14;
    }

    section("MÔ TẢ HÌNH ẢNH", imaging.findings);
    section("KẾT LUẬN", imaging.conclusion);

    // Chữ ký
    if (doc.y + 70 > doc.page.height - doc.page.margins.bottom) doc.addPage();
    doc.x = left;
    doc.font("R").fontSize(9.5).fillColor(COLOR.muted).text(`Ngày báo cáo: ${fmtDate(imaging.reportDate || imaging.signedAt)}`, left, doc.y, { width, align: "right" });
    doc.font("S").fontSize(10.5).fillColor(COLOR.text).text(`Bác sĩ đọc phim: ${imaging.radiologist || "—"}`, { width, align: "right" });
    if (imaging.isSigned) {
      doc.font("S").fontSize(9.5).fillColor(COLOR.green).text(`Đã ký số điện tử lúc ${fmtDate(imaging.signedAt, true)}`, { width, align: "right" });
    }

    // Chân trang
    doc.moveDown(2);
    doc.font("R").fontSize(8).fillColor(COLOR.muted).text(
      `Tài liệu tạo từ hệ thống NeuroScan AI lúc ${fmtDate(new Date(), true)}. Kết quả chỉ có giá trị khi đã được bác sĩ ký duyệt; mọi thắc mắc vui lòng liên hệ bác sĩ điều trị.`,
      left, doc.y, { width, align: "center" },
    );
    doc.end();
  });
