import { Router } from "express";
import authRoutes from "./auth.routes.js";
import adminRoutes from "./admin.routes.js";
import emrRoutes from "./emr.routes.js";

import patientRoutes from "./patient.routes.js";
import lisRoutes from "./lis.routes.js";
import drugRoutes from "./drug.routes.js";

import patientRecordRoutes from "./patientRecord.routes.js";
import imagingRoutes from "./imaging.routes.js";
import imagingResultsRoutes from "./imagingResults.routes.js";
import visitRoutes from "./visit.routes.js";
import invoiceRoutes from "./invoice.routes.js";
import hospitalRoutes from "./hospital.routes.js";
import scheduleRoutes from "./schedule.routes.js";
import notificationRoutes from "./notification.routes.js";
import supportRoutes from "./support.routes.js";

// Module v3.2 new routes
import mriRoomRoutes from "./mriRoom.routes.js";
import dicomRoutes from "./dicom.routes.js";
import aiPipelineRoutes from "./aiPipeline.routes.js";
import assignmentRoutes from "./assignment.routes.js";
import emergencyRoutes from "./emergency.routes.js";
import peerReviewRoutes from "./peerReview.routes.js";
import hospitalBedRoutes from "./hospitalBed.routes.js";

// Module v3.2 Phase 2 routes
import taskRoutes from "./task.routes.js";
import transferRoutes from "./transfer.routes.js";
import contrastConsentRoutes from "./contrastConsent.routes.js";

// Module v3.2 Phase 3 routes
import driveStorageRoutes from "./driveStorage.routes.js";
import personalHealthRoutes from "./personalHealth.routes.js";
import reportRoutes from "./report.routes.js";

// Module v3.2 Phase 4 — B2C, Clinical View, BHYT
import patientB2cRoutes from "./patientB2c.routes.js";
import clinicalViewRoutes from "./clinicalView.routes.js";
import bhytRoutes from "./bhyt.routes.js";

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
router.use("/api/v1/imaging-results", imagingResultsRoutes);

// Mount task assignment routes
router.use("/api/v1/visits", visitRoutes);
router.use("/api/v1/invoices", invoiceRoutes);
router.use("/api/v1/hospital", hospitalRoutes);
router.use("/api/v1/schedules", scheduleRoutes);
router.use("/api/v1/notifications", notificationRoutes);
router.use("/api/v1/support", supportRoutes);

// Mount v3.2 core foundation routes
router.use("/api/v1/mri-rooms", mriRoomRoutes);
router.use("/api/v1/dicom", dicomRoutes);
router.use("/api/v1/ai-pipeline", aiPipelineRoutes);
router.use("/api/v1/assignments", assignmentRoutes);
router.use("/api/v1/emergency", emergencyRoutes);
router.use("/api/v1/peer-reviews", peerReviewRoutes);
router.use("/api/v1/hospital-beds", hospitalBedRoutes);

// Mount v3.2 Phase 2 routes
router.use("/api/v1/tasks", taskRoutes);
router.use("/api/v1/transfers", transferRoutes);
router.use("/api/v1/contrast-consents", contrastConsentRoutes);

// Mount v3.2 Phase 3 routes
router.use("/api/v1/drive-storage", driveStorageRoutes);
router.use("/api/v1/personal-health", personalHealthRoutes);
router.use("/api/v1/reports", reportRoutes);

// Mount v3.2 Phase 4 — B2C Patient, Clinical View (G), BHYT (R)
router.use("/api/v1/patient-b2c", patientB2cRoutes);
router.use("/api/v1/clinical-view", clinicalViewRoutes);
router.use("/api/v1/bhyt", bhytRoutes);

// Health check endpoint under /api/v1

router.get("/api/v1", (req, res) => {
  res.json({ status: "success", message: "Health check passed", environment: process.env.NODE_ENV });
});


export default router;
