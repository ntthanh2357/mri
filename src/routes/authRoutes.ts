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
} from "../controllers/authController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/firebase-login", firebaseLogin);
router.post("/sso/:provider", ssoLogin);
router.get("/me", protect, getMe);

// New endpoints for Module 1 completion
router.post("/logout/all", protect, logoutAll);
router.put("/password", protect, changePassword);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);

export default router;
