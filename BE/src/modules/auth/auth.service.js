/**
 * NeuroScan AI - Authentication & Identity Domain Service
 * Tách tầng nghiệp vụ ra khỏi auth.controller.js theo chuẩn Clean Architecture & SOLID.
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "./models/user.model.js";
import { Otp } from "./models/otp.model.js";
import { sendOtpEmail } from "../../services/email.service.js";
import { authCache } from "../../utils/authCache.util.js";

import { getJwtSecret, getRefreshSecret, generateSecureOtp } from "../../config/jwt.config.js";

export const hashPhone = (phone) => {
  if (!phone) return null;
  const salt = process.env.PHONE_SALT || "neuroscan_phone_salt";
  return crypto.createHmac("sha256", salt).update(phone).digest("hex");
};

export const generateAccessToken = (userId, role, tokenVersion, hospitalId) => {
  const secret = getJwtSecret();
  return jwt.sign({ id: userId, role, tokenVersion, hospitalId }, secret, { expiresIn: "1h", algorithm: "HS256" });
};

export const generateRefreshToken = (userId, role, tokenVersion, hospitalId) => {
  const secret = getRefreshSecret();
  return jwt.sign({ id: userId, role, tokenVersion, hospitalId }, secret, { expiresIn: "7d", algorithm: "HS256" });
};

/**
 * Đăng ký người dùng mới
 */
export const registerUserService = async ({ email, password, role, name, phone, hospitalId, bhytNumber, licenseUrl }) => {
  const userExists = await User.findOne({ email });
  if (userExists) {
    throw { status: 400, message: "Email này đã được đăng ký sử dụng." };
  }

  if (phone) {
    const phoneExists = await User.findOne({ phone: hashPhone(phone) });
    if (phoneExists) {
      throw { status: 400, message: "Số điện thoại này đã được đăng ký sử dụng." };
    }
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const otpCode = generateSecureOtp();
  const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

  const user = new User({
    email,
    passwordHash,
    role,
    phone: hashPhone(phone),
    hospitalId: hospitalId || null,
    profile: {
      fullName: name,
      name,
      bhytNumber: bhytNumber || "",
      licenseUrl: licenseUrl || "",
    },
    isActivated: role !== "patient", // Bệnh nhân cần kích hoạt qua OTP
    otp: {
      code: otpCode,
      expiresAt: otpExpires,
    },
  });

  await user.save();

  if (role === "patient") {
    try {
      await sendOtpEmail(email, otpCode);
    } catch (mailErr) {
      console.warn("Không thể gửi email OTP:", mailErr.message);
    }
  }

  return {
    userId: user._id,
    email: user.email,
    role: user.role,
    name: user.profile.name,
    requiresActivation: role === "patient",
  };
};

/**
 * Đăng nhập người dùng bằng email và mật khẩu
 */
export const loginUserService = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw { status: 401, message: "Email hoặc mật khẩu không chính xác." };
  }

  if (user.isLocked) {
    throw { status: 403, message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên." };
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw { status: 401, message: "Email hoặc mật khẩu không chính xác." };
  }

  const accessToken = generateAccessToken(user._id, user.role, user.tokenVersion || 0, user.hospitalId);
  const refreshToken = generateRefreshToken(user._id, user.role, user.tokenVersion || 0, user.hospitalId);

  // Lưu cache cho lần request sau
  authCache.setUserAuth(user._id, {
    tokenVersion: user.tokenVersion || 0,
    isLocked: user.isLocked,
    hospitalId: user.hospitalId,
    role: user.role,
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      email: user.email,
      role: user.role,
      name: user.profile?.name || user.profile?.fullName,
      hospitalId: user.hospitalId,
      profile: user.profile,
    },
  };
};

/**
 * Đổi mật khẩu người dùng & vô hiệu hóa phiên cũ
 */
export const changePasswordService = async ({ userId, oldPassword, newPassword }) => {
  const user = await User.findById(userId);
  if (!user) {
    throw { status: 404, message: "Người dùng không tồn tại." };
  }

  const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!isMatch) {
    throw { status: 400, message: "Mật khẩu hiện tại không chính xác." };
  }

  const salt = await bcrypt.genSalt(10);
  user.passwordHash = await bcrypt.hash(newPassword, salt);
  user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate tất cả JWT cũ
  await user.save();

  // Xóa cache xác thực lập tức
  authCache.invalidateUser(userId);

  return { success: true, message: "Đổi mật khẩu thành công. Các phiên làm việc khác đã được đăng xuất." };
};

/**
 * Đăng xuất khỏi mọi thiết bị
 */
export const logoutAllDevicesService = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw { status: 404, message: "Người dùng không tồn tại." };
  }

  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  authCache.invalidateUser(userId);
  return { success: true, message: "Đã đăng xuất khỏi tất cả các thiết bị." };
};

export default {
  registerUserService,
  loginUserService,
  changePasswordService,
  logoutAllDevicesService,
  generateAccessToken,
  generateRefreshToken,
};
