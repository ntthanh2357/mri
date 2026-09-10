import { Router } from "express";
import { protect } from "../../middlewares/auth.middleware.js";
import {
  getBeds,
  createBed,
  reserveBed,
  occupyBed,
  releaseBed,
  getBedMapSummary
} from "./hospitalBed.controller.js";

const router = Router();
router.use(protect);

router.get("/", getBeds);
router.post("/", createBed);
router.get("/map-summary", getBedMapSummary);
router.post("/:id/reserve", reserveBed);
router.put("/:id/occupy", occupyBed);
router.put("/:id/release", releaseBed);

export default router;
