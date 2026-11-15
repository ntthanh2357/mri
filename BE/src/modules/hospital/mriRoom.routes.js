import { Router } from "express";
import { protect, checkRole } from "../../middlewares/auth.middleware.js";
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

// [SECURITY FIX BUG-MRI-001]: Bắt buộc kiểm tra vai trò trên toàn bộ các route phòng chụp MRI
const MRI_VIEW_ROLES = ["technician", "radiologist", "doctor", "department_head", "nurse", "receptionist", "hospital_admin", "admin", "system_admin"];
const MRI_OPS_ROLES = ["technician", "radiologist", "doctor", "department_head", "nurse", "hospital_admin", "admin", "system_admin"];
const MRI_STRICT_OPS_ROLES = ["technician", "radiologist", "doctor", "department_head", "hospital_admin", "admin", "system_admin"];

router.get("/", checkRole(MRI_VIEW_ROLES), getRooms);
router.post("/", checkRole(["admin", "system_admin", "hospital_admin"]), createRoom);
router.put("/:id", checkRole(["admin", "system_admin", "hospital_admin", "technician"]), updateRoom);
router.delete("/:id", checkRole(["admin", "system_admin", "hospital_admin"]), deleteRoom);

router.post("/schedule/auto", checkRole(MRI_OPS_ROLES), autoScheduleSlot);
router.get("/schedule/weekly", checkRole(MRI_VIEW_ROLES), getWeeklySchedule);
router.post("/schedule/emergency-override", checkRole(MRI_STRICT_OPS_ROLES), handleEmergencyOverride);
router.post("/schedule/confirm-reschedule", checkRole(MRI_OPS_ROLES), confirmReschedule);
router.put("/slots/:slotId/release", checkRole(MRI_STRICT_OPS_ROLES), releaseRoom);
router.get("/visit/:visitId/slots", checkRole(MRI_VIEW_ROLES), getSlotsByVisit);

export default router;
