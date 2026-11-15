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
 *   - Mã OTP còn lưu dạng chữ thường (trước bản băm HMAC): vô hiệu, người dùng xin mã mới
 * Chỉ báo cáo, cần người quyết định:
 *   - Cảnh báo cấp cứu mở quá 24 giờ, lịch MRI không có lượt khám, đơn thuốc thiếu trạng thái phát
 *   - Dữ liệu do mặc định cũ tự điền: phiếu chăm sóc GCS 15/đồng tử 2.5mm, tên chung "Bác sĩ điều trị",
 *     nơi chuyển đến tự điền, nhật ký thiếu email người thao tác
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { encryptField } from "../src/services/fieldCrypto.service.js";
import { encryptBhytCardNumber } from "../src/modules/billing/bhytCrypto.util.js";

dotenv.config();

const apply = process.argv.includes("--apply");
const report = {};

const run = async () => {
  // --apply mã hóa CCCD/BHYT bằng FIELD_ENCRYPTION_KEY: thiếu khóa thì fieldCrypto (ngoài production) dùng khóa DEV
  // công khai, dữ liệu thật sẽ bị "mã hóa" bằng khóa ai cũng biết. Dừng trước khi kết nối DB.
  if (apply && !process.env.FIELD_ENCRYPTION_KEY) {
    throw new Error("Không chạy --apply: thiếu FIELD_ENCRYPTION_KEY (khóa production). Đặt khóa trong BE/.env hoặc biến môi trường rồi chạy lại.");
  }
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

  // Mã OTP còn lưu dạng chữ thường (trước bản băm HMAC): vô hiệu để không ai đọc được mã đang hiệu lực; người dùng xin mã mới
  const plainOtp = { $or: [{ otpCode: { $type: "string", $not: /^[a-f0-9]{64}$/ } }, { otp2FACode: { $type: "string", $not: /^[a-f0-9]{64}$/ } }] };
  n = await col("users").countDocuments(plainOtp);
  if (apply && n) await col("users").updateMany(plainOtp, { $set: { otpCode: null, otpExpires: null, otp2FACode: null, otp2FAExpires: null } });
  report["Mã OTP còn lưu chữ thường (vô hiệu, người dùng xin mã mới)"] = n;

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

  // Dữ liệu do mặc định cũ tự điền (bản sửa vòng crawler): chỉ đếm, không đoán lại được đâu là đánh giá thật.
  // Phiếu có ĐỦ cả 3 khối mặc định (GCS 15 "Tỉnh táo", đồng tử 2.5mm "Tròn đều 2 bên", chân ống "khô ráo" khi không có dẫn lưu)
  // gần như chắc chắn điều dưỡng không đánh giá thần kinh. Cần hội đồng chuyên môn quyết định cách ghi chú.
  const defaultGcs = { "glasgow.eye": 4, "glasgow.verbal": 5, "glasgow.motor": 6, "glasgow.totalScore": 15, "glasgow.classification": "Tỉnh táo / Tri giác tốt" };
  const defaultPupils = { "pupils.leftSize": 2.5, "pupils.rightSize": 2.5, "pupils.shape": "Tròn đều 2 bên" };
  report["[Chỉ báo cáo] Phiếu chăm sóc có GCS 15 (có thể do mặc định cũ)"] = await col("caresheets").countDocuments(defaultGcs);
  report["[Chỉ báo cáo] Phiếu chăm sóc đủ 3 khối mặc định (GCS, đồng tử, chân ống) — gần như chắc không đánh giá"] = await col("caresheets").countDocuments({
    ...defaultGcs, ...defaultPupils, "surgicalDrainage.site": { $in: ["", null] }, "surgicalDrainage.condition": "Chân ống khô ráo, cố định tốt",
  });
  report["[Chỉ báo cáo] Đơn thuốc ghi tên chung \"Bác sĩ điều trị\""] = await col("prescriptions").countDocuments({ doctor_name: "Bác sĩ điều trị" });
  report["[Chỉ báo cáo] Giấy ra viện ghi tên chung \"Bác sĩ điều trị\""] = await col("dischargepapers").countDocuments({ doctor_name: "Bác sĩ điều trị" });
  report["[Chỉ báo cáo] Phiếu chuyển viện ghi nơi đến tự điền \"Bệnh viện tuyến trên\""] = await col("transferforms").countDocuments({ transferTo: "Bệnh viện tuyến trên (Chuyên khoa Ngoại Thần Kinh)" });
  report["[Chỉ báo cáo] Nhật ký kiểm toán có chữ \"undefined\" (email người thao tác bị thiếu)"] = await col("auditlogs").countDocuments({ details: /\bundefined\b/ });

  console.log(apply ? "[ĐÃ GHI]" : "[CHẠY THỬ, không ghi gì]");
  for (const [label, count] of Object.entries(report)) console.log(`  ${label}: ${count}`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(String(err.message).replace(/mongodb(\+srv)?:\/\/\S+/g, "<uri>"));
  process.exit(1);
});
