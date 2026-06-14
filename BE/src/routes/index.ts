import { Router } from "express";
import authRoutes from "./auth.routes";
import adminRoutes from "./admin.routes";

const router = Router();

// Mount auth routes (keeps compatibility with FE/web calling /auth/*)
router.use("/auth", authRoutes);

// Mount admin routes for backoffice and compliance features
router.use("/admin", adminRoutes);

// Health check endpoint under /api/v1
router.get("/api/v1", (req, res) => {
  res.json({ status: "success", message: "Health check passed", environment: process.env.NODE_ENV });
});

export default router;
