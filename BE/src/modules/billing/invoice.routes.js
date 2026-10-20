import express from "express";
import { protect, checkRole } from "../../middlewares/auth.middleware.js";
import {
  createAndPayInvoice,
  getInvoices,
  payInvoice,
  createPayOSPayment,
  handlePayOSWebhook,
  paymentSuccess,
  paymentCancel,
  createPendingInvoice,
  refundInvoice,
  syncInvoiceServices,
  checkPayOSPayment,
  recordBankTransfer,
  getStuckProcessingInvoices,
  resolveProcessingInvoice
} from "./invoice.controller.js";

const router = express.Router();

// Lấy danh sách và thanh toán hóa đơn
router.get("/stuck-processing", protect, checkRole(["nurse", "admin", "receptionist", "hospital_admin", "pharmacist"]), getStuckProcessingInvoices);
router.post("/:id/resolve-processing", protect, checkRole(["admin", "hospital_admin", "pharmacist"]), resolveProcessingInvoice);
router.get("/", protect, checkRole(["nurse", "admin", "receptionist", "hospital_admin"]), getInvoices);
router.put("/:id/pay", protect, checkRole(["nurse", "admin", "receptionist", "hospital_admin"]), payInvoice);
router.post("/visit/:visitId", protect, checkRole(["nurse", "admin", "receptionist", "hospital_admin"]), createAndPayInvoice);
router.post("/pending", protect, checkRole(["nurse", "admin", "receptionist", "hospital_admin"]), createPendingInvoice);
router.put("/:id/refund", protect, checkRole(["nurse", "admin", "receptionist", "hospital_admin"]), refundInvoice);
// UC-REC-05: cập nhật dịch vụ phát sinh (tiền giường...) vào hóa đơn đang chờ
router.post("/:id/sync", protect, checkRole(["nurse", "admin", "receptionist", "hospital_admin"]), syncInvoiceServices);
router.post("/:id/payos-check", protect, checkRole(["nurse", "admin", "receptionist", "hospital_admin"]), checkPayOSPayment);
// Ghi nhận chuyển khoản đối chiếu sao kê (tiền vào mã VietQR đã hủy / hết hạn, chuyển khoản trực tiếp)
router.post("/:id/bank-transfer", protect, checkRole(["admin", "receptionist", "hospital_admin"]), recordBankTransfer);

// Cổng thanh toán trực tuyến PayOS (VietQR)
router.post("/visit/:visitId/payos", protect, createPayOSPayment);
router.post("/:visitId/payos", protect, createPayOSPayment);
router.post("/payos-webhook", handlePayOSWebhook);
router.get("/payment/success", paymentSuccess);
router.get("/payment/cancel", paymentCancel);

export default router;
