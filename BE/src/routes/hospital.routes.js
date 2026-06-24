import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { uploadSingle } from "../middlewares/upload.middleware.js";
import { getMyHospital, submitOnboardingInfo, uploadLicenseFile } from "../controllers/hospital.controller.js";

const router = Router();

router.use(protect);

router.get("/me", getMyHospital);
router.put("/onboarding", submitOnboardingInfo);
router.post("/onboarding/license", uploadSingle, uploadLicenseFile);

export default router;
