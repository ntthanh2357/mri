import express from "express";
import { protect, checkRole } from "../middlewares/auth.middleware.js";
import { createAndPayInvoice } from "../controllers/invoice.controller.js";

const router = express.Router();

router.post("/visit/:visitId", protect, checkRole(["receptionist", "admin"]), createAndPayInvoice);

export default router;
