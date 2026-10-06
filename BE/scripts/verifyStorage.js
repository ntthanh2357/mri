import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import StoredMedicalFile from "../src/models/storedMedicalFile.model.js";
import { readLocalBuffer, existsOnLocal } from "../src/services/storage/localAdapter.js";
import { computeSha256 } from "../src/utils/cryptoStorage.util.js";
import { getDriveClient } from "../src/services/storage/driveMirrorAdapter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function verifyStorage() {
  console.log("===============================================================================");
  console.log("🏥 KIỂM TRA TÍNH TOÀN VẸN HỆ THỐNG LƯU TRỮ HYBRID PACS (LOCAL + GOOGLE DRIVE)  ");
  console.log("===============================================================================\n");

  await connectDB();

  const files = await StoredMedicalFile.find({}).sort({ createdAt: -1 });
  console.log(`📊 Tìm thấy tổng cộng ${files.length} bản ghi tệp tin y tế trong cơ sở dữ liệu.\n`);

  if (files.length === 0) {
    console.log("ℹ️ Chưa có tệp tin nào được quản lý trong bảng StoredMedicalFile.");
    await mongoose.disconnect();
    process.exit(0);
  }

  let drive = null;
  try {
    drive = getDriveClient();
  } catch (driveInitErr) {
    console.warn("⚠️ Không thể khởi tạo kết nối Google Drive:", driveInitErr.message);
  }

  let localOk = 0;
  let localMissing = 0;
  let localHashMismatch = 0;

  let driveSynced = 0;
  let drivePending = 0;
  let driveFailed = 0;

  console.log("Đang quét và đối chiếu hash SHA-256 từng tệp tin...\n");

  for (const file of files) {
    // 1. Kiểm tra Local
    if (!existsOnLocal(file.localPath)) {
      localMissing++;
      console.error(`❌ [LOCAL MISSING] File: ${file.fileName} (ID: ${file.fileId}) không tồn tại tại: ${file.localPath}`);
    } else {
      try {
        const buf = await readLocalBuffer(file.localPath);
        const currentSha = computeSha256(buf);
        if (currentSha === file.sha256) {
          localOk++;
        } else {
          localHashMismatch++;
          console.error(`❌ [HASH MISMATCH] File: ${file.fileName} bị sai lệch dữ liệu! DB: ${file.sha256} vs Đĩa: ${currentSha}`);
        }
      } catch (e) {
        localMissing++;
      }
    }

    // 2. Kiểm tra trạng thái Drive
    if (file.syncStatus === "SYNCED" && file.driveFileId) {
      driveSynced++;
    } else if (file.syncStatus === "PENDING") {
      drivePending++;
    } else {
      driveFailed++;
    }
  }

  console.log("\n===============================================================================");
  console.log("📋 BẢNG BÁO CÁO NGHIỆM THU TÍNH TOÀN VẸN DỮ LIỆU LƯU TRỮ");
  console.log("===============================================================================");
  console.log(`• Tổng số tệp tin y tế quản lý   : ${files.length}`);
  console.log(`• Bản chính Local toàn vẹn 100% : ${localOk} / ${files.length} (${Math.round((localOk / files.length) * 100)}%)`);
  console.log(`• Bản chính Local bị thiếu      : ${localMissing}`);
  console.log(`• Bản chính Local lệch mã băm   : ${localHashMismatch}`);
  console.log(`-------------------------------------------------------------------------------`);
  console.log(`• Bản sao Google Drive đã SYNC   : ${driveSynced} (${Math.round((driveSynced / files.length) * 100)}%)`);
  console.log(`• Bản sao Google Drive PENDING   : ${drivePending}`);
  console.log(`• Bản sao Google Drive FAILED    : ${driveFailed}`);
  console.log("===============================================================================");

  const isHealthy = localMissing === 0 && localHashMismatch === 0;
  if (isHealthy) {
    console.log("🎉 KẾT LUẬN: HỆ THỐNG LƯU TRỮ ĐẠT CHUẨN TOÀN VẸN 100%!");
  } else {
    console.warn("⚠️ CẢNH BÁO: Phát hiện tệp tin bị thiếu hoặc sai lệch hash, vui lòng chạy tiến trình phục hồi!");
  }

  await mongoose.disconnect();
  process.exit(isHealthy ? 0 : 1);
}

verifyStorage().catch((err) => {
  console.error("Lỗi script verifyStorage:", err);
  process.exit(1);
});
