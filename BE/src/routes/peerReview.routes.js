import { Router } from "express";
import { protect, checkRole } from "../middlewares/auth.middleware.js";
import {
  flagForPeerReview,
  submitReview,
  finalizePeerReview,
  runRandomQaSampling,
  getPeerReviews
} from "../controllers/peerReview.controller.js";

const router = Router();
router.use(protect);

const PEER_REVIEW_ROLES = ["doctor", "radiologist", "department_head", "admin", "system_admin", "hospital_admin"];

router.get("/", checkRole(PEER_REVIEW_ROLES), getPeerReviews);
router.post("/", checkRole(PEER_REVIEW_ROLES), flagForPeerReview);
router.post("/:id/submit-reading", checkRole(["doctor", "radiologist", "department_head"]), submitReview);
router.put("/:id/finalize", checkRole(PEER_REVIEW_ROLES), finalizePeerReview);
router.post("/random-qa-sampling", checkRole(["admin", "system_admin", "hospital_admin", "department_head"]), runRandomQaSampling);

export default router;
