import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../plugins/tenancy.plugin.js";

/**
 * UC-PAT-03 — Số thứ tự tiếp đón lấy online (chỉ trong ngày, reset mỗi ngày).
 * waiting: chờ gọi · called: đang gọi · missed: gọi mà vắng (giữ số) · arrived: đã có mặt
 * served: đã lên quầy tiếp nhận · cancelled: bệnh nhân huỷ
 */
const queueTicketSchema = new Schema(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    dateKey: { type: String, required: true }, // "YYYY-MM-DD" theo giờ Việt Nam
    number: { type: Number, required: true },
    status: {
      type: String,
      enum: ["waiting", "called", "missed", "arrived", "served", "cancelled"],
      default: "waiting",
    },
    calledAt: { type: Date, default: null },
    callCount: { type: Number, default: 0 },
    missedAt: { type: Date, default: null },
    arrivedAt: { type: Date, default: null },
    servedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

queueTicketSchema.index({ hospitalId: 1, dateKey: 1, number: 1 }, { unique: true });
queueTicketSchema.index({ hospitalId: 1, dateKey: 1, patientId: 1 });
queueTicketSchema.plugin(tenancyPlugin);

export const QueueTicket = model("QueueTicket", queueTicketSchema, "queue_tickets");
export default QueueTicket;
