/**
 * NeuroScan AI - Legacy EMR Compliance Migration Script
 * Căn cứ: Thông tư 46/2018/TT-BYT & HIPAA §164.312
 * 
 * Mục tiêu:
 * 1. Bổ sung trường retentionCategory, retentionYears, retentionExpiresAt cho các hồ sơ bệnh án cũ.
 * 2. Đánh dấu requiresReview = true để Hội đồng hồ sơ bệnh án rà soát.
 * 3. Khởi tạo Genesis Block cho AuditLog nếu hệ thống chưa có chuỗi băm.
 */

import mongoose from "mongoose";
import { MedicalRecord } from "../modules/emr/models/medicalRecord.model.js";
import { AuditLog } from "../models/auditLog.model.js";
import { calculateRetentionExpiry } from "../utils/retention.util.js";
import { recordAuditLog } from "../services/auditLog.service.js";

export const migrateLegacyEMR = async () => {
  console.log(">> Bắt đầu quá trình di chuyển và chuẩn hóa dữ liệu EMR cũ...");

  // 1. Quét các hồ sơ chưa có retentionCategory hoặc retentionExpiresAt
  const legacyRecords = await MedicalRecord.find({
    $or: [
      { retentionCategory: { $exists: false } },
      { retentionExpiresAt: { $exists: false } },
      { retentionExpiresAt: null },
    ],
  }).setOptions({ bypassTenancy: true });

  console.log(`Tìm thấy ${legacyRecords.length} hồ sơ bệnh án cũ cần chuẩn hóa.`);

  let updatedCount = 0;
  for (const record of legacyRecords) {
    const defaultCat = record.admissionType === "Ngoại trú" ? "ngoai_tru" : "noi_tru";
    const startDate = record.dischargeDate || record.createdAt || new Date();
    const { retentionCategory, retentionYears, retentionExpiresAt } = calculateRetentionExpiry(defaultCat, startDate);

    record.retentionCategory = retentionCategory;
    record.retentionYears = retentionYears;
    record.retentionExpiresAt = retentionExpiresAt;
    record.requiresReview = true; // Cần Hội đồng bệnh viện rà soát xác nhận

    if (!record.addendums) {
      record.addendums = [];
    }

    await record.save();
    updatedCount++;
  }

  // 2. Khởi tạo Genesis Hash cho AuditLog nếu chưa có bản ghi chuỗi băm nào
  const existingHashedLog = await AuditLog.findOne({ sequenceNumber: { $exists: true } });
  let genesisInitialized = false;

  if (!existingHashedLog) {
    console.log("Khởi tạo Genesis Block cho chuỗi băm AuditLog...");
    await recordAuditLog({
      action: "GENESIS_BLOCK_INITIALIZE",
      entity: "SystemAudit",
      entityId: "GENESIS-001",
      performedBy: "SYSTEM_INITIALIZER",
      details: "Khởi tạo khối gốc (Genesis Block) cho chuỗi băm nhật ký kiểm toán tuân thủ HIPAA §164.312(b).",
    });
    genesisInitialized = true;
  }

  console.log(`>> Hoàn tất di chuyển: ${updatedCount} hồ sơ được cập nhật. Genesis Initialized: ${genesisInitialized}.`);
  return { updatedCount, genesisInitialized };
};
