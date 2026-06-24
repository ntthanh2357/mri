import express from "express";
import { protect, checkRole } from "../middlewares/auth.middleware.js";
import { createAndPayInvoice, getInvoices, payInvoice } from "../controllers/invoice.controller.js";

const router = express.Router();

router.get("/", protect, checkRole(["receptionist", "admin"]), getInvoices);
router.put("/:id/pay", protect, checkRole(["receptionist", "admin"]), payInvoice);
router.post("/visit/:visitId", protect, checkRole(["receptionist", "admin"]), createAndPayInvoice);

export default router;
