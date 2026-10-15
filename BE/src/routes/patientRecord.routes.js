import { Router } from "express";
import { protect, checkRole } from "../middlewares/auth.middleware.js";
import { uploadSingle } from "../middlewares/upload.middleware.js";
import * as ctrl from "../controllers/patientRecord.controller.js";
import * as consentCtrl from "../controllers/patientConsent.controller.js";
import * as shareCtrl from "../controllers/recordShare.controller.js";
import * as docCtrl from "../controllers/scannedDocument.controller.js";
import * as visitCtrl from "../controllers/patientVisit.controller.js";
import { createRateLimiter } from "../middlewares/rateLimiter.middleware.js";

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

// Chia sẻ bệnh án qua QR (UC-PAT-09) — chỉ bệnh nhân, trên bệnh án của chính mình
router.post("/record-shares", checkRole(["patient"]), shareCtrl.createMine);
router.get("/record-shares", checkRole(["patient"]), shareCtrl.listMine);
const catalogLimiter = createRateLimiter({ windowMs: 60 * 1000, maxRequests: 30, keyGenerator: (req) => `share-catalog:${req.user?.id}`, message: "Bạn tải lại quá nhanh. Vui lòng đợi 1 phút." });
router.get("/record-shares/catalog", checkRole(["patient"]), catalogLimiter, shareCtrl.catalogMine);
router.delete("/record-shares/:id", checkRole(["patient"]), shareCtrl.revokeMine);

// Giấy tờ tự quét để chia sẻ qua QR (UC-PAT-09 mở rộng) — chỉ bệnh nhân, trên giấy tờ của chính mình
// Mỗi lần quét tốn 1 lượt AI đọc chữ: giới hạn theo TÀI KHOẢN (không theo IP — header X-Forwarded-For giả được,
// và nhiều bệnh nhân dùng chung Wi-Fi bệnh viện). Hạn mức theo ngày nằm ở scannedDocument.service.
const scanLimiter = createRateLimiter({ windowMs: 60 * 1000, maxRequests: 6, keyGenerator: (req) => `scan-document:${req.user?.id}`, message: "Bạn quét quá nhanh. Vui lòng đợi 1 phút rồi thử lại." });
router.post("/scanned-documents", checkRole(["patient"]), scanLimiter, docCtrl.receiveImage, docCtrl.scanMine);
router.get("/scanned-documents", checkRole(["patient"]), docCtrl.listMine);
router.put("/scanned-documents/:id", checkRole(["patient"]), docCtrl.saveMine);
router.delete("/scanned-documents/:id", checkRole(["patient"]), docCtrl.deleteMine);

// Theo dõi lượt khám (UC-PAT-05) — chỉ bệnh nhân, lượt khám của chính mình
router.get("/visit-progress", checkRole(["patient"]), visitCtrl.progressMine);
// Chuẩn bị chụp MRI: hướng dẫn + bệnh nhân tự khai sàng lọc an toàn (KTV vẫn xác nhận lại tại buồng máy)
router.get("/mri-prep", checkRole(["patient"]), visitCtrl.mriPrepMine);
router.put("/mri-prep/:visitId/screening", checkRole(["patient"]), visitCtrl.saveScreeningMine);
// Hóa đơn viện phí của chính bệnh nhân (chỉ xem)
router.get("/invoices", checkRole(["patient"]), visitCtrl.invoicesMine);

// Medicine Reminders
router.get("/reminders/today", ctrl.getTodayReminders);
router.get("/reminders/settings", ctrl.getReminderSettings);
router.put("/reminders/settings", ctrl.updateReminderSettings);
router.put("/reminders/:id/done", ctrl.markReminderDone);
router.delete("/reminders/:id", ctrl.skipReminder);

export default router;
