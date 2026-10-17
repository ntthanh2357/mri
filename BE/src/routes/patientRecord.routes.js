import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { uploadSingle } from "../middlewares/upload.middleware.js";
import * as ctrl from "../controllers/patientRecord.controller.js";
import * as consentCtrl from "../controllers/patientConsent.controller.js";

const router = Router();

// All routes require authentication
router.use(protect);

// Bệnh nhân chỉ được xem lượt khám/tài liệu, không được tạo/sửa/xóa —
// hồ sơ này phản ánh dữ liệu do bệnh viện cung cấp, không phải bệnh nhân tự khai.
const blockPatientWrite = (req, res, next) => {
  if (req.user.role === "patient") {
    return res.status(403).json({
      success: false,
      message: "Bệnh nhân chỉ có quyền xem hồ sơ, không có quyền tạo hoặc chỉnh sửa.",
    });
  }
  next();
};

// Identity card
router.get("/profile/identity", ctrl.getIdentity);
router.put("/profile/identity", ctrl.updateIdentity);
router.put("/profile/identity/bhyt-review", ctrl.reviewDeclaredBhyt);

// Visits
router.get("/records", ctrl.listVisits);
router.post("/records", blockPatientWrite, ctrl.createVisit);
router.get("/records/:visitId", ctrl.getVisit);
router.put("/records/:visitId", blockPatientWrite, ctrl.updateVisit);
router.delete("/records/:visitId", blockPatientWrite, ctrl.deleteVisit);

// Documents
router.post("/records/:visitId/documents/upload", blockPatientWrite, uploadSingle, ctrl.uploadDocument);
router.post("/records/:visitId/documents/manual", blockPatientWrite, ctrl.saveManualDocument);
router.delete("/records/:visitId/documents/:docId", blockPatientWrite, ctrl.deleteDocument);

// Phiếu đồng thuận tiêm cản quang (UC-PAT-06) — chỉ bệnh nhân, trên phiếu của chính mình
router.get("/consents", consentCtrl.listMyConsents);
router.put("/consents/:id/checklist", consentCtrl.submitMyChecklist);
router.put("/consents/:id/sign", consentCtrl.signMyConsent);

// Medicine Reminders
router.get("/reminders/today", ctrl.getTodayReminders);
router.get("/reminders/settings", ctrl.getReminderSettings);
router.put("/reminders/settings", ctrl.updateReminderSettings);
router.put("/reminders/:id/done", ctrl.markReminderDone);
router.delete("/reminders/:id", ctrl.skipReminder);

export default router;
