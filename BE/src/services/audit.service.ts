import { AuditLog } from "../models/auditLog.model";

export const getAuditLogs = async () => {
  return AuditLog.find().sort({ createdAt: -1 }).lean();
};
