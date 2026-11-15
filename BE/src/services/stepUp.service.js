import crypto from "crypto";
import { User } from "../models/user.model.js";
import { sendOtpEmail } from "./email.service.js";
import { generateSecureOtp } from "../config/jwt.config.js";

// Xác thực bước 2 (step-up) bằng OTP email trước thao tác nhạy cảm.
// Lộ phiên đăng nhập của người duyệt thôi thì không đủ để duyệt khoản tiền lớn.
export const STEP_UP_VALID_MS = 5 * 60 * 1000;
const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

const hashOtp = (userId, otp) => crypto.createHash("sha256").update(`${userId}|${otp}`).digest("hex");

export const issueStepUpOtp = async (userId) => {
  const user = await User.findById(userId).select("email stepUpOtpLastSentAt");
  if (!user) return { ok: false, status: 404, message: "Không tìm thấy tài khoản." };
  if (!user.email) return { ok: false, status: 400, message: "Tài khoản chưa có email để nhận mã xác thực." };
  if (user.stepUpOtpLastSentAt && Date.now() - user.stepUpOtpLastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, status: 429, message: "Bạn vừa yêu cầu mã xác thực. Vui lòng chờ 60 giây rồi thử lại." };
  }

  const otp = generateSecureOtp();
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        stepUpOtpHash: hashOtp(userId, otp),
        stepUpOtpExpires: new Date(Date.now() + OTP_TTL_MS),
        stepUpOtpAttempts: 0,
        stepUpOtpLastSentAt: new Date(),
      },
    }
  );
  const emailSent = await sendOtpEmail(user.email, otp, {
    subject: "[NeuroScan AI] Mã xác thực phê duyệt giao dịch",
    purpose: "Bạn đang thực hiện thao tác cần xác thực bước 2 (phê duyệt hoàn tiền). Nếu không phải bạn, hãy đổi mật khẩu ngay.",
  });
  return { ok: true, emailSent, otp };
};

export const verifyStepUpCode = async (userId, otp) => {
  // Đếm atomic trước khi so khớp để request song song không lách được giới hạn
  const user = await User.findOneAndUpdate(
    { _id: userId, stepUpOtpAttempts: { $not: { $gte: MAX_ATTEMPTS } } },
    { $inc: { stepUpOtpAttempts: 1 } },
    { new: true }
  ).select("+stepUpOtpHash stepUpOtpExpires stepUpOtpAttempts");

  if (!user) {
    await User.updateOne({ _id: userId }, { $set: { stepUpOtpHash: null, stepUpOtpExpires: null } });
    return { ok: false, status: 429, message: `Bạn đã nhập sai mã quá ${MAX_ATTEMPTS} lần. Vui lòng yêu cầu mã mới.` };
  }
  if (!user.stepUpOtpHash || !user.stepUpOtpExpires || user.stepUpOtpExpires < new Date()) {
    return { ok: false, status: 400, message: "Mã xác thực không còn hiệu lực. Vui lòng yêu cầu mã mới." };
  }
  const expected = Buffer.from(user.stepUpOtpHash, "hex");
  const actual = Buffer.from(hashOtp(userId, otp), "hex");
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return { ok: false, status: 400, message: `Mã xác thực không đúng. Bạn còn ${Math.max(0, MAX_ATTEMPTS - user.stepUpOtpAttempts)} lần thử.` };
  }

  const verifiedAt = new Date();
  await User.updateOne(
    { _id: userId },
    { $set: { stepUpOtpHash: null, stepUpOtpExpires: null, stepUpOtpAttempts: 0, stepUpVerifiedAt: verifiedAt } }
  );
  return { ok: true, validUntil: new Date(verifiedAt.getTime() + STEP_UP_VALID_MS) };
};

export const hasFreshStepUp = async (userId) => {
  const user = await User.findById(userId).select("stepUpVerifiedAt").lean();
  return Boolean(user?.stepUpVerifiedAt) && Date.now() - new Date(user.stepUpVerifiedAt).getTime() <= STEP_UP_VALID_MS;
};
