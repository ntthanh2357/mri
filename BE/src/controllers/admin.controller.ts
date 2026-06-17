import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import {
  getAllUsers,
  toggleUserLock,
  getAllDoctors,
  verifyDoctor,
  getUserById,
  lockUserById as lockUserByIdService,
  unlockUserById as unlockUserByIdService,
  getSystemStats,
  verifyDoctorById as verifyDoctorByIdService,
} from "../services/user.service";
import { getDatasets, createDataset, updateDatasetPrice as updateDatasetPriceService } from "../services/dataset.service";
import { getAuditLogs, anonymizeAuditLogs } from "../services/audit.service";

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

// ─── 3.1 fetchUserById ────────────────────────────────────────────────────────
export const fetchUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid user ID" });
      return;
    }
    const user = await getUserById(id);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }
    res.status(200).json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── 3.2 lockUserById ────────────────────────────────────────────────────────
export const lockUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid user ID" });
      return;
    }
    const adminId = (req as any).user._id;
    const user = await lockUserByIdService(id, adminId);
    res.status(200).json({ success: true, user });
  } catch (error: any) {
    if (error.message === "User not found") {
      res.status(404).json({ success: false, message: error.message });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

// ─── 3.3 unlockUserById ──────────────────────────────────────────────────────
export const unlockUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid user ID" });
      return;
    }
    const adminId = (req as any).user._id;
    const user = await unlockUserByIdService(id, adminId);
    res.status(200).json({ success: true, user });
  } catch (error: any) {
    if (error.message === "User not found") {
      res.status(404).json({ success: false, message: error.message });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

// ─── 3.4 fetchStats ──────────────────────────────────────────────────────────
export const fetchStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getSystemStats();
    res.status(200).json({ success: true, stats });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── 3.5 verifyDoctorById ────────────────────────────────────────────────────
export const verifyDoctorById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid doctor ID" });
      return;
    }
    const { verified } = req.body;
    if (typeof verified !== "boolean") {
      res.status(400).json({ success: false, message: "Field 'verified' must be a boolean" });
      return;
    }
    const adminId = (req as any).user._id;
    const doctor = await verifyDoctorByIdService(id, verified, adminId);
    res.status(200).json({ success: true, doctor });
  } catch (error: any) {
    if (error.message === "Doctor not found") {
      res.status(404).json({ success: false, message: error.message });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

// ─── 3.6 updateDatasetPrice ──────────────────────────────────────────────────
export const updateDatasetPrice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid dataset ID" });
      return;
    }
    const { price } = req.body;
    if (typeof price !== "number" || price < 0 || price > 999_999_999) {
      res.status(400).json({ success: false, message: "Price must be a number in range [0, 999999999]" });
      return;
    }
    const adminId = (req as any).user._id;
    const dataset = await updateDatasetPriceService(id, price, adminId);
    res.status(200).json({ success: true, dataset });
  } catch (error: any) {
    if (error.message === "INVALID_ID") {
      res.status(400).json({ success: false, message: "Invalid dataset ID" });
    } else if (error.message === "INVALID_PRICE") {
      res.status(400).json({ success: false, message: "Invalid price value" });
    } else if (error.message === "NOT_FOUND") {
      res.status(404).json({ success: false, message: "Dataset not found" });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

// ─── 3.7 anonymizeData ───────────────────────────────────────────────────────
export const anonymizeData = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = (req as any).user._id;
    const { modifiedCount } = await anonymizeAuditLogs(adminId);
    res.status(200).json({ success: true, modifiedCount });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
