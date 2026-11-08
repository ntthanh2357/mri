/**
 * Chuyển y lệnh miệng cũ sang bộ trạng thái v3.4. Phải chạy trước khi bật phiên bản mới, nếu không
 * job leo thang sẽ coi y lệnh cũ là đang chờ đọc lại.
 *
 *   node scripts/migrateVerbalOrdersV34.js              Chạy thử: chỉ in số liệu, không ghi
 *   node scripts/migrateVerbalOrdersV34.js --apply      Ghi thay đổi
 *   node scripts/migrateVerbalOrdersV34.js --rollback   Khôi phục trạng thái cũ từ legacyStatus
 *
 * Quy tắc:
 *   countersigned / có countersignedAt                  → fully_signed
 *   pending_countersign có readBackConfirmedBy thật     → readback_confirmed
 *   còn lại (kể cả thiếu status, overdue_warning)       → legacy_unverified
 * Bản cũ ghi isReadBackConfirmed=true dù không có điều dưỡng xác nhận, nên chỉ tin readBackConfirmedBy.
 * Mã OTP dạng chữ thường (readBackOtpCode) luôn bị xóa khi --apply.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const LEGACY_STATUSES = new Set(["pending_countersign", "countersigned", "overdue_warning"]);

export const mapLegacyOrder = (order) => {
  const previous = order.status ?? null;
  if (!previous || LEGACY_STATUSES.has(previous)) {
    if (previous === "countersigned" || order.countersignedAt) return { status: "fully_signed", previous };
    if (previous === "pending_countersign" && order.readBackConfirmedBy) return { status: "readback_confirmed", previous };
    return { status: "legacy_unverified", previous };
  }
  return null;
};

const summarize = (counts) => Object.entries(counts).map(([key, value]) => `  ${key}: ${value}`).join("\n") || "  (không có)";

const run = async () => {
  const apply = process.argv.includes("--apply");
  const rollback = process.argv.includes("--rollback");
  if (!process.env.MONGO_URI) throw new Error("Thiếu MONGO_URI");

  await mongoose.connect(process.env.MONGO_URI);
  const records = mongoose.connection.collection("medicalrecords");
  const cursor = records.find({ "verbalOrders.0": { $exists: true } }, { projection: { verbalOrders: 1 } });

  const counts = {};
  let touchedRecords = 0;
  let clearedOtp = 0;

  for await (const record of cursor) {
    let changed = false;
    const orders = record.verbalOrders.map((order) => {
      const next = { ...order };
      if (rollback) {
        if (order.legacyStatus === undefined || order.legacyStatus === null) return next;
        next.status = order.legacyStatus === "__none__" ? undefined : order.legacyStatus;
        delete next.legacyStatus;
        counts[`${order.status} → ${order.legacyStatus}`] = (counts[`${order.status} → ${order.legacyStatus}`] || 0) + 1;
        changed = true;
        return next;
      }
      if (next.readBackOtpCode !== undefined) {
        delete next.readBackOtpCode;
        clearedOtp += 1;
        changed = true;
      }
      const mapped = mapLegacyOrder(order);
      if (mapped) {
        next.status = mapped.status;
        next.legacyStatus = mapped.previous ?? "__none__";
        counts[`${mapped.previous ?? "(thiếu)"} → ${mapped.status}`] = (counts[`${mapped.previous ?? "(thiếu)"} → ${mapped.status}`] || 0) + 1;
        changed = true;
      }
      return next;
    });
    if (!changed) continue;
    touchedRecords += 1;
    if (apply || rollback) {
      await records.updateOne({ _id: record._id }, { $set: { verbalOrders: orders } });
    }
  }

  const mode = rollback ? "KHÔI PHỤC" : apply ? "ĐÃ GHI" : "CHẠY THỬ (không ghi gì)";
  console.log(`[${mode}] Hồ sơ bị ảnh hưởng: ${touchedRecords}. Mã OTP dạng chữ thường đã xóa: ${apply ? clearedOtp : 0}/${clearedOtp}.`);
  console.log(summarize(counts));
  await mongoose.disconnect();
};

if (process.argv[1]?.endsWith("migrateVerbalOrdersV34.js")) {
  run().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
