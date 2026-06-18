import { Router } from "express";
import authRoutes from "./auth.routes.js";
import adminRoutes from "./admin.routes.js";
import emrRoutes from "./emr.routes.js";

const router = Router();

// Mount auth routes (keeps compatibility with FE/web calling /auth/*)
router.use("/auth", authRoutes);

// Mount admin routes for backoffice and compliance features
router.use("/admin", adminRoutes);

// Mount EMR routes (internal clinical records, care sheets, consultations)
router.use("/emr", emrRoutes);

// Health check endpoint under /api/v1
router.get("/api/v1", (req, res) => {
  res.json({ status: "success", message: "Health check passed", environment: process.env.NODE_ENV });
});

export default router;
