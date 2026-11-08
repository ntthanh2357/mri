import crypto from "crypto";
import { AuditLog } from "../models/auditLog.model.js";
import { FEATURES } from "../config/features.config.js";
import { AuditChainAnchor } from "../models/auditChainAnchor.model.js";
import { getJwtSecret } from "../config/jwt.config.js";

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

  // Kiểm toán chu trình State Machine Ca khám (TT 13/2025/TT-BYT & HIPAA Audit Trail)
  VISIT_STATUS_CHANGED: "VISIT_STATUS_CHANGED",
  FSM_TRANSITION: "FSM_TRANSITION",

  // UC-HADM-04 — Can thiệp Điều chuyển Phân công (Smart Override): lý do bắt buộc
  ASSIGNMENT_OVERRIDDEN: "ASSIGNMENT_OVERRIDDEN",

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

  // Gói chuyển viện thông minh (UC-DOC-10): bác sĩ lập → lễ tân gửi email cho bệnh nhân
  REFERRAL_PACKAGE_CREATED: "REFERRAL_PACKAGE_CREATED",
  REFERRAL_PACKAGE_EMAILED: "REFERRAL_PACKAGE_EMAILED",
  REFERRAL_PACKAGE_EMAIL_FAILED: "REFERRAL_PACKAGE_EMAIL_FAILED",
  REFERRAL_PACKAGE_CANCELLED: "REFERRAL_PACKAGE_CANCELLED",

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

  // Phân hệ Khoa Dược — UC-PHA (Dual-Sign, Phát thuốc, Hậu kiểm 24h, Kho theo lô GPP)
  // Trước đây các thao tác này chỉ để lại dispenseHistory/stockMovements rải rác trong
  // từng document — không nằm trong chuỗi băm trung tâm, không truy vấn được từ màn
  // Nhật ký kiểm toán lâm sàng. Giờ ghi đủ 8 thao tác dược sĩ & quản trị danh mục.
  PRESCRIPTION_VERIFIED: "PRESCRIPTION_VERIFIED",
  PRESCRIPTION_REJECTED: "PRESCRIPTION_REJECTED",
  PRESCRIPTION_DISPENSED: "PRESCRIPTION_DISPENSED",
  PRESCRIPTION_POST_HOC_REVIEWED: "PRESCRIPTION_POST_HOC_REVIEWED",
  DRUG_CATALOG_CREATED: "DRUG_CATALOG_CREATED",
  DRUG_CATALOG_UPDATED: "DRUG_CATALOG_UPDATED",
  DRUG_CATALOG_DELETED: "DRUG_CATALOG_DELETED",
  DRUG_STOCK_ADJUSTED: "DRUG_STOCK_ADJUSTED",

  // [MEGA AUDIT v3.0] Các hành động kiểm toán bổ sung (Q-CLINICAL-01, Q-BILLING-01/02, Q-EMG-01)
  IMAGING_REPORT_ACKNOWLEDGED: "IMAGING_REPORT_ACKNOWLEDGED",
  CLINICAL_ADDENDUM_CREATED: "CLINICAL_ADDENDUM_CREATED",
  PAYMENT_GATE_BYPASSED: "PAYMENT_GATE_BYPASSED",
  DEBT_APPROVAL_GRANTED: "DEBT_APPROVAL_GRANTED",
  REFUND_REJECTED: "REFUND_REJECTED",
  VERBAL_ORDER_CREATED: "VERBAL_ORDER_CREATED",
  VERBAL_ORDER_READBACK_CONFIRMED: "VERBAL_ORDER_READBACK_CONFIRMED",
  VERBAL_ORDER_COUNTERSIGNED: "VERBAL_ORDER_COUNTERSIGNED",

  // [v3.4] Các hành động bổ sung sau rà soát nghiệp vụ
  VERBAL_ORDER_REJECTED: "VERBAL_ORDER_REJECTED",
  VERBAL_ORDER_READBACK_ESCALATED: "VERBAL_ORDER_READBACK_ESCALATED",
  VERBAL_ORDER_OVERDUE: "VERBAL_ORDER_OVERDUE",
  IMAGING_REPORT_SIGNED: "IMAGING_REPORT_SIGNED",
  REFUND_REQUESTED: "REFUND_REQUESTED",
  REFUND_COMPLETED: "REFUND_COMPLETED",
  LARGE_REFUND_REVIEWED: "LARGE_REFUND_REVIEWED",
  VISIT_TYPE_CHANGED: "VISIT_TYPE_CHANGED",
  VISIT_EMERGENCY_FLAGGED: "VISIT_EMERGENCY_FLAGGED",
  MRI_EMERGENCY_SCHEDULED: "MRI_EMERGENCY_SCHEDULED",
  MRI_SAFETY_CHECKLIST_SUBMITTED: "MRI_SAFETY_CHECKLIST_SUBMITTED",
  CONTRAST_SCREENING_SUBMITTED: "CONTRAST_SCREENING_SUBMITTED",
  CONTRAST_RISK_OVERRIDDEN: "CONTRAST_RISK_OVERRIDDEN",
  HOSPITAL_POLICY_UPDATED: "HOSPITAL_POLICY_UPDATED",
  STAFF_IMAGING_SIGN_PERMISSION_CHANGED: "STAFF_IMAGING_SIGN_PERMISSION_CHANGED",
};

const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";
const MAX_RETRIES = 5;

const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");

const anchorSecret = () => process.env.AUDIT_ANCHOR_SECRET || getJwtSecret();
const signAnchor = (sequenceNumber, currentHash, v2FromSequence) =>
  crypto.createHmac("sha256", anchorSecret()).update(`${sequenceNumber}|${currentHash}|${v2FromSequence}`).digest("hex");

const updateChainAnchor = async (sequenceNumber, currentHash) => {
  try {
    const existing = await AuditChainAnchor.findById("head").select("v2FromSequence").lean();
    const v2FromSequence = existing?.v2FromSequence ?? sequenceNumber;
    const fields = { sequenceNumber, currentHash, v2FromSequence, signature: signAnchor(sequenceNumber, currentHash, v2FromSequence) };
    await AuditChainAnchor.updateOne(
      { _id: "head", sequenceNumber: { $lt: sequenceNumber } },
      { $set: fields },
      { upsert: true }
    );
  } catch (err) {
    // E11000: mốc hiện tại đã mới hơn bản ghi này (instance khác vừa ghi), không cần cập nhật
    if (err.code !== 11000) console.error("Lỗi cập nhật mốc chuỗi audit:", err.message);
  }
};

const hashMaterialV2 = ({ previousHash, sequenceNumber, hashedTimestamp, action, entity, entityId, performerDigest, payloadHash, details, hospitalId, ipAddress, location }) =>
  [previousHash, sequenceNumber, hashedTimestamp, action, entity, entityId || "", performerDigest, payloadHash || "", details || "", hospitalId ? String(hospitalId) : "", ipAddress || "", location || ""].join("|");

// Bản ghi trước v3.4 giữ công thức cũ. Không thể hạ cấp bản ghi mới về công thức cũ vì hash sẽ không khớp.
const recomputedHashes = (log) => {
  if (log.hashVersion === 2) {
    const performerDigest = log.redactedAt ? log.performerDigest : sha256(String(log.performedBy || ""));
    if (!log.redactedAt && log.performerDigest !== performerDigest) return [];
    return [sha256(hashMaterialV2({ ...log, performerDigest }))];
  }
  const base = `${log.previousHash}|${log.sequenceNumber}|${log.hashedTimestamp}|${log.action}|${log.entity}|${log.entityId || ""}|${log.performedBy || ""}|${log.payloadHash || ""}`;
  return [sha256(`${base}|${log.details || ""}`), sha256(base)];
};

export const recordAuditLog = async ({
  action,
  entity,
  targetModel,
  entityId = "",
  targetId = "",
  performedBy = "system",
  actorId = "",
  hospitalId = null,
  details = "",
  note = "",
  metadata = null,
  payload = null,
  ipAddress = "",
  location = "",
}) => {
  const resolvedEntity = entity || targetModel || "System";
  const resolvedEntityId = entityId || targetId || "";
  const resolvedPerformedBy = (performedBy && performedBy !== "system") ? performedBy : (actorId || "system");
  const resolvedPayload = payload || metadata || null;
  const resolvedDetails = details || note || (metadata ? JSON.stringify(metadata) : "");

  // Thực thi tuần tự qua hàng đợi Promise Chain kết hợp Optimistic Concurrency Retry
  return new Promise((resolve, reject) => {
    auditQueuePromise = auditQueuePromise
      .then(async () => {
        if (!FEATURES.ENABLE_HASH_CHAIN_AUDIT) {
          const basicLog = await AuditLog.create({
            action,
            entity: resolvedEntity,
            entityId: resolvedEntityId ? resolvedEntityId.toString() : "",
            performedBy: resolvedPerformedBy ? resolvedPerformedBy.toString() : "system",
            hospitalId: hospitalId || null,
            details: resolvedDetails,
            ipAddress: ipAddress || "",
            location: location || "",
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
            const payloadHash = resolvedPayload
              ? crypto.createHash("sha256").update(typeof resolvedPayload === "string" ? resolvedPayload : JSON.stringify(resolvedPayload)).digest("hex")
              : "";

            const timestamp = new Date().toISOString();
            const performedByText = resolvedPerformedBy ? resolvedPerformedBy.toString() : "system";
            const entityIdText = resolvedEntityId ? resolvedEntityId.toString() : "";
            const performerDigest = sha256(performedByText);

            const currentHash = sha256(hashMaterialV2({
              previousHash,
              sequenceNumber,
              hashedTimestamp: timestamp,
              action,
              entity: resolvedEntity,
              entityId: entityIdText,
              performerDigest,
              payloadHash,
              details: resolvedDetails,
              hospitalId,
              ipAddress,
              location,
            }));

            const newLog = await AuditLog.create({
              action,
              entity: resolvedEntity,
              entityId: entityIdText,
              performedBy: performedByText,
              hospitalId: hospitalId || null,
              details: resolvedDetails,
              ipAddress: ipAddress || "",
              location: location || "",
              hashVersion: 2,
              performerDigest,
              sequenceNumber,
              previousHash,
              currentHash,
              payloadHash,
              hashedTimestamp: timestamp,
              tamperVerified: true,
            });

            await updateChainAnchor(sequenceNumber, currentHash);
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
 * Thẩm định tính toàn vẹn của chuỗi băm nhật ký kiểm toán.
 * Mặc định xét toàn bộ chuỗi theo con trỏ, không nạp hết vào bộ nhớ. Truyền số để chỉ xét N bản ghi đầu
 * (kết quả có partial: true). Chuỗi là chung toàn hệ thống nên tham số hospitalId không lọc được.
 */
export const verifyAuditChainIntegrity = async (limitOrHospitalId = null) => {
  const limit = typeof limitOrHospitalId === "number" && limitOrHospitalId > 0 ? limitOrHospitalId : null;
  const query = AuditLog.find({ sequenceNumber: { $exists: true } }).sort({ sequenceNumber: 1 });
  if (limit) query.limit(limit);

  const broken = (log, index, reason) => ({
    valid: false,
    isValid: false,
    brokenAtIndex: index,
    brokenSequenceNumber: log?.sequenceNumber ?? null,
    logId: log?._id ?? null,
    reason,
  });

  let expectedPrevHash = GENESIS_HASH;
  let index = 0;
  let last = null;
  const anchor = await AuditChainAnchor.findById("head").lean();
  let anchorEntry = null;
  let seenV2 = false;
  let legacyUnverifiedCount = 0;

  for await (const log of query.lean().cursor()) {
    if (log.previousHash !== expectedPrevHash) {
      return broken(log, index, `Chuỗi băm bị đứt gãy tại bản ghi #${log.sequenceNumber}: previousHash không khớp với currentHash của bản ghi trước.`);
    }
    const mustBeV2 = seenV2 || (anchor && log.sequenceNumber >= anchor.v2FromSequence);
    if (log.hashVersion === 2) {
      seenV2 = true;
    } else if (mustBeV2) {
      return broken(log, index, `Bản ghi đã bị chỉnh sửa nội dung trái phép tại #${log.sequenceNumber}: bị hạ xuống định dạng cũ.`);
    }
    if (!log.hashedTimestamp) {
      if (log.hashVersion === 2) {
        return broken(log, index, `Bản ghi đã bị chỉnh sửa nội dung trái phép tại #${log.sequenceNumber}: thiếu hashedTimestamp.`);
      }
      // Log tạo trước khi có hashedTimestamp: chỉ kiểm tra được liên kết, không băm lại được nội dung
      legacyUnverifiedCount += 1;
      expectedPrevHash = log.currentHash;
      last = log;
      index += 1;
      continue;
    }
    if (!recomputedHashes(log).includes(log.currentHash)) {
      return broken(log, index, `Bản ghi đã bị chỉnh sửa nội dung trái phép tại #${log.sequenceNumber}: recomputedHash không khớp với currentHash.`);
    }
    if (anchor && log.sequenceNumber === anchor.sequenceNumber) anchorEntry = log;
    expectedPrevHash = log.currentHash;
    last = log;
    index += 1;
  }

  // Xóa bản ghi cuối không làm đứt liên kết: chỉ phát hiện được bằng mốc đầu chuỗi đã ký
  let anchorChecked = false;
  if (anchor && !limit) {
    anchorChecked = true;
    if (anchor.signature !== signAnchor(anchor.sequenceNumber, anchor.currentHash, anchor.v2FromSequence)) {
      return broken(last, index, "Mốc đầu chuỗi nhật ký có chữ ký không hợp lệ.");
    }
    if (!anchorEntry || anchorEntry.currentHash !== anchor.currentHash) {
      return broken(last, index, `Chuỗi nhật ký bị cắt hoặc thay thế: không còn bản ghi #${anchor.sequenceNumber} khớp với mốc đã ký.`);
    }
  }

  if (!last) {
    return { valid: true, isValid: true, verifiedCount: 0, anchorChecked, message: "Không có bản ghi có chuỗi băm." };
  }
  return {
    valid: true,
    isValid: true,
    verifiedCount: index,
    partial: Boolean(limit),
    anchorChecked,
    legacyUnverifiedCount,
    latestSequenceNumber: last.sequenceNumber,
    headHash: last.currentHash,
  };
};
