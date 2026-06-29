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
  phoneLoginRequest,
  phoneLoginVerify,
  downgradeToBasic,
  cancelPremiumRenew,
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
router.post("/phone-login-request", phoneLoginRequest);
router.post("/phone-login-verify", phoneLoginVerify);
router.post("/premium/downgrade", protect, downgradeToBasic);
router.post("/premium/cancel-renew", protect, cancelPremiumRenew);

export default router;

