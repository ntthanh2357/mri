import { Router } from "express";
import {
  getPatients,
  getPatientVitals,
  addPatientVitals,
  getPatientLabOrders,
  createPatientLabOrder
} from "../controllers/patient.controller.js";

const router = Router();

// Lấy danh sách bệnh nhân
router.get("/", getPatients);

// Quản lý sinh hiệu bệnh nhân
router.get("/:patientId/vitals", getPatientVitals);
router.post("/:patientId/vitals", addPatientVitals);

// Quản lý chỉ định xét nghiệm của bệnh nhân
router.get("/:patientId/lab-orders", getPatientLabOrders);
router.post("/:patientId/lab-orders", createPatientLabOrder);

export default router;
