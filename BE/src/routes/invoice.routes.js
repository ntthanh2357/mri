import express from "express";
import { protect, checkRole } from "../middlewares/auth.middleware.js";
import { createAndPayInvoice, getInvoices, payInvoice, createPendingInvoice } from "../controllers/invoice.controller.js";

const router = express.Router();

router.get("/", protect, checkRole(["nurse", "admin", "receptionist"]), getInvoices);
router.put("/:id/pay", protect, checkRole(["nurse", "admin", "receptionist"]), payInvoice);
router.post("/visit/:visitId", protect, checkRole(["nurse", "admin", "receptionist"]), createAndPayInvoice);
router.post("/pending", protect, checkRole(["nurse", "admin", "receptionist"]), createPendingInvoice);

export default router;

