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
} from "./auth.controller.js";
import { protect, optionalProtect } from "../../middlewares/auth.middleware.js";

const router = Router();

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
router.put("/password", protect, changePassword);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);
router.post("/verify-activation", verifyActivation);
router.post("/resend-activation", resendActivation);

// Phone login endpoints
router.post("/phone-login-request", phoneLoginRequest);
router.post("/phone-login-verify", phoneLoginVerify);

export default router;
