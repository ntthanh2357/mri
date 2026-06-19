import { Router } from "express";
import authRoutes from "./auth.routes.js";
import adminRoutes from "./admin.routes.js";
import emrRoutes from "./emr.routes.js";

import patientRoutes from "./patient.routes.js";
import lisRoutes from "./lis.routes.js";
import drugRoutes from "./drug.routes.js";

import patientRecordRoutes from "./patientRecord.routes.js";
import imagingRoutes from "./imaging.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/api/v1/patient", patientRecordRoutes);


// Mount patient and LIS simulator receiver routes
router.use("/api/patients", patientRoutes);
router.use("/api/lis", lisRoutes);
router.use("/api/drugs", drugRoutes);

// Mount admin routes for backoffice and compliance features
router.use("/admin", adminRoutes);

// Mount EMR routes (internal clinical records, care sheets, consultations)
router.use("/emr", emrRoutes);

// Mount imaging routes
router.use("/api/v1/imaging", imagingRoutes);

// Health check endpoint under /api/v1

router.get("/api/v1", (req, res) => {
  res.json({ status: "success", message: "Health check passed", environment: process.env.NODE_ENV });
});

export default router;
