import { MedicalRecord } from "../modules/emr/models/medicalRecord.model.js";
import { User } from "../models/user.model.js";
import { createNotificationInternal } from "../controllers/notification.controller.js";
import { recordAuditLog, AUDIT_ACTIONS } from "./auditLog.service.js";

// Quy định nội bộ của hệ thống, viện có thể điều chỉnh theo quy chế của mình.
const READBACK_ESCALATE_MS = 15 * 60 * 1000;

const OPEN_STATUSES = ["pending_readback", "readback_confirmed"];

const notifyPrescriberAndHeads = async ({ hospitalId, order, recordId, title, message }) => {
  const heads = await User.find({ hospitalId, role: "department_head", isLocked: { $ne: true } }).select("_id").lean();
  const recipients = new Set(heads.map((head) => String(head._id)));
  if (order.prescribedByDoctorId) recipients.add(String(order.prescribedByDoctorId));
  for (const recipientId of recipients) {
    await createNotificationInternal({
      hospitalId,
      recipientId,
      type: "emergency_alert",
      title,
      message,
      relatedId: recordId,
    });
  }
};

// Chạy được trên nhiều instance: mỗi y lệnh được giành quyền atomic theo mốc thời gian,
// instance không giành được thì bỏ qua, nên cảnh báo chỉ gửi đúng một lần.
const processStage = async ({ now, elemFilter, isDue, stampField, onClaimed }) => {
  const records = await MedicalRecord.find({ verbalOrders: { $elemMatch: elemFilter } })
    .setOptions({ bypassTenancy: true })
    .select("hospitalId patientName verbalOrders")
    .lean();

  let count = 0;
  for (const record of records) {
    for (const order of record.verbalOrders.filter((item) => !item[stampField] && isDue(item))) {
      const claimed = await MedicalRecord.findOneAndUpdate(
        { _id: record._id, verbalOrders: { $elemMatch: { _id: order._id, [stampField]: null } } },
        { $set: { [`verbalOrders.$.${stampField}`]: now } }
      )
        .setOptions({ bypassTenancy: true })
        .select("_id");
      if (!claimed) continue;
      await onClaimed(record, order);
      count += 1;
    }
  }
  return count;
};

export const runVerbalOrderEscalationJob = async (now = new Date()) => {
  try {
    const readBackCutoff = new Date(now.getTime() - READBACK_ESCALATE_MS);
    const escalated = await processStage({
      now,
      stampField: "escalatedReadBackAt",
      elemFilter: {
        status: "pending_readback",
        prescribedAt: { $lte: readBackCutoff },
        escalatedReadBackAt: null,
      },
      isDue: (order) => order.status === "pending_readback" && new Date(order.prescribedAt) <= readBackCutoff,
      onClaimed: async (record, order) => {
        await recordAuditLog({
          action: AUDIT_ACTIONS.VERBAL_ORDER_READBACK_ESCALATED,
          hospitalId: record.hospitalId,
          targetModel: "MedicalRecord",
          targetId: String(record._id),
          metadata: { verbalOrderId: String(order._id) },
        });
        await notifyPrescriberAndHeads({
          hospitalId: record.hospitalId,
          order,
          recordId: record._id,
          title: "Y lệnh miệng quá 15 phút chưa đọc lại",
          message: `Bệnh nhân ${record.patientName || ""}: "${order.orderText}" chưa được điều dưỡng ${order.nurseReceivedName || ""} xác nhận đọc lại.`,
        });
      },
    });

    const overdue = await processStage({
      now,
      stampField: "overdueAt",
      elemFilter: {
        status: { $in: OPEN_STATUSES },
        countersignDeadline: { $lte: now },
        overdueAt: null,
      },
      isDue: (order) =>
        OPEN_STATUSES.includes(order.status) && order.countersignDeadline && new Date(order.countersignDeadline) <= now,
      onClaimed: async (record, order) => {
        await recordAuditLog({
          action: AUDIT_ACTIONS.VERBAL_ORDER_OVERDUE,
          hospitalId: record.hospitalId,
          targetModel: "MedicalRecord",
          targetId: String(record._id),
          metadata: { verbalOrderId: String(order._id), status: order.status },
        });
        await notifyPrescriberAndHeads({
          hospitalId: record.hospitalId,
          order,
          recordId: record._id,
          title: "Y lệnh miệng quá hạn ký bổ sung",
          message: `Bệnh nhân ${record.patientName || ""}: "${order.orderText}" đã quá 24 giờ mà chưa được ký bổ sung.`,
        });
      },
    });

    return { success: true, escalated, overdue };
  } catch (err) {
    console.error("Lỗi job leo thang y lệnh miệng:", err);
    return { success: false, error: err.message };
  }
};
