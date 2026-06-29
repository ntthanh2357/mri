import express from "express";
import { protect, checkRole } from "../middlewares/auth.middleware.js";
import {
  createAndPayInvoice,
  getInvoices,
  payInvoice,
  createPayOSPayment,
  handlePayOSWebhook,
  paymentSuccess,
  paymentCancel,
  createPremiumPayment,
  createPendingInvoice
} from "../controllers/invoice.controller.js";

const router = express.Router();

// Lấy danh sách và thanh toán hóa đơn
router.get("/", protect, checkRole(["nurse", "admin", "receptionist"]), getInvoices);
router.put("/:id/pay", protect, checkRole(["nurse", "admin", "receptionist"]), payInvoice);
router.post("/visit/:visitId", protect, checkRole(["nurse", "admin", "receptionist"]), createAndPayInvoice);
router.post("/pending", protect, checkRole(["nurse", "admin", "receptionist"]), createPendingInvoice);

// Cổng thanh toán trực tuyến PayOS (VietQR)
router.post("/visit/:visitId/payos", protect, createPayOSPayment);
router.post("/:visitId/payos", protect, createPayOSPayment);
router.post("/premium-payment", protect, createPremiumPayment);
router.post("/payos-webhook", handlePayOSWebhook);
router.get("/payment/success", paymentSuccess);
router.get("/payment/cancel", paymentCancel);

export default router;
