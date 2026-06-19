import { Router } from "express";
import { checkPrescription } from "../controllers/drug.controller.js";
import { protect, checkRole } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(protect);

router.post("/check-prescription", checkRole(["doctor", "admin"]), checkPrescription);

export default router;
