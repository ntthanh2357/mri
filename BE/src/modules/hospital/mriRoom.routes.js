import { Router } from "express";
import { protect } from "../../middlewares/auth.middleware.js";
import {
  getRooms,
  createRoom,
  updateRoom,
  deleteRoom,
  autoScheduleSlot,
  getWeeklySchedule,
  handleEmergencyOverride,
  confirmReschedule,
  releaseRoom,
  getSlotsByVisit
} from "./mriRoom.controller.js";

const router = Router();
router.use(protect);

router.get("/", getRooms);
router.post("/", createRoom);
router.put("/:id", updateRoom);
router.delete("/:id", deleteRoom);

router.post("/schedule/auto", autoScheduleSlot);
router.get("/schedule/weekly", getWeeklySchedule);
router.post("/schedule/emergency-override", handleEmergencyOverride);
router.post("/schedule/confirm-reschedule", confirmReschedule);
router.put("/slots/:slotId/release", releaseRoom);
router.get("/visit/:visitId/slots", getSlotsByVisit);

export default router;
