import { Router } from "express";
import authRoutes from "./auth.routes.js";
import patientRecordRoutes from "./patientRecord.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/api/v1/patient", patientRecordRoutes);

router.get("/api/v1", (req, res) => {
  res.json({ status: "success", message: "Health check passed", environment: process.env.NODE_ENV });
});

export default router;
