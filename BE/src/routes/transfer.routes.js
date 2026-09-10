import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  checkSurgeryCapacity,
  createTransferRequest,
  acceptTransferRequest,
  rejectTransferRequest,
  getTransfers,
  grantCrossHospitalView
} from "../controllers/transfer.controller.js";

const router = Router();
router.use(protect);

router.get("/", getTransfers);
router.post("/", createTransferRequest);
router.post("/check-capacity", checkSurgeryCapacity);
router.put("/:id/accept", acceptTransferRequest);
router.put("/:id/reject", rejectTransferRequest);
router.post("/:id/grant-cross-view", grantCrossHospitalView);

export default router;
