import { Router } from "express";
import {
  register,
  login,
  getMe,
  refresh,
  firebaseLogin,
  ssoLogin,
  logout,
  logoutAll,
  changePassword,
  forgotPassword,
  verifyOtp,
  phoneLoginRequest,
  phoneLoginVerify,
  updateProfile,
  verifyActivation,
  resendActivation,
  verify2FA,
  resend2FA,
  requestStepUpOtp,
  verifyStepUpOtp,
} from "./auth.controller.js";
import { protect, optionalProtect } from "../../middlewares/auth.middleware.js";

const router = Router();

// Các trường định danh/xác thực luôn là chuỗi; kiểu khác (số, mảng, object) bị chặn 400 trước controller
// để không rơi vào `email.trim is not a function` → 500.
const AUTH_STRING_FIELDS = ["email", "password", "otp", "phone", "idToken", "roleType", "currentPassword", "newPassword", "newEmail", "name", "fullName", "hospitalName", "gender", "dob", "dateOfBirth", "address", "specialty"];
router.use((req, res, next) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return next();
  const bad = AUTH_STRING_FIELDS.find((k) => body[k] !== undefined && body[k] !== null && typeof body[k] !== "string");
  if (bad) return res.status(400).json({ success: false, message: `Trường "${bad}" không hợp lệ.` });
  return next();
});

router.post("/register", optionalProtect, register);
router.post("/login", login);
router.post("/verify-2fa", verify2FA);
router.post("/resend-2fa", resend2FA);
router.post("/logout", logout);
router.post("/refresh", refresh);
router.post("/firebase-login", firebaseLogin);
router.post("/sso/:provider", ssoLogin);
router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);

// Endpoints
router.post("/logout/all", protect, logoutAll);
router.post("/step-up/request", protect, requestStepUpOtp);
router.post("/step-up/verify", protect, verifyStepUpOtp);
router.put("/password", protect, changePassword);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);
router.post("/verify-activation", verifyActivation);
router.post("/resend-activation", resendActivation);

// Phone login endpoints
router.post("/phone-login-request", phoneLoginRequest);
router.post("/phone-login-verify", phoneLoginVerify);

export default router;
