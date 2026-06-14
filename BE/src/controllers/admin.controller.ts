import { Request, Response } from "express";
import { getAllUsers, toggleUserLock, getAllDoctors, verifyDoctor } from "../services/user.service";
import { getDatasets, createDataset } from "../services/dataset.service";
import { getAuditLogs } from "../services/audit.service";

export const fetchUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await getAllUsers();
    res.status(200).json({ success: true, users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const lockUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, isLocked } = req.body;
    const adminId = (req as any).user.id;
    const user = await toggleUserLock(userId, Boolean(isLocked), adminId);
    res.status(200).json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const fetchDoctors = async (req: Request, res: Response): Promise<void> => {
  try {
    const doctors = await getAllDoctors();
    res.status(200).json({ success: true, doctors });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyDoctorAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, verified } = req.body;
    const adminId = (req as any).user.id;
    const doctor = await verifyDoctor(userId, Boolean(verified), adminId);
    res.status(200).json({ success: true, doctor });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const fetchDatasets = async (req: Request, res: Response): Promise<void> => {
  try {
    const datasets = await getDatasets();
    res.status(200).json({ success: true, datasets });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addDataset = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = req.body;
    const adminId = (req as any).user.id;
    const dataset = await createDataset(payload, adminId);
    res.status(201).json({ success: true, dataset });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const fetchAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const logs = await getAuditLogs();
    res.status(200).json({ success: true, logs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
