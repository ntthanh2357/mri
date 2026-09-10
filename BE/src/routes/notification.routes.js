import { Router } from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  updateFcmToken
} from "../controllers/notification.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(protect);

router.get("/", getNotifications);
router.put("/read-all", markAllAsRead);
router.put("/fcm-token", updateFcmToken);
router.put("/:id/read", markAsRead);

export default router;
