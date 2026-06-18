import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { sendOtpEmail } from "../services/email.service.js";
import { Otp } from "../models/otp.model.js";
import crypto from "crypto";

const hashPhone = (phone) => {
  if (!phone) return null;
  const salt = process.env.PHONE_SALT || "neuroscan_phone_salt";
  return crypto.createHmac("sha256", salt).update(phone).digest("hex");
};



// Helper function to generate JWT Access Token
const generateAccessToken = (userId, role, tokenVersion) => {
  const secret = process.env.JWT_SECRET || "access_secret";
  return jwt.sign({ id: userId, role, tokenVersion }, secret, { expiresIn: "1h" });
};

// Helper function to generate JWT Refresh Token
const generateRefreshToken = (userId, role, tokenVersion) => {
  const secret = process.env.JWT_REFRESH_SECRET || "refresh_secret";
  return jwt.sign({ id: userId, role, tokenVersion }, secret, { expiresIn: "7d" });
};

// @desc    Register a new user
// @route   POST /auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { email, password, role, name, phone, bhytNumber, licenseUrl } = req.body;

    // Validate inputs
    if (!email || !password || !name || !role) {
      res.status(400).json({ message: "Vui lòng nhập đầy đủ các trường bắt buộc (email, password, name, role)." });
      return;
    }

    if (!["patient", "doctor", "admin"].includes(role)) {
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
      isVerified: role === "patient" ? true : false, // Patients are auto-verified, Doctors need admin verification for CCHN
      profile: {
        name,
        photoUrl: "",
        bhytNumber: role === "patient" ? bhytNumber || "" : "",
        licenseUrl: role === "doctor" ? licenseUrl || "" : "",
      },
    });

    await newUser.save();

    res.status(201).json({
      message: "Đăng ký tài khoản thành công!",
      user: {
        id: newUser._id,
        email: newUser.email,
        role: newUser.role,
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

    // Find user by email or phone
    const user = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { phone: hashPhone(email) }
      ]
    });
    if (!user) {
      res.status(400).json({ message: "Email hoặc mật khẩu không chính xác." });
      return;
    }

    // Reject login if account is locked
    if (user.isLocked) {
      res.status(403).json({ message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên." });
      return;
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({ message: "Email hoặc mật khẩu không chính xác." });
      return;
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id.toString(), user.role, user.tokenVersion || 0);
    const refreshToken = generateRefreshToken(user._id.toString(), user.role, user.tokenVersion || 0);

    res.status(200).json({
      message: "Đăng nhập thành công!",
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
    console.error("Lỗi đăng nhập:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi trên máy chủ khi đăng nhập.", error: error.message });
  }
};

// @desc    Get current user details
// @route   GET /auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash");
    if (!user) {
      res.status(404).json({ message: "Không tìm thấy thông tin người dùng." });
      return;
    }
    res.status(200).json({ user });
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

// @desc    SSO Login (Google/Zalo)
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

      // Handle mock token for Google SSO in local development
      if (idToken === "mock_google_token_123") {
        let user = await User.findOne({ email: "google_test@neuroscan.com" });
        if (!user) {
          const salt = await bcrypt.genSalt(10);
          const passwordHash = await bcrypt.hash(Math.random().toString(36), salt);
          user = new User({
            email: "google_test@neuroscan.com",
            passwordHash,
            role: "patient",
            isVerified: true,
            profile: {
              name: "Google Test User",
              photoUrl: "",
            },
          });
          await user.save();
        }
        const accessToken = generateAccessToken(user._id.toString(), user.role, user.tokenVersion || 0);
        const refreshToken = generateRefreshToken(user._id.toString(), user.role, user.tokenVersion || 0);
        res.status(200).json({
          message: "Đăng nhập Google thành công! (MOCK)",
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

  if (provider === "zalo") {
    const { accessToken } = req.body;
    if (!accessToken) {
      res.status(400).json({ message: "Thiếu Zalo Access Token." });
      return;
    }

    // 1. Handle mock token first for easy testing without hitting real Zalo API
    if (accessToken === "mock_zalo_token_123") {
      try {
        let user = await User.findOne({ email: "zalo_test@neuroscan.com" });
        if (!user) {
          user = new User({
            email: "zalo_test@neuroscan.com",
            passwordHash: await bcrypt.hash(Math.random().toString(36), 10),
            role: "patient",
            isVerified: true,
            profile: {
              name: "Zalo Test User",
              photoUrl: "",
            },
          });
          await user.save();
        }
        const jwtAccessToken = generateAccessToken(user._id.toString(), user.role, user.tokenVersion || 0);
        const jwtRefreshToken = generateRefreshToken(user._id.toString(), user.role, user.tokenVersion || 0);
        res.status(200).json({
          message: "Đăng nhập Zalo thành công! (MOCK)",
          accessToken: jwtAccessToken,
          refreshToken: jwtRefreshToken,
          user: {
            id: user._id,
            email: user.email,
            role: user.role,
            isVerified: user.isVerified,
            profile: user.profile,
          },
        });
        return;
      } catch (err) {
        console.error("Lỗi đăng nhập Zalo Mock:", err);
        res.status(500).json({ message: "Đã xảy ra lỗi khi đăng nhập Zalo Mock.", error: err.message });
        return;
      }
    }

    // 2. Real Zalo login flow
    try {
      // In real-world, call Zalo Graph API to verify token
      const zaloResponse = await fetch("https://graph.zalo.me/v2.0/me?fields=id,name,picture", {
        method: "GET",
        headers: { access_token: accessToken },
      });

      if (!zaloResponse.ok) {
        res.status(400).json({ message: "Token xác thực Zalo không hợp lệ." });
        return;
      }

      const zaloData = await zaloResponse.json();
      
      // Safety check: Zalo Graph API sometimes returns 200 OK with error body
      if (zaloData.error || !zaloData.id) {
        res.status(400).json({ 
          message: "Xác thực Zalo thất bại từ Zalo Server.", 
          error: zaloData.message || "Invalid Zalo Token response" 
        });
        return;
      }

      const zaloId = zaloData.id;
      const name = zaloData.name || "Zalo User";
      const photoUrl = zaloData.picture?.data?.url || "";

      // Since Zalo doesn't guarantee return of email (needs special permission), 
      // we can map the user by their unique zaloId or mock an email like zalo_id@gmail.com
      const email = `zalo_${zaloId}@gmail.com`;

      let user = await User.findOne({ email });
      if (!user) {
        user = new User({
          email,
          passwordHash: await bcrypt.hash(Math.random().toString(36), 10),
          role: "patient",
          isVerified: true,
          profile: {
            name,
            photoUrl,
          },
        });
        await user.save();
      }

      const jwtAccessToken = generateAccessToken(user._id.toString(), user.role, user.tokenVersion || 0);
      const jwtRefreshToken = generateRefreshToken(user._id.toString(), user.role, user.tokenVersion || 0);

      res.status(200).json({
        message: "Đăng nhập Zalo thành công!",
        accessToken: jwtAccessToken,
        refreshToken: jwtRefreshToken,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
          profile: user.profile,
        },
      });
    } catch (err) {
      console.error("Lỗi xác thực Zalo:", err);
      res.status(500).json({ message: "Đã xảy ra lỗi khi xác thực tài khoản Zalo.", error: err.message });
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

// @desc    Change password
// @route   PUT /auth/password
// @access  Private
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

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

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    
    // Optional: Increment tokenVersion to logout of all other sessions when password changes
    user.tokenVersion = (user.tokenVersion || 0) + 1;

    await user.save();

    res.status(200).json({ message: "Đổi mật khẩu thành công!" });
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

// @desc    Request OTP for Phone registration
// @route   POST /auth/phone-register-request
// @access  Public
export const requestPhoneRegisterOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      res.status(400).json({ message: "Vui lòng cung cấp số điện thoại." });
      return;
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      res.status(400).json({ message: "Số điện thoại phải chứa đúng 10 chữ số." });
      return;
    }

    // Check if user already exists (using hashed phone)
    const userExists = await User.findOne({ phone: hashPhone(phone) });
    if (userExists) {
      res.status(400).json({ message: "Số điện thoại này đã được đăng ký sử dụng." });
      return;
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 mins expiration

    // Upsert OTP in database (using hashed phone)
    await Otp.findOneAndUpdate(
      { phone: hashPhone(phone) },
      { otpCode, otpExpires },
      { upsert: true, new: true }
    );

    // Print OTP in terminal console for easy local testing
    console.log(`\n\x1b[33m[SMS OTP MOCK] Mã OTP đăng ký của số điện thoại ${phone} là: ${otpCode}\x1b[0m\n`);

    res.status(200).json({
      message: "Mã OTP đã được tạo thành công (Xem tại terminal của Server).",
      debugOtp: process.env.NODE_ENV !== "production" ? otpCode : undefined,
    });
  } catch (error) {
    console.error("Lỗi yêu cầu OTP đăng ký:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi trên máy chủ khi yêu cầu OTP đăng ký.", error: error.message });
  }
};

// @desc    Verify Phone OTP and register user
// @route   POST /auth/phone-register-verify
// @access  Public
export const verifyPhoneRegisterOtp = async (req, res) => {
  try {
    const { phone, otp, name, email, password, role, bhytNumber, licenseUrl } = req.body;

    if (!phone || !otp || !name || !email || !password || !role) {
      res.status(400).json({ message: "Vui lòng cung cấp đầy đủ thông tin bắt buộc." });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ message: "Địa chỉ email không đúng định dạng chuẩn." });
      return;
    }

    // Check if email already exists
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      res.status(400).json({ message: "Email này đã được đăng ký sử dụng." });
      return;
    }

    // Find and check OTP (using hashed phone)
    const otpDoc = await Otp.findOne({ phone: hashPhone(phone) });
    if (!otpDoc || otpDoc.otpCode !== otp) {
      res.status(400).json({ message: "Mã OTP không chính xác." });
      return;
    }

    if (otpDoc.otpExpires < new Date()) {
      res.status(400).json({ message: "Mã OTP đã hết hạn." });
      return;
    }

    // Remove OTP document
    await Otp.deleteOne({ _id: otpDoc._id });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user (using hashed phone)
    const newUser = new User({
      email: email.toLowerCase(),
      phone: hashPhone(phone),
      passwordHash,
      role,
      isVerified: true, // Phone OTP is verified successfully
      profile: {
        name,
        photoUrl: "",
        bhytNumber: role === "patient" ? bhytNumber || "" : "",
        licenseUrl: role === "doctor" ? licenseUrl || "" : "",
      },
    });

    await newUser.save();

    // Automatically log user in
    const accessToken = generateAccessToken(newUser._id.toString(), newUser.role, newUser.tokenVersion || 0);
    const refreshToken = generateRefreshToken(newUser._id.toString(), newUser.role, newUser.tokenVersion || 0);

    res.status(201).json({
      message: "Xác minh OTP và đăng ký tài khoản thành công!",
      accessToken,
      refreshToken,
      user: {
        id: newUser._id,
        email: newUser.email,
        role: newUser.role,
        isVerified: newUser.isVerified,
        profile: newUser.profile,
      },
    });
  } catch (error) {
    console.error("Lỗi xác thực OTP đăng ký:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi trên máy chủ khi đăng ký tài khoản.", error: error.message });
  }
};

// @desc    Request OTP for Phone Login
// @route   POST /auth/phone-login-request
// @access  Public
export const requestPhoneLoginOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      res.status(400).json({ message: "Vui lòng cung cấp số điện thoại." });
      return;
    }

    // Find user by phone (using hashed phone)
    const user = await User.findOne({ phone: hashPhone(phone) });
    if (!user) {
      res.status(404).json({ message: "Số điện thoại này chưa được đăng ký." });
      return;
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 mins expiration

    // Upsert OTP in database (using hashed phone)
    await Otp.findOneAndUpdate(
      { phone: hashPhone(phone) },
      { otpCode, otpExpires },
      { upsert: true, new: true }
    );

    // Print OTP in terminal console for easy local testing
    console.log(`\n\x1b[32m[SMS OTP MOCK] Mã OTP đăng nhập của số điện thoại ${phone} là: ${otpCode}\x1b[0m\n`);

    res.status(200).json({
      message: "Mã OTP đã được tạo thành công (Xem tại terminal của Server).",
      debugOtp: process.env.NODE_ENV !== "production" ? otpCode : undefined,
    });
  } catch (error) {
    console.error("Lỗi yêu cầu OTP đăng nhập:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi trên máy chủ khi yêu cầu OTP đăng nhập.", error: error.message });
  }
};

// @desc    Verify Phone OTP and login user
// @route   POST /auth/phone-login-verify
// @access  Public
export const verifyPhoneLoginOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      res.status(400).json({ message: "Vui lòng nhập đầy đủ số điện thoại và mã OTP." });
      return;
    }

    // Check OTP (using hashed phone)
    const otpDoc = await Otp.findOne({ phone: hashPhone(phone) });
    if (!otpDoc || otpDoc.otpCode !== otp) {
      res.status(400).json({ message: "Mã OTP không chính xác." });
      return;
    }

    if (otpDoc.otpExpires < new Date()) {
      res.status(400).json({ message: "Mã OTP đã hết hạn." });
      return;
    }

    // Find user (using hashed phone)
    const user = await User.findOne({ phone: hashPhone(phone) });
    if (!user) {
      res.status(404).json({ message: "Không tìm thấy người dùng sở hữu số điện thoại này." });
      return;
    }

    // Remove OTP document
    await Otp.deleteOne({ _id: otpDoc._id });

    // Generate tokens
    const accessToken = generateAccessToken(user._id.toString(), user.role, user.tokenVersion || 0);
    const refreshToken = generateRefreshToken(user._id.toString(), user.role, user.tokenVersion || 0);

    res.status(200).json({
      message: "Đăng nhập thành công bằng OTP!",
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
    console.error("Lỗi xác minh OTP đăng nhập:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi trên máy chủ khi xác thực OTP đăng nhập.", error: error.message });
  }
};

// @desc    Get all patients
// @route   GET /auth/patients
// @access  Private (Doctor/Admin only)
export const getPatients = async (req, res) => {
  try {
    if (req.user.role !== "doctor" && req.user.role !== "admin") {
      res.status(403).json({ message: "Bạn không có quyền thực hiện hành động này." });
      return;
    }
    const patients = await User.find({ role: "patient" }).select("-passwordHash");
    res.status(200).json({ success: true, data: patients });
  } catch (error) {
    console.error("Lỗi lấy danh sách bệnh nhân:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi trên máy chủ khi lấy danh sách bệnh nhân.", error: error.message });
  }
};
