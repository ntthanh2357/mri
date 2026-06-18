import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { uploadSingle } from "../middlewares/upload.middleware.js";
import * as ctrl from "../controllers/patientRecord.controller.js";

const router = Router();

// All routes require authentication
router.use(protect);

// Identity card
router.get("/profile/identity", ctrl.getIdentity);
router.put("/profile/identity", ctrl.updateIdentity);

// Visits
router.get("/records", ctrl.listVisits);
router.post("/records", ctrl.createVisit);
router.get("/records/:visitId", ctrl.getVisit);
router.put("/records/:visitId", ctrl.updateVisit);
router.delete("/records/:visitId", ctrl.deleteVisit);

// Documents
router.post("/records/:visitId/documents/upload", uploadSingle, ctrl.uploadDocument);
router.post("/records/:visitId/documents/manual", ctrl.saveManualDocument);
router.delete("/records/:visitId/documents/:docId", ctrl.deleteDocument);

export default router;
