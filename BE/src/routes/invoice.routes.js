import express from "express";
import { protect, checkRole } from "../middlewares/auth.middleware.js";
import { createAndPayInvoice, getInvoices, payInvoice, createPendingInvoice } from "../controllers/invoice.controller.js";

const router = express.Router();

router.get("/", protect, checkRole(["nurse", "admin", "receptionist", "hospital_admin"]), getInvoices);
router.put("/:id/pay", protect, checkRole(["nurse", "admin", "receptionist", "hospital_admin"]), payInvoice);
router.post("/visit/:visitId", protect, checkRole(["nurse", "admin", "receptionist", "hospital_admin"]), createAndPayInvoice);
router.post("/pending", protect, checkRole(["nurse", "admin", "receptionist", "hospital_admin"]), createPendingInvoice);

export default router;

