import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Hospital } from "../models/hospital.model.js";
import { AuditLog } from "../models/auditLog.model.js";

export const getAuditLogs = async (hospitalId = null) => {
  const query = {};
  if (hospitalId) {
    query.hospitalId = hospitalId;
  }
  const logs = await AuditLog.find(query).sort({ createdAt: -1 }).lean();

  const userIds = logs.map(l => l.performedBy).filter(id => mongoose.Types.ObjectId.isValid(id));
  const users = await User.find({ _id: { $in: userIds } }).select("profile.name email").lean();
  const userMap = new Map(users.map(u => [u._id.toString(), u]));

  const hospitalIds = logs.map(l => l.hospitalId).filter(id => id && mongoose.Types.ObjectId.isValid(id));
  const hospitals = await Hospital.find({ _id: { $in: hospitalIds } }).select("name").lean();
  const hospitalMap = new Map(hospitals.map(h => [h._id.toString(), h]));

  return logs.map(log => {
    const user = userMap.get(log.performedBy);
    const hospitalObj = log.hospitalId ? hospitalMap.get(log.hospitalId.toString()) : null;
    return {
      ...log,
      performedByName: user?.profile?.name || user?.email || log.performedBy || "Hệ thống",
      performedByEmail: user?.email || "",
      hospitalName: hospitalObj?.name || "Hệ thống"
    };
  });
};

/**
 * Anonymize patient-identifiable data in AuditLog records per HIPAA.
 * Requirements: 11.2, 11.4, 11.5
 *
 * Replaces `performedBy` with "REDACTED-HIPAA" for all records whose
 * `entity` is "Patient" or "MedicalRecord", then creates a new AuditLog
 * entry documenting the bulk operation.
 *
 * @returns {{ modifiedCount: number }} exact number of records changed
 */
export const anonymizeAuditLogs = async (adminId) => {
  const result = await AuditLog.updateMany(
    { entity: { $in: ["Patient", "MedicalRecord"] } },
    { $set: { performedBy: "REDACTED-HIPAA" } }
  );

  const modifiedCount = result.modifiedCount;

  // Create an audit trail of the anonymization itself (Requirement 11.5)
  await AuditLog.create({
    action: "anonymize-data",
    entity: "AuditLog",
    entityId: "bulk",
    performedBy: adminId,
    details: `Bulk anonymization completed. ${modifiedCount} record(s) redacted.`,
  });

  return { modifiedCount };
};
