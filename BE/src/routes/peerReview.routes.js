import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  flagForPeerReview,
  submitReview,
  finalizePeerReview,
  runRandomQaSampling,
  getPeerReviews
} from "../controllers/peerReview.controller.js";

const router = Router();
router.use(protect);

router.get("/", getPeerReviews);
router.post("/", flagForPeerReview);
router.post("/:id/submit-reading", submitReview);
router.put("/:id/finalize", finalizePeerReview);
router.post("/random-qa-sampling", runRandomQaSampling);

export default router;
