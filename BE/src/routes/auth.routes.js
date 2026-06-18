import { Router } from "express";
import {
  register,
  login,
  getMe,
  refresh,
  firebaseLogin,
  ssoLogin,
  logoutAll,
  changePassword,
  forgotPassword,
  verifyOtp,
  requestPhoneRegisterOtp,
  verifyPhoneRegisterOtp,
  requestPhoneLoginOtp,
  verifyPhoneLoginOtp,
} from "../controllers/auth.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/firebase-login", firebaseLogin);
router.post("/sso/:provider", ssoLogin);
router.get("/me", protect, getMe);

// Endpoints
router.post("/logout/all", protect, logoutAll);
router.put("/password", protect, changePassword);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);

// Phone & OTP routes
router.post("/phone-register-request", requestPhoneRegisterOtp);
router.post("/phone-register-verify", verifyPhoneRegisterOtp);
router.post("/phone-login-request", requestPhoneLoginOtp);
router.post("/phone-login-verify", verifyPhoneLoginOtp);

export default router;

