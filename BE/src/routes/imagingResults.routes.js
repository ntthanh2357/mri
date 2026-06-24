import { Router } from "express";
import { createKtvImagingResult } from "../controllers/imaging.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

// Technician uploads scan result and creates record
router.post("/", protect, createKtvImagingResult);

export default router;
