import nodemailer from "nodemailer";

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
            <p style="margin:0"><strong>Mật khẩu tạm:</strong> <code style="background:#fff;padding:2px 8px;border-radius:4px">${tempPassword}</code></p>
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
