import express from "express";
import { protect, checkRole } from "../middlewares/auth.middleware.js";
import { createAndPayInvoice, getInvoices, payInvoice } from "../controllers/invoice.controller.js";

const router = express.Router();

router.get("/", protect, checkRole(["nurse", "admin"]), getInvoices);
router.put("/:id/pay", protect, checkRole(["nurse", "admin"]), payInvoice);
router.post("/visit/:visitId", protect, checkRole(["nurse", "admin"]), createAndPayInvoice);

export default router;
