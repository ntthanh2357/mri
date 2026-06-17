import { AuditLog } from "../models/auditLog.model";

export const getAuditLogs = async () => {
  return AuditLog.find().sort({ createdAt: -1 }).lean();
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
export const anonymizeAuditLogs = async (adminId: string) => {
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
