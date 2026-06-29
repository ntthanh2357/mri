import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { Hospital } from "../models/hospital.model.js";
import { sendOtpEmail } from "../services/email.service.js";
import { Otp } from "../models/otp.model.js";
import { AuditLog } from "../models/auditLog.model.js";
import crypto from "crypto";

const hashPhone = (phone) => {
  if (!phone) return null;
  const salt = process.env.PHONE_SALT || "neuroscan_phone_salt";
  return crypto.createHmac("sha256", salt).update(phone).digest("hex");
};



// Helper function to generate JWT Access Token
const generateAccessToken = (userId, role, tokenVersion, hospitalId) => {
  const secret = process.env.JWT_SECRET || "access_secret";
  return jwt.sign({ id: userId, role, tokenVersion, hospitalId }, secret, { expiresIn: "1h" });
};

// Helper function to generate JWT Refresh Token
const generateRefreshToken = (userId, role, tokenVersion, hospitalId) => {
  const secret = process.env.JWT_REFRESH_SECRET || "refresh_secret";
  return jwt.sign({ id: userId, role, tokenVersion, hospitalId }, secret, { expiresIn: "7d" });
};

// @desc    Register a new user
// @route   POST /auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { email, password, role, name, phone, bhytNumber, licenseUrl, hospitalId } = req.body;

    // Validate inputs
    if (!email || !password || !name || !role) {
      res.status(400).json({ message: "Vui lòng nhập đầy đủ các trường bắt buộc (email, password, name, role)." });
      return;
    }

    const rolesAvailable = ["patient", "doctor", "admin", "hospital_admin", "technician", "nurse"];
    if (!rolesAvailable.includes(role)) {
      res.status(400).json({ message: "Vai trò (role) không hợp lệ." });
      return;
    }

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      res.status(400).json({ message: "Email này đã được đăng ký sử dụng." });
      return;
    }

    if (phone) {
      const phoneExists = await User.findOne({ phone: hashPhone(phone) });
      if (phoneExists) {
        res.status(400).json({ message: "Số điện thoại này đã được đăng ký sử dụng." });
        return;
      }
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new User({
      email,
      phone: phone ? hashPhone(phone) : undefined,
      passwordHash,
      role,
      hospitalId: role !== "patient" ? hospitalId : undefined,
      isVerified: role === "patient" ? true : false, // Patients are auto-verified, Doctors need admin verification for CCHN
      profile: {
        name,
        photoUrl: "",
        bhytNumber: role === "patient" ? bhytNumber || "" : "",
        licenseUrl: role === "doctor" ? licenseUrl || "" : "",
      },
    });

    await newUser.save();

    // Log the change
    try {
      await AuditLog.create({
        action: "create-staff",
        entity: "User",
        entityId: newUser._id,
        performedBy: req.user ? req.user.id : newUser._id,
        details: `Tài khoản mới ${email} với vai trò ${role} đã được tạo cho bệnh viện ID ${hospitalId || "N/A"}`,
      });
    } catch (logErr) {
      console.error("Lỗi ghi log đăng ký tài khoản:", logErr);
    }

    res.status(201).json({
      message: "Đăng ký tài khoản thành công!",
      user: {
        id: newUser._id,
        email: newUser.email,
        role: newUser.role,
        hospitalId: newUser.hospitalId,
        isVerified: newUser.isVerified,
        profile: newUser.profile,
      },
    });
  } catch (error) {
    console.error("Lỗi đăng ký:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi trên máy chủ khi đăng ký tài khoản.", error: error.message });
  }
};

// @desc    Login user
// @route   POST /auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "Vui lòng nhập đầy đủ email và mật khẩu." });
      return;
    }

    // Nếu nhập mã BV (VD: BV_003, BVBM) → tìm user qua hospital.code
    let user;
    const hospital = await Hospital.findOne({ code: email.trim().toUpperCase() }).lean();
    if (hospital) {
      if (hospital.status === "active") {
        res.status(400).json({ message: "Tài khoản tạm thời đã hết hạn sử dụng. Vui lòng đăng nhập bằng Email đăng nhập chính thức của bệnh viện." });
        return;
      }
      user = await User.findOne({ hospitalId: hospital._id, role: 'hospital_admin' });
    } else {
      user = await User.findOne({
        $or: [
          { email: email.toLowerCase() },
          { phone: hashPhone(email) }
        ]
      });
    }
    if (!user) {
      res.status(400).json({ message: "Email hoặc mật khẩu không chính xác." });
      return;
    }

    // Reject login if account is locked
    if (user.isLocked) {
      res.status(403).json({ message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên." });
      return;
    }

    // Reject login if user's hospital is deactivated/locked
    if (user.hospitalId) {
      const hospitalObj = await Hospital.findById(user.hospitalId).select("isActive");
      if (hospitalObj && hospitalObj.isActive === false) {
        res.status(403).json({ message: "Bệnh viện của bạn đang bị khóa. Vui lòng liên hệ quản trị viên." });
        return;
      }
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({ message: "Email hoặc mật khẩu không chính xác." });
      return;
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id.toString(), user.role, user.tokenVersion || 0, user.hospitalId);
    const refreshToken = generateRefreshToken(user._id.toString(), user.role, user.tokenVersion || 0, user.hospitalId);

    // Staff roles created by hospital admin must activate on first login
    const STAFF_ROLES = ["doctor", "nurse", "technician", "hospital_admin"];
    const requiresActivation = !user.isVerified && STAFF_ROLES.includes(user.role);

    res.status(200).json({
      message: "Đăng nhập thành công!",
      accessToken,
      refreshToken,
      requiresActivation,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        hospitalId: user.hospitalId,
        isVerified: user.isVerified,
        profile: user.profile,
      },
    });
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi trên máy chủ khi đăng nhập.", error: error.message });
  }
};

// @desc    Get current user details
// @route   GET /auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    let user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ message: "Không tìm thấy thông tin người dùng." });
      return;
    }

    // Check Premium expiration
    if (user.isPremium && user.premiumUntil && new Date() > user.premiumUntil) {
      if (user.autoRenew) {
        // Auto-renew: Charge 2000 VNĐ and extend by 1 minute
        user.premiumUntil = new Date(Date.now() + 60 * 1000);
        await user.save();
        console.log(`[Auto-Renew] Automatically renewed Premium for ${user.email}. Charged 2000 VNĐ. Next expiration: ${user.premiumUntil.toISOString()}`);
      } else {
        // Expire: Set isPremium to false
        user.isPremium = false;
        user.premiumUntil = null;
        await user.save();
        console.log(`[Subscription Expired] Premium expired for ${user.email} (autoRenew was false).`);
      }
    }

    // Return user details without passwordHash
    const userResponse = await User.findById(req.user.id).select("-passwordHash");
    res.status(200).json({ user: userResponse });
  } catch (error) {
    console.error("Lỗi lấy thông tin cá nhân:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi lấy thông tin người dùng.", error: error.message });
  }
};

// @desc    Refresh token
// @route   POST /auth/refresh
// @access  Public
export const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ message: "Thiếu Refresh Token." });
      return;
    }

    const secret = process.env.JWT_REFRESH_SECRET || "refresh_secret";

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, secret);

    // Fetch user to verify active session version
    const user = await User.findById(decoded.id).select("tokenVersion role");
    if (!user) {
      res.status(401).json({ message: "Người dùng không tồn tại." });
      return;
    }

    const tokenVersionInJwt = decoded.tokenVersion !== undefined ? decoded.tokenVersion : 0;
    if (user.tokenVersion !== tokenVersionInJwt) {
      res.status(401).json({ message: "Refresh Token đã hết hạn hoặc phiên đăng nhập đã bị đăng xuất." });
      return;
    }

    // Generate new access token
    const accessToken = generateAccessToken(decoded.id, decoded.role, user.tokenVersion);

    res.status(200).json({
      accessToken,
    });
  } catch (error) {
    res.status(401).json({ message: "Refresh Token không hợp lệ hoặc đã hết hạn.", error: error.message });
  }
};

// @desc    Firebase/Google SSO Login
// @route   POST /auth/firebase-login
// @access  Public
export const firebaseLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      res.status(400).json({ message: "Thiếu ID Token." });
      return;
    }

    const apiKey = process.env.FIREBASE_API_KEY || "AIzaSyAaKP0Q5HpkLlVGfMo9Bz2TmIU2wOVSyoM";

    // Verify token using Firebase Auth REST API (requires Firebase Web API Key)
    const firebaseResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (!firebaseResponse.ok) {
      res.status(400).json({ message: "Token xác thực Google không hợp lệ hoặc đã hết hạn." });
      return;
    }

    const data = await firebaseResponse.json();
    if (!data.users || data.users.length === 0) {
      res.status(400).json({ message: "Không tìm thấy thông tin người dùng từ Token." });
      return;
    }

    const googleUser = data.users[0];
    const { email, displayName, photoUrl } = googleUser;

    if (!email) {
      res.status(400).json({ message: "Không thể lấy email từ Google Token." });
      return;
    }

    // Check if user exists
    let user = await User.findOne({ email });
    if (!user) {
      // Auto register as a patient if not exists
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(Math.random().toString(36), salt); // Random pass for SSO user

      user = new User({
        email,
        passwordHash,
        role: "patient",
        isVerified: true,
        profile: {
          name: displayName || email.split("@")[0],
          photoUrl: photoUrl || "",
        },
      });
      await user.save();
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id.toString(), user.role, user.tokenVersion || 0);
    const refreshToken = generateRefreshToken(user._id.toString(), user.role, user.tokenVersion || 0);

    res.status(200).json({
      message: "Đăng nhập Google thành công!",
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        profile: user.profile,
      },
    });
  } catch (error) {
    console.error("Lỗi đăng nhập Google:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi trên máy chủ khi đăng nhập Google.", error: error.message });
  }
};

// @desc    SSO Login (Google)
// @route   POST /auth/sso/:provider
// @access  Public
export const ssoLogin = async (req, res) => {
  const { provider } = req.params;

  if (provider === "google") {
    try {
      const { idToken } = req.body;
      if (!idToken) {
        res.status(400).json({ message: "Thiếu ID Token." });
        return;
      }


      const apiKey = process.env.FIREBASE_API_KEY || "AIzaSyAaKP0Q5HpkLlVGfMo9Bz2TmIU2wOVSyoM";

      // Verify token using Firebase Auth REST API (requires Firebase Web API Key)
      const firebaseResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!firebaseResponse.ok) {
        res.status(400).json({ message: "Token xác thực Google không hợp lệ hoặc đã hết hạn." });
        return;
      }

      const data = await firebaseResponse.json();
      if (!data.users || data.users.length === 0) {
        res.status(400).json({ message: "Không tìm thấy thông tin người dùng từ Token." });
        return;
      }

      const googleUser = data.users[0];
      const { email, displayName, photoUrl } = googleUser;

      if (!email) {
        res.status(400).json({ message: "Không thể lấy email từ Google Token." });
        return;
      }

      // Check if user exists
      let user = await User.findOne({ email });
      if (!user) {
        // Auto register as a patient if not exists
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(Math.random().toString(36), salt);

        user = new User({
          email,
          passwordHash,
          role: "patient",
          isVerified: true,
          profile: {
            name: displayName || email.split("@")[0],
            photoUrl: photoUrl || "",
          },
        });
        await user.save();
      }

      // Generate tokens
      const accessToken = generateAccessToken(user._id.toString(), user.role, user.tokenVersion || 0);
      const refreshToken = generateRefreshToken(user._id.toString(), user.role, user.tokenVersion || 0);

      res.status(200).json({
        message: "Đăng nhập Google thành công!",
        accessToken,
        refreshToken,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
          profile: user.profile,
        },
      });
    } catch (error) {
      console.error("Lỗi đăng nhập Google:", error);
      res.status(500).json({ message: "Đã xảy ra lỗi trên máy chủ khi đăng nhập Google.", error: error.message });
    }
    return;
  }

  res.status(400).json({ message: `Provider '${provider}' không được hỗ trợ.` });
};

// @desc    Logout from all devices by invalidating all active sessions
// @route   POST /auth/logout/all
// @access  Private
export const logoutAll = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ message: "Không tìm thấy người dùng." });
      return;
    }

    // Increment tokenVersion to invalidate all existing tokens
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.status(200).json({ message: "Đã đăng xuất khỏi tất cả các thiết bị thành công." });
  } catch (error) {
    console.error("Lỗi đăng xuất toàn bộ thiết bị:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi trên máy chủ khi đăng xuất.", error: error.message });
  }
};

// @desc    Change password / Activate account
// @route   PUT /auth/password
// @access  Private
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, newEmail } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: "Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới." });
      return;
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ message: "Không tìm thấy người dùng." });
      return;
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({ message: "Mật khẩu hiện tại không chính xác." });
      return;
    }

    // If newEmail is supplied (for temporary email transition)
    if (newEmail && newEmail.trim()) {
      const emailLower = newEmail.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailLower)) {
        return res.status(400).json({ message: "Định dạng email đăng nhập mới không hợp lệ." });
      }

      // Check if email already taken
      const emailConflict = await User.findOne({ email: emailLower, _id: { $ne: user._id } });
      if (emailConflict) {
        return res.status(409).json({ message: "Email đăng nhập này đã được sử dụng bởi tài khoản khác." });
      }

      // Check overlaps if hospital admin
      if (user.role === "hospital_admin" && user.hospitalId) {
        const hospital = await Hospital.findById(user.hospitalId);
        if (hospital) {
          if (hospital.contactEmail && emailLower === hospital.contactEmail.toLowerCase()) {
            return res.status(400).json({ message: "Email đăng nhập mới không được trùng với Email liên hệ chung của bệnh viện." });
          }
          if (hospital.itContact?.email && emailLower === hospital.itContact.email.toLowerCase()) {
            return res.status(400).json({ message: "Email đăng nhập mới không được trùng với Email IT phụ trách." });
          }
          // Sync to hospital loginEmail
          hospital.loginEmail = emailLower;
          await hospital.save();
        }
      }

      user.email = emailLower;
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);

    // Auto-activate account if it was pending activation (first-time staff activation)
    const wasActivated = !user.isVerified;
    if (wasActivated) {
      user.isVerified = true;
    }

    // Optional: Increment tokenVersion to logout of all other sessions when password changes
    user.tokenVersion = (user.tokenVersion || 0) + 1;

    await user.save();

    const accessToken = generateAccessToken(user._id.toString(), user.role, user.tokenVersion || 0, user.hospitalId);
    const refreshToken = generateRefreshToken(user._id.toString(), user.role, user.tokenVersion || 0, user.hospitalId);

    res.status(200).json({
      message: "Đổi mật khẩu thành công!",
      activated: wasActivated,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        hospitalId: user.hospitalId,
        isVerified: user.isVerified,
      }
    });
  } catch (error) {
    console.error("Lỗi đổi mật khẩu:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi trên máy chủ khi đổi mật khẩu.", error: error.message });
  }
};

// @desc    Forgot password (request OTP)
// @route   POST /auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ message: "Vui lòng cung cấp email." });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({ message: "Email này không tồn tại trong hệ thống." });
      return;
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // Expires in 5 minutes

    user.otpCode = otpCode;
    user.otpExpires = otpExpires;
    await user.save();

    // Send OTP via email (falls back to console log if SMTP is not configured)
    const emailSent = await sendOtpEmail(email, otpCode);

    res.status(200).json({
      message: emailSent
        ? "Mã OTP đã được gửi thành công đến Gmail của bạn."
        : "Mã OTP đã được tạo thành công (Xem tại terminal của Server do chưa cấu hình SMTP).",
      debugOtp: process.env.NODE_ENV !== "production" ? otpCode : undefined,
    });
  } catch (error) {
    console.error("Lỗi quên mật khẩu:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi trên máy chủ khi yêu cầu OTP.", error: error.message });
  }
};

// @desc    Verify OTP and reset password
// @route   POST /auth/verify-otp
// @access  Public
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      res.status(400).json({ message: "Vui lòng cung cấp đầy đủ email, mã OTP và mật khẩu mới." });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({ message: "Email này không tồn tại trong hệ thống." });
      return;
    }

    // Verify OTP code and expiration
    if (!user.otpCode || user.otpCode !== otp) {
      res.status(400).json({ message: "Mã OTP không chính xác." });
      return;
    }

    if (!user.otpExpires || user.otpExpires < new Date()) {
      res.status(400).json({ message: "Mã OTP đã hết hạn." });
      return;
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);

    // Clear OTP fields
    user.otpCode = undefined;
    user.otpExpires = undefined;

    // Increment tokenVersion to invalidate any active sessions
    user.tokenVersion = (user.tokenVersion || 0) + 1;

    await user.save();

    res.status(200).json({ message: "Đặt lại mật khẩu thành công!" });
  } catch (error) {
    console.error("Lỗi xác thực OTP:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi trên máy chủ khi đặt lại mật khẩu.", error: error.message });
  }
};

// @desc    Request OTP for phone login
// @route   POST /auth/phone-login-request
// @access  Public
export const phoneLoginRequest = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      res.status(400).json({ message: "Vui lòng cung cấp số điện thoại." });
      return;
    }

    // Hash phone number to match database records
    const hashedPhone = hashPhone(phone);

    // Find user by phone
    const user = await User.findOne({ phone: hashedPhone });
    if (!user) {
      res.status(404).json({ message: "Số điện thoại này chưa được đăng ký trong hệ thống." });
      return;
    }

    // Check if account is locked
    if (user.isLocked) {
      res.status(403).json({ message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên." });
      return;
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // Expires in 5 minutes

    user.otpCode = otpCode;
    user.otpExpires = otpExpires;
    await user.save();

    // Print OTP to server console (since we don't have an SMS gateway configured)
    console.log(`\n--- [OTP Phone Login] ---`);
    console.log(`Phone: ${phone}`);
    console.log(`Code: ${otpCode}`);
    console.log(`-------------------------\n`);

    res.status(200).json({
      message: "Mã OTP đăng nhập đã được gửi (Vui lòng kiểm tra console/log của Server).",
      debugOtp: process.env.NODE_ENV !== "production" ? otpCode : undefined,
    });
  } catch (error) {
    console.error("Lỗi yêu cầu OTP đăng nhập:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi trên máy chủ khi yêu cầu OTP.", error: error.message });
  }
};

// @desc    Verify OTP and login via phone
// @route   POST /auth/phone-login-verify
// @access  Public
export const phoneLoginVerify = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      res.status(400).json({ message: "Vui lòng cung cấp số điện thoại và mã OTP." });
      return;
    }

    // Hash phone number to match database records
    const hashedPhone = hashPhone(phone);

    // Find user by phone
    const user = await User.findOne({ phone: hashedPhone });
    if (!user) {
      res.status(404).json({ message: "Số điện thoại này chưa được đăng ký trong hệ thống." });
      return;
    }

    // Check if account is locked
    if (user.isLocked) {
      res.status(403).json({ message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên." });
      return;
    }

    // Verify OTP code and expiration
    if (!user.otpCode || user.otpCode !== otp) {
      res.status(400).json({ message: "Mã OTP không chính xác." });
      return;
    }

    if (!user.otpExpires || user.otpExpires < new Date()) {
      res.status(400).json({ message: "Mã OTP đã hết hạn." });
      return;
    }

    // Clear OTP fields
    user.otpCode = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Generate tokens
    const accessToken = generateAccessToken(user._id.toString(), user.role, user.tokenVersion || 0, user.hospitalId);
    const refreshToken = generateRefreshToken(user._id.toString(), user.role, user.tokenVersion || 0, user.hospitalId);

    // Staff roles created by hospital admin must activate on first login
    const STAFF_ROLES = ["doctor", "nurse", "technician", "receptionist", "hospital_admin"];
    const requiresActivation = !user.isVerified && STAFF_ROLES.includes(user.role);

    res.status(200).json({
      message: "Đăng nhập thành công!",
      accessToken,
      refreshToken,
      requiresActivation,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        hospitalId: user.hospitalId,
        isVerified: user.isVerified,
        profile: user.profile,
      },
    });
  } catch (error) {
    console.error("Lỗi xác thực OTP đăng nhập:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi trên máy chủ khi xác thực OTP.", error: error.message });
  }
};

// @desc    Downgrade to Basic package
// @route   POST /auth/premium/downgrade
// @access  Private
export const downgradeToBasic = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }
    user.isPremium = false;
    user.premiumUntil = null;
    await user.save();
    res.status(200).json({ message: "Đã chuyển về Gói Cơ bản thành công.", user });
  } catch (error) {
    console.error("Lỗi hạ cấp gói:", error);
    res.status(500).json({ message: "Lỗi máy chủ khi hạ cấp gói.", error: error.message });
  }
};

// @desc    Cancel Premium auto-renewal
// @route   POST /auth/premium/cancel-renew
// @access  Private
export const cancelPremiumRenew = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }
    user.autoRenew = false;
    await user.save();
    res.status(200).json({ message: "Đã hủy gia hạn tự động thành công. Bạn vẫn được sử dụng Premium đến hết hạn.", user });
  } catch (error) {
    console.error("Lỗi hủy gia hạn gói:", error);
    res.status(500).json({ message: "Lỗi máy chủ khi hủy gia hạn gói.", error: error.message });
  }
};
