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
  requestInvoiceRefund,
  approveInvoiceRefund,
  rejectInvoiceRefund,
  reviewLargeRefund,
  getPendingRefundRequests,
  syncInvoiceServices,
  checkPayOSPayment,
  recordBankTransfer,
  getStuckProcessingInvoices,
  resolveProcessingInvoice
} from "./invoice.controller.js";

const router = express.Router();

// Lấy danh sách và thanh toán hóa đơn
router.get("/stuck-processing", protect, checkRole(["nurse", "admin", "receptionist", "hospital_admin", "pharmacist"]), getStuckProcessingInvoices);
router.post("/:id/resolve-processing", protect, checkRole(["hospital_admin", "pharmacist"]), resolveProcessingInvoice);
router.get("/", protect, checkRole(["nurse", "admin", "receptionist", "hospital_admin"]), getInvoices);
router.put("/:id/pay", protect, checkRole(["receptionist", "hospital_admin"]), payInvoice);
router.post("/visit/:visitId", protect, checkRole(["receptionist", "hospital_admin"]), createAndPayInvoice);
router.post("/pending", protect, checkRole(["nurse", "receptionist", "hospital_admin"]), createPendingInvoice);
// Hoàn tiền là thao tác tài chính của viện: quản trị nền tảng (admin, system_admin) không tham gia.
router.get("/refund-requests/pending", protect, checkRole(["receptionist", "hospital_admin"]), getPendingRefundRequests);
router.put("/:id/refund", protect, checkRole(["receptionist", "hospital_admin"]), refundInvoice);
router.post("/:id/refund/request", protect, checkRole(["receptionist", "hospital_admin"]), requestInvoiceRefund);
router.post("/:id/refund/approve", protect, checkRole(["receptionist", "hospital_admin"]), approveInvoiceRefund);
router.post("/:id/refund/reject", protect, checkRole(["receptionist", "hospital_admin"]), rejectInvoiceRefund);
router.put("/:id/refund/large-review", protect, checkRole(["hospital_admin"]), reviewLargeRefund);
// UC-REC-05: cập nhật dịch vụ phát sinh (tiền giường...) vào hóa đơn đang chờ
router.post("/:id/sync", protect, checkRole(["nurse", "receptionist", "hospital_admin"]), syncInvoiceServices);
router.post("/:id/payos-check", protect, checkRole(["nurse", "receptionist", "hospital_admin"]), checkPayOSPayment);
// Ghi nhận chuyển khoản đối chiếu sao kê (tiền vào mã VietQR đã hủy / hết hạn, chuyển khoản trực tiếp)
router.post("/:id/bank-transfer", protect, checkRole(["receptionist", "hospital_admin"]), recordBankTransfer);

// Cổng thanh toán trực tuyến PayOS (VietQR)
router.post("/visit/:visitId/payos", protect, createPayOSPayment);
router.post("/:visitId/payos", protect, createPayOSPayment);
router.post("/payos-webhook", handlePayOSWebhook);
router.get("/payment/success", paymentSuccess);
router.get("/payment/cancel", paymentCancel);

export default router;
