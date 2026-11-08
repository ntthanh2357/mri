/**
 * Sửa dữ liệu cũ mà rà soát DB thật tháng 11/2026 phát hiện. Mặc định chỉ đếm, không ghi.
 *
 *   node scripts/repairDataV34.js           Chạy thử: in số bản ghi sẽ sửa
 *   node scripts/repairDataV34.js --apply   Ghi thay đổi (sao lưu DB trước)
 *
 * Sửa tự động:
 *   - CCCD trong dataprivacyconsents còn dạng chữ thường: mã hóa, lưu 4 số cuối
 *   - Số thẻ BHYT còn dạng chữ thường: mã hóa, tạo hash tra cứu, lưu 4 số cuối
 *   - Bình duyệt phim có kết quả đọc nhưng thiếu reviewerIds: khôi phục người đọc, chuyển sang chờ kết luận
 * Chỉ báo cáo, cần người quyết định:
 *   - Cảnh báo cấp cứu mở quá 24 giờ, lịch MRI không có lượt khám, đơn thuốc thiếu trạng thái phát
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { encryptField } from "../src/services/fieldCrypto.service.js";
import { encryptBhytCardNumber } from "../src/modules/billing/bhytCrypto.util.js";

dotenv.config();

const apply = process.argv.includes("--apply");
const report = {};

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error("Thiếu MONGO_URI");
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  const col = (name) => mongoose.connection.collection(name);

  let n = 0;
  for await (const doc of col("dataprivacyconsents").find({ signerNationalId: /^\d{9,12}$/ })) {
    n += 1;
    if (apply) {
      await col("dataprivacyconsents").updateOne(
        { _id: doc._id },
        { $set: { signerNationalId: encryptField(doc.signerNationalId), signerNationalIdLast4: doc.signerNationalId.slice(-4) } }
      );
    }
  }
  report["CCCD chữ thường trong cam kết dữ liệu"] = n;

  n = 0;
  for await (const doc of col("bhytinfos").find({ cardNumber: /^[A-Z]{2}\d{10,13}$/ })) {
    n += 1;
    if (apply) await col("bhytinfos").updateOne({ _id: doc._id }, { $set: encryptBhytCardNumber(doc.cardNumber) });
  }
  report["Số thẻ BHYT chữ thường"] = n;

  n = 0;
  for await (const doc of col("peerreviews").find({ "readings.0": { $exists: true }, "reviewerIds.0": { $exists: false } })) {
    n += 1;
    if (apply) {
      await col("peerreviews").updateOne(
        { _id: doc._id },
        { $set: { reviewerIds: doc.readings.map((r) => r.reviewerId).filter(Boolean), status: doc.status === "in_review" ? "awaiting_final" : doc.status } }
      );
    }
  }
  report["Bình duyệt phim thiếu người đọc"] = n;

  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  report["[Chỉ báo cáo] Cảnh báo cấp cứu mở quá 24 giờ"] = await col("emergencyalerts").countDocuments({
    status: { $in: ["active", "triggered", "acknowledged", "in_progress", "escalated"] },
    triggeredAt: { $lt: dayAgo },
  });
  report["[Chỉ báo cáo] Lịch MRI đang giữ nhưng không có lượt khám"] = await col("mrislots").countDocuments({
    status: { $in: ["booked", "in_progress"] },
    visitId: null,
  });
  report["[Chỉ báo cáo] Đơn thuốc thiếu trạng thái phát"] = await col("prescriptions").countDocuments({ dispenseStatus: { $exists: false } });

  console.log(apply ? "[ĐÃ GHI]" : "[CHẠY THỬ, không ghi gì]");
  for (const [label, count] of Object.entries(report)) console.log(`  ${label}: ${count}`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(String(err.message).replace(/mongodb(\+srv)?:\/\/\S+/g, "<uri>"));
  process.exit(1);
});
