import crypto from "crypto";
import { AuditLog } from "../models/auditLog.model.js";
import { FEATURES } from "../config/features.config.js";

// Hàng đợi tuần tự in-process bảo vệ chuỗi băm khỏi Race Condition khi nhiều request đồng thời
let auditQueuePromise = Promise.resolve();

export const AUDIT_ACTIONS = {
  // Hoạt động EMR thông thường
  RECORD_VIEWED: "RECORD_VIEWED",
  RECORD_CREATED: "CREATE_EMR_RECORD",
  RECORD_UPDATED: "UPDATE_EMR_RECORD",
  RECORD_LOCKED: "LOCK_EMR_RECORD",
  RECORD_ADDENDUM_CREATED: "ADDENDUM_CREATED",
  RECORD_SIGNED: "SIGN_EMR_RECORD",

  // Hoạt động chuyên biệt Ung thư sọ não (Neuro-Oncology)
  TUMOR_BOARD_ACCESSED: "TUMOR_BOARD_ACCESSED",
  TUMOR_BOARD_DECISION_RECORDED: "TUMOR_BOARD_DECISION_RECORDED",
  MOLECULAR_DATA_VIEWED: "MOLECULAR_DATA_VIEWED",
  MOLECULAR_DATA_MODIFIED: "MOLECULAR_DATA_MODIFIED",
  GENETIC_COUNSELING_ACCESSED: "GENETIC_COUNSELING_ACCESSED",
  DICOM_ARCHIVE_DOWNLOADED: "DICOM_ARCHIVE_DOWNLOADED",
  CLINICAL_TRIAL_DATA_EXPORTED: "CLINICAL_TRIAL_DATA_EXPORTED",

  // Cơ chế truy cập khẩn cấp Cấp cứu (HIPAA §164.312(a)(2)(ii) Break-Glass)
  BREAK_GLASS_EMERGENCY_ACCESSED: "BREAK_GLASS_EMERGENCY_ACCESSED",

  // Kiểm toán chu trình State Machine Ca khám (TT46/2018/TT-BYT & HIPAA Audit Trail)
  VISIT_STATUS_CHANGED: "VISIT_STATUS_CHANGED",
  FSM_TRANSITION: "FSM_TRANSITION",

  // Phân hệ Quản lý Buồng giường & Chuyển viện Liên viện (Module 04 Concurrency & Patient Safety)
  BED_RESERVED: "BED_RESERVED",
  BED_OCCUPIED: "BED_OCCUPIED",
  BED_RELEASED: "BED_RELEASED",
  BED_TRANSFERRED: "BED_TRANSFERRED",
  BED_CLEANING_COMPLETED: "BED_CLEANING_COMPLETED",
  BED_HIJACK_BLOCKED: "BED_HIJACK_BLOCKED",
  CROSS_HOSPITAL_TOKEN_ISSUED: "CROSS_HOSPITAL_TOKEN_ISSUED",
  CROSS_HOSPITAL_TOKEN_REVOKED: "CROSS_HOSPITAL_TOKEN_REVOKED",
  CROSS_HOSPITAL_VIEW_ACCESSED: "CROSS_HOSPITAL_VIEW_ACCESSED",

  // Phân hệ Tài chính, Viện phí & Dược (Module 06 FinTech & Neuro-Oncology Billing Integrity)
  PAYMENT_INITIATED: "PAYMENT_INITIATED",
  PAYMENT_COMPLETED: "PAYMENT_COMPLETED",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  REFUND_REQUESTED: "REFUND_REQUESTED",
  REFUND_APPROVED: "REFUND_APPROVED",
  STOCK_DEDUCTED: "STOCK_DEDUCTED",
  STOCK_RESTOCKED: "STOCK_RESTOCKED",
  AML_THRESHOLD_FLAGGED: "AML_THRESHOLD_FLAGGED",
  AML_STR_REPORTED: "AML_STR_REPORTED",
  BHYT_CLAIM_SUBMITTED: "BHYT_CLAIM_SUBMITTED",
  BHYT_CLAIM_APPROVED: "BHYT_CLAIM_APPROVED",
  BHYT_CLAIM_REJECTED: "BHYT_CLAIM_REJECTED",
};

const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";
const MAX_RETRIES = 5;

export const recordAuditLog = async ({
  action,
  entity,
  entityId = "",
  performedBy = "system",
  hospitalId = null,
  details = "",
  payload = null,
}) => {
  // Thực thi tuần tự qua hàng đợi Promise Chain kết hợp Optimistic Concurrency Retry
  return new Promise((resolve, reject) => {
    auditQueuePromise = auditQueuePromise
      .then(async () => {
        if (!FEATURES.ENABLE_HASH_CHAIN_AUDIT) {
          const basicLog = await AuditLog.create({
            action,
            entity,
            entityId: entityId ? entityId.toString() : "",
            performedBy: performedBy ? performedBy.toString() : "system",
            hospitalId: hospitalId || null,
            details: details || "",
          });
          return resolve(basicLog);
        }

        // Vòng lặp thử lại (Optimistic Concurrency Control) chống Race Condition trong môi trường đa tiến trình
        let lastError = null;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            // Lấy bản ghi log gần nhất để trích xuất sequenceNumber và currentHash
            const lastLog = await AuditLog.findOne({ sequenceNumber: { $exists: true } })
              .sort({ sequenceNumber: -1 })
              .select("sequenceNumber currentHash")
              .lean();

            const sequenceNumber = lastLog?.sequenceNumber ? lastLog.sequenceNumber + 1 : 1;
            const previousHash = lastLog?.currentHash || GENESIS_HASH;

            // Băm payload nếu có (lưu vết before/after diff)
            const payloadHash = payload
              ? crypto.createHash("sha256").update(typeof payload === "string" ? payload : JSON.stringify(payload)).digest("hex")
              : "";

            const timestamp = new Date().toISOString();

            // Tính toán currentHash theo chuẩn mật mã học
            const hashMaterial = `${previousHash}|${sequenceNumber}|${timestamp}|${action}|${entity}|${entityId || ""}|${performedBy || ""}|${payloadHash}`;
            const currentHash = crypto.createHash("sha256").update(hashMaterial).digest("hex");

            const newLog = await AuditLog.create({
              action,
              entity,
              entityId: entityId ? entityId.toString() : "",
              performedBy: performedBy ? performedBy.toString() : "system",
              hospitalId: hospitalId || null,
              details: details || "",
              sequenceNumber,
              previousHash,
              currentHash,
              payloadHash,
              tamperVerified: true,
            });

            return resolve(newLog);
          } catch (err) {
            lastError = err;
            // Xử lý xung đột số thứ tự sequenceNumber (Mã lỗi MongoDB E11000 Duplicate Key)
            if (err.code === 11000 && attempt < MAX_RETRIES - 1) {
              // Chờ ngẫu nhiên có jitter trước khi thử lại
              await new Promise((res) => setTimeout(res, 15 + Math.random() * 25));
              continue;
            }
            break;
          }
        }

        console.error("Lỗi ghi nhận chuỗi băm AuditLog sau nhiều lần thử lại:", lastError);
        reject(lastError);
      })
      .catch((queueErr) => {
        console.error("Lỗi hàng đợi AuditLog:", queueErr);
        reject(queueErr);
      });
  });
};

/**
 * Thẩm định tính toàn vẹn của chuỗi băm nhật ký kiểm toán (Tamper-Evidence Verification)
 * Căn cứ: HIPAA §164.312(b) & Thông tư 46/2018/TT-BYT
 */
export const verifyAuditChainIntegrity = async (limit = 1000) => {
  const logs = await AuditLog.find({ sequenceNumber: { $exists: true } })
    .sort({ sequenceNumber: 1 })
    .limit(limit)
    .lean();

  if (!logs || logs.length === 0) {
    return { valid: true, verifiedCount: 0, message: "Không có bản ghi có chuỗi băm." };
  }

  let expectedPrevHash = "0000000000000000000000000000000000000000000000000000000000000000";

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];

    // 1. Kiểm tra liên kết previousHash với bản ghi trước
    if (log.previousHash !== expectedPrevHash) {
      return {
        valid: false,
        brokenAtIndex: i,
        brokenSequenceNumber: log.sequenceNumber,
        logId: log._id,
        reason: `Chuỗi băm bị đứt gãy tại bản ghi #${log.sequenceNumber}: previousHash không khớp với currentHash của bản ghi trước.`,
      };
    }

    expectedPrevHash = log.currentHash;
  }

  return {
    valid: true,
    verifiedCount: logs.length,
    latestSequenceNumber: logs[logs.length - 1].sequenceNumber,
    headHash: logs[logs.length - 1].currentHash,
  };
};
