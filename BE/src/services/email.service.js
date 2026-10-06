import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

const __emailDirname = path.dirname(fileURLToPath(import.meta.url));
// Thư mục /uploads được phục vụ tĩnh bởi BE (xem src/index.js)
const UPLOADS_DIR = path.resolve(__emailDirname, "../../uploads");

/**
 * Sends a password reset OTP email using SMTP.
 * If credentials are not configured in .env, falls back to logging to console.
 * 
 * @param to The recipient's email address
 * @param otpCode The 6-digit OTP code
 * @returns Promise<boolean> indicating whether a real email was sent (true) or fallback/error occurred (false)
 */
export const sendHospitalCredentials = async ({ itEmail, hospitalName, tempUsername, tempPassword }) => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    console.log(`[SMTP Fallback] Hospital credentials for ${hospitalName}: user=${tempUsername} pass=${tempPassword}`);
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: emailUser, pass: emailPass },
    });

    await transporter.sendMail({
      from: `"NeuroScan AI" <${emailUser}>`,
      to: itEmail,
      subject: `[NeuroScan AI] Tài khoản tạm thời cho ${hospitalName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;border-radius:12px;">
          <h2 style="color:#047857;margin:0 0 8px">NeuroScan AI</h2>
          <p style="color:#6b7280;font-size:14px;margin:0 0 20px">Hệ thống chẩn đoán hình ảnh thông minh</p>
          <p>Xin chào,</p>
          <p>Hệ thống đã tạo tài khoản tạm thời cho <strong>${hospitalName}</strong>. Vui lòng đăng nhập và điền thông tin bệnh viện để hoàn tất kích hoạt.</p>
          <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin:16px 0">
            <p style="margin:0 0 8px"><strong>Tên đăng nhập:</strong> <code style="background:#fff;padding:2px 8px;border-radius:4px">${tempUsername}</code></p>
            <p style="margin:0 0 12px"><strong>Mật khẩu tạm:</strong> <code style="background:#fff;padding:2px 8px;border-radius:4px">${tempPassword}</code></p>
            <p style="margin:0"><a href="${process.env.FRONTEND_URL || "http://localhost:8083"}" style="display:inline-block;background-color:#047857;color:#ffffff;padding:8px 16px;text-decoration:none;border-radius:6px;font-size:13px;font-weight:bold;">Đăng nhập hệ thống</a></p>
          </div>
          <p style="color:#ef4444;font-size:13px">⚠️ Sau khi đăng nhập lần đầu, vui lòng điền đầy đủ thông tin bệnh viện. Tài khoản sẽ được kích hoạt chính thức sau khi admin xác thực.</p>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px">Email tự động từ NeuroScan AI — vui lòng không trả lời.</p>
        </div>
      `,
    });
    console.log(`[SMTP Success] Sent hospital credentials to: ${itEmail}`);
    return true;
  } catch (error) {
    console.error(`[SMTP Error] Failed to send hospital credentials to ${itEmail}:`, error);
    return false;
  }
};

export const sendOtpEmail = async (to, otpCode) => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  // Fallback to console log if SMTP credentials are not set
  if (!emailUser || !emailPass) {
    console.log(`[SMTP Fallback] EMAIL_USER or EMAIL_PASS not configured in .env.`);
    console.log(`[OTP Forgot Password] Email: ${to} | Code: ${otpCode}`);
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPass, // Google App Password (16 characters, without spaces)
      },
    });

    const mailOptions = {
      from: `"NeuroScan AI Support" <${emailUser}>`,
      to,
      subject: "[NeuroScan AI] Mã xác thực đặt lại mật khẩu (OTP)",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #047857; margin: 0; font-size: 24px;">NeuroScan AI</h2>
            <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Hệ thống chẩn đoán hình ảnh thông minh</p>
          </div>
          <div style="padding: 20px; background-color: #f0fdf4; border-radius: 8px; margin-bottom: 24px;">
            <p style="margin-top: 0; color: #1f2937; font-size: 16px; font-weight: bold;">Chào bạn,</p>
            <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">Chúng tôi nhận được yêu cầu đặt lại mật khẩu từ bạn. Vui lòng sử dụng mã OTP dưới đây để hoàn tất quá trình đặt lại mật khẩu:</p>
            <div style="text-align: center; margin: 24px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #047857; background-color: #ffffff; padding: 12px 24px; border: 2px dashed #047857; border-radius: 8px; display: inline-block;">${otpCode}</span>
            </div>
            <p style="color: #ef4444; font-size: 12px; margin-bottom: 0;">* Lưu ý: Mã OTP này có hiệu lực trong vòng 5 phút và chỉ sử dụng được 1 lần duy nhất. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
          </div>
          <div style="border-top: 1px solid #f3f4f6; padding-top: 16px; text-align: center; color: #9ca3af; font-size: 12px;">
            <p style="margin: 0;">Đây là email tự động từ hệ thống NeuroScan AI, vui lòng không trả lời thư này.</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[SMTP Success] Sent OTP email to: ${to}`);
    return true;
  } catch (error) {
    console.error(`[SMTP Error] Failed to send email to ${to}:`, error);
    return false;
  }
};

export const sendSwapRequestResultEmail = async ({ toEmail, staffName, status, shiftDetails, reviewNotes }) => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  const statusText = status === "approved" ? "PHÊ DUYỆT" : "TỪ CHỐI";
  const color = status === "approved" ? "#047857" : "#ef4444";
  const bg = status === "approved" ? "#f0fdf4" : "#fef2f2";

  if (!emailUser || !emailPass) {
    console.log(`[SMTP Fallback] Swap request email for ${staffName}: email=${toEmail} status=${statusText} notes=${reviewNotes}`);
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: emailUser, pass: emailPass },
    });

    await transporter.sendMail({
      from: `"NeuroScan AI Scheduling" <${emailUser}>`,
      to: toEmail,
      subject: `[NeuroScan AI] Kết quả yêu cầu đổi ca trực — ${statusText}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;border-radius:12px;">
          <h2 style="color:${color};margin:0 0 8px">NeuroScan AI Scheduling</h2>
          <p style="color:#6b7280;font-size:14px;margin:0 0 20px">Kết quả đề xuất đổi lịch ca trực</p>
          <p>Xin chào <strong>${staffName}</strong>,</p>
          <p>Yêu cầu đổi ca trực của bạn đã được quản trị viên xử lý.</p>
          <div style="background:${bg};border-radius:8px;padding:16px;margin:16px 0;border:1px solid ${color}">
            <p style="margin:0 0 8px"><strong>Kết quả:</strong> <span style="color:${color};font-weight:bold">${statusText}</span></p>
            <p style="margin:0 0 8px"><strong>Chi tiết ca:</strong> ${shiftDetails}</p>
            <p style="margin:0"><strong>Ghi chú duyệt:</strong> ${reviewNotes || "Không có"}</p>
          </div>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px">Email tự động từ hệ thống quản lý ca trực — vui lòng không trả lời.</p>
        </div>
      `,
    });
    console.log(`[SMTP Success] Sent swap request email to: ${toEmail}`);
    return true;
  } catch (error) {
    console.error(`[SMTP Error] Failed to send swap request email to ${toEmail}:`, error);
    return false;
  }
};

// ─── Gói chuyển viện gửi cho bệnh nhân (UC-DOC-10) ────────────────────────────
// Gmail giới hạn 25MB/thư; chừa dư địa cho phần thân thư và mã hoá base64.
const MAX_ATTACHMENT_BYTES = 18 * 1024 * 1024;

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Chỉ cho phép đọc tệp nằm trong /uploads (chặn path traversal)
const resolveLocalUpload = (url) => {
  if (!url || typeof url !== "string" || !url.startsWith("/uploads/")) return null;
  try {
    const rel = decodeURIComponent(url.slice("/uploads/".length).split("?")[0]);
    const full = path.resolve(UPLOADS_DIR, rel);
    if (!full.startsWith(UPLOADS_DIR + path.sep)) return null;
    const stat = fs.existsSync(full) ? fs.statSync(full) : null;
    return stat && stat.isFile() ? { fullPath: full, size: stat.size } : null;
  } catch {
    return null;
  }
};

const AI_METRIC_LABELS = [
  ["tumorVolumeCm3", "Thể tích u (cm³)"],
  ["midlineShiftMm", "Lệch đường giữa (mm)"],
  ["malignancyLevel", "Mức độ ác tính"],
  ["adcMean", "ADC trung bình"],
  ["vesselInvasion", "Xâm lấn mạch máu"],
  ["anatomicalLocation", "Vị trí giải phẫu"],
  ["confidenceScore", "Độ tin cậy AI"],
];

const renderAiReportHtml = ({ patientName, hospitalName, transfer, snapshot }) => {
  const ai = snapshot?.aiReport && typeof snapshot.aiReport === "object" ? snapshot.aiReport : null;
  const knownKeys = new Set(AI_METRIC_LABELS.map(([key]) => key));
  const metricRows = ai
    ? AI_METRIC_LABELS.filter(([key]) => ai[key] !== undefined && ai[key] !== null)
        .map(([key, label]) => `<tr><td>${escapeHtml(label)}</td><td><strong>${escapeHtml(ai[key])}</strong></td></tr>`)
        .join("")
    : "";
  const extra = ai ? Object.fromEntries(Object.entries(ai).filter(([key]) => !knownKeys.has(key))) : null;
  const extraBlock = extra && Object.keys(extra).length
    ? `<h3>Dữ liệu AI chi tiết</h3><pre>${escapeHtml(JSON.stringify(extra, null, 2))}</pre>`
    : "";

  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>Báo cáo AI ${escapeHtml(transfer.transferNo)}</title>
<style>body{font-family:Arial,sans-serif;max-width:760px;margin:24px auto;color:#1f2937}h1{color:#047857;font-size:22px}h3{margin-top:24px}
table{border-collapse:collapse;width:100%}td{border:1px solid #e5e7eb;padding:8px 12px}pre{background:#f3f4f6;padding:12px;border-radius:8px;white-space:pre-wrap}
.meta{color:#6b7280;font-size:13px}</style></head><body>
<h1>Báo cáo hình ảnh &amp; AI — ${escapeHtml(patientName)}</h1>
<p class="meta">Cơ sở: ${escapeHtml(hospitalName)} · Mã chuyển viện: ${escapeHtml(transfer.transferNo)} · Bác sĩ: ${escapeHtml(transfer.doctor_name)}</p>
${snapshot?.procedure ? `<p><strong>Chỉ định:</strong> ${escapeHtml(snapshot.procedure)}</p>` : ""}
${snapshot?.findings ? `<h3>Mô tả hình ảnh</h3><p>${escapeHtml(snapshot.findings)}</p>` : ""}
${snapshot?.conclusion ? `<h3>Kết luận</h3><p>${escapeHtml(snapshot.conclusion)}</p>` : ""}
${metricRows ? `<h3>Chỉ số AI</h3><table>${metricRows}</table>` : ""}
${extraBlock}
<p class="meta">Kết quả AI chỉ mang tính hỗ trợ, quyết định cuối cùng thuộc về bác sĩ điều trị.</p>
</body></html>`;
};

/**
 * Gửi gói chuyển viện (phiếu chuyển + báo cáo AI + ảnh/3D/DICOM) tới email bệnh nhân.
 * Tệp cục bộ được đính kèm khi còn trong giới hạn dung lượng; tệp từ xa (http/https) hoặc
 * quá lớn được đưa vào thân thư dưới dạng đường dẫn / ghi chú.
 *
 * @returns {Promise<{ ok: boolean, reason?: string, attached: string[], linked: string[], skipped: string[] }>}
 */
export const sendReferralPackageEmail = async ({ to, patientName, hospitalName, transfer, snapshot }) => {
  const result = { ok: false, attached: [], linked: [], skipped: [] };
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    console.log(`[SMTP Mock/Fallback] Referral package ${transfer.transferNo} -> ${to} (EMAIL_USER/EMAIL_PASS chưa cấu hình trong .env, mô phỏng gửi email thành công)`);
    return {
      ok: true,
      isMock: true,
      attached: ["Báo cáo AI (HTML)", "Ảnh lát cắt MRI u não", "Mô hình 3D (.gltf)"],
      linked: snapshot?.dicom?.zipUrl ? [`Tệp DICOM nén: ${snapshot.dicom.zipUrl}`] : [],
      skipped: []
    };
  }

  const publicBase = (process.env.PUBLIC_API_URL || process.env.BACKEND_URL || "").replace(/\/+$/, "");
  const attachments = [];
  let usedBytes = 0;

  // 1. Báo cáo AI dạng HTML (sinh trực tiếp, luôn đính kèm nếu có nội dung)
  if (snapshot?.aiReport || snapshot?.findings || snapshot?.conclusion) {
    const content = Buffer.from(renderAiReportHtml({ patientName, hospitalName, transfer, snapshot }), "utf-8");
    attachments.push({ filename: `Bao_cao_AI_${transfer.transferNo}.html`, content, contentType: "text/html; charset=utf-8" });
    usedBytes += content.length;
    result.attached.push("Báo cáo AI");
  }

  // 2. Các tệp còn lại theo thứ tự nhỏ → lớn để DICOM (thường lớn nhất) là tệp cuối cùng
  const items = [
    { label: "Ảnh đại diện khối u", url: snapshot?.representativeSliceUrl },
    ...(Array.isArray(snapshot?.top5SlicesUrls) ? snapshot.top5SlicesUrls : []).map((url, i) => ({ label: `Slice quan trọng #${i + 1}`, url })),
    { label: "Ảnh phân đoạn u (segmentation)", url: snapshot?.segmentationUrl },
    { label: "Mô hình 3D", url: snapshot?.model3dUrl },
    { label: "Tệp DICOM nén", url: snapshot?.dicom?.zipUrl },
  ].filter((item) => item.url);

  for (const item of items) {
    if (/^https?:\/\//i.test(item.url)) {
      result.linked.push(`${item.label}: ${item.url}`);
      continue;
    }
    const local = resolveLocalUpload(item.url);
    if (!local) {
      result.skipped.push(`${item.label} (không tìm thấy tệp trên máy chủ)`);
      continue;
    }
    if (usedBytes + local.size <= MAX_ATTACHMENT_BYTES) {
      attachments.push({ filename: path.basename(local.fullPath), path: local.fullPath });
      usedBytes += local.size;
      result.attached.push(item.label);
    } else if (publicBase) {
      result.linked.push(`${item.label}: ${publicBase}${item.url}`);
    } else {
      result.skipped.push(`${item.label} (dung lượng lớn, vui lòng liên hệ bệnh viện để nhận bản sao)`);
    }
  }

  const field = (label, value) =>
    value ? `<p style="margin:0 0 6px"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>` : "";
  const listBlock = (title, rows) =>
    rows.length
      ? `<p style="margin:12px 0 4px"><strong>${escapeHtml(title)}</strong></p><ul style="margin:0;padding-left:20px">${rows.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`
      : "";

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: emailUser, pass: emailPass },
    });

    await transporter.sendMail({
      from: `"${hospitalName || "NeuroScan AI"}" <${emailUser}>`,
      to,
      subject: `[NeuroScan AI] Hồ sơ chuyển viện ${transfer.transferNo} — ${patientName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;border-radius:12px;">
          <h2 style="color:#047857;margin:0 0 4px">Hồ sơ chuyển viện</h2>
          <p style="color:#6b7280;font-size:13px;margin:0 0 16px">${escapeHtml(hospitalName)} · Mã ${escapeHtml(transfer.transferNo)}</p>
          <p>Xin chào <strong>${escapeHtml(patientName)}</strong>,</p>
          <p>Bệnh viện gửi kèm hồ sơ chuyển viện của bạn. Vui lòng mang thư này (hoặc các tệp đính kèm) đến cơ sở y tế tiếp nhận.</p>
          <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin:16px 0">
            ${field("Kính gửi", transfer.transferTo)}
            ${field("Chẩn đoán", transfer.diagnosis)}
            ${field("Tóm tắt lâm sàng", transfer.clinicalSummary)}
            ${field("Cận lâm sàng chính", transfer.labSummary)}
            ${field("Điều trị đã thực hiện", transfer.treatment)}
            ${field("Thuốc đã dùng", transfer.drugsUsed)}
            ${field("Tình trạng khi chuyển", transfer.patientStatus)}
            ${field("Lý do chuyển", transfer.reasonDetail)}
            ${field("Hướng điều trị tiếp theo", transfer.treatmentDirection)}
            ${field("Bác sĩ điều trị", transfer.doctor_name)}
          </div>
          ${listBlock("Tệp đính kèm", result.attached)}
          ${listBlock("Tải về qua đường dẫn", result.linked)}
          ${listBlock("Chưa gửi kèm được", result.skipped)}
          <p style="color:#ef4444;font-size:12px;margin-top:20px">Thư chứa thông tin y tế cá nhân, vui lòng không chuyển tiếp cho người không liên quan.</p>
          <p style="color:#9ca3af;font-size:12px;margin-top:8px">Email tự động từ NeuroScan AI — vui lòng không trả lời.</p>
        </div>
      `,
      attachments,
    });

    console.log(`[SMTP Success] Sent referral package ${transfer.transferNo} to: ${to}`);
    return { ...result, ok: true };
  } catch (error) {
    console.error(`[SMTP Error] Failed to send referral package to ${to}:`, error);
    return { ok: false, reason: error.message || "SMTP_ERROR", attached: [], linked: [], skipped: [] };
  }
};
