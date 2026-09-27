import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { migrateLegacyEMR } from "./migrate_legacy_emr.js";

const run = async () => {
  await connectDB();
  const db = mongoose.connection.db;

  console.log(">> 1. Kiểm tra và sửa các lượt khám (Visits) bị thiếu patientId...");
  const visits = await db.collection("visits").find({}).toArray();
  let fixedVisits = 0;

  for (const v of visits) {
    if (!v.patientId && v.userId) {
      await db.collection("visits").updateOne(
        { _id: v._id },
        { $set: { patientId: new mongoose.Types.ObjectId(v.userId) } }
      );
      fixedVisits++;
      console.log(` - Đã gán patientId cho lượt khám ${v._id} từ userId ${v.userId}`);
    }
  }
  console.log(`=> Đã hoàn tất sửa ${fixedVisits} lượt khám.`);

  console.log(">> 2. Chạy migrateLegacyEMR để bổ sung thời hạn lưu trữ bắt buộc (TT 46/2018/TT-BYT)...");
  const emrResult = await migrateLegacyEMR();
  console.log("=> Kết quả di chuyển EMR:", emrResult);

  console.log(">> Hoàn tất toàn bộ công tác kiểm toán và chuẩn hóa toàn vẹn dữ liệu.");
  process.exit(0);
};

run().catch((err) => {
  console.error("Lỗi trong quá trình dọn dẹp dữ liệu:", err);
  process.exit(1);
});
