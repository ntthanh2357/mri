/**
 * NeuroScan AI - Chép sinh hiệu của các lượt khám cũ sang VitalSign (UC-PAT-12)
 *
 * Trước 2026-10-12, sinh hiệu điều dưỡng nhập ở lượt khám (visit.vitals) không được chép sang VitalSign,
 * nên biểu đồ "Sức khỏe của tôi" thiếu các lần đo cũ. Script dùng lại syncVisitVitals:
 * mỗi lượt khám đúng 1 bản ghi (visit_id) → chạy lại nhiều lần không sinh trùng.
 *
 * Chạy thử (chỉ đếm, không ghi):  npm run vitals:backfill
 * Ghi thật:                        npm run vitals:backfill -- --apply
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Visit } from "../models/visit.model.js";
import { VitalSign } from "../models/vitalSign.model.js";
import { tenantStorage } from "../middlewares/tenant.middleware.js";
import { vitalFromVisit, syncVisitVitals } from "../services/vitalSign.service.js";

const APPLY = process.argv.includes("--apply");
const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/neuro";

const run = async () => {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log(`Database: ${mongoose.connection.host}/${mongoose.connection.name}  |  Chế độ: ${APPLY ? "GHI THẬT" : "chạy thử (không ghi)"}`);

  const visits = await Visit.find({ "vitals.pulse": { $ne: null }, "vitals.bloodPressure": { $nin: ["", null] } })
    .select("hospitalId patientId vitals createdAt")
    .setOptions({ bypassTenancy: true });

  let eligible = 0, alreadySynced = 0, skipped = 0, written = 0;
  for (const visit of visits) {
    if (!vitalFromVisit(visit.vitals) || !visit.patientId) { skipped++; continue; }
    eligible++;
    const exists = await VitalSign.exists({ hospitalId: visit.hospitalId, visit_id: visit._id });
    if (exists) { alreadySynced++; continue; }
    if (APPLY) { await syncVisitVitals(visit); written++; }
  }

  console.log(`Lượt khám có sinh hiệu: ${visits.length}`);
  console.log(`  Đủ dữ liệu (mạch, huyết áp, SpO₂): ${eligible}  |  Thiếu dữ liệu, bỏ qua: ${skipped}`);
  console.log(`  Đã có trong VitalSign: ${alreadySynced}  |  ${APPLY ? "Đã chép" : "Sẽ chép"}: ${APPLY ? written : eligible - alreadySynced}`);
};

tenantStorage.run({ bypassTenancy: true, isSuperAdmin: true }, async () => {
  try {
    await run();
  } catch (err) {
    console.error("Lỗi chép sinh hiệu:", err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
});
