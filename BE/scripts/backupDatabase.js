import "dotenv/config";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import { encryptBuffer } from "../src/utils/cryptoStorage.util.js";
import { uploadEncryptedFile } from "../src/services/storage/driveMirrorAdapter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function backupDatabase() {
  console.log("===============================================================================");
  console.log("📦 BẮT ĐẦU TIẾN TRÌNH SAO LƯU VÀ MÃ HÓA CƠ SỞ DỮ LIỆU BỆNH VIỆN               ");
  console.log("===============================================================================\n");

  await connectDB();

  const backupDir = process.env.STORAGE_BACKUP_DIR
    ? path.resolve(process.env.STORAGE_BACKUP_DIR)
    : path.resolve(__dirname, "../../../../neuroscan_backup");

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = (now.getMonth() + 1).toString().padStart(2, "0");

  console.log(`1. Đang trích xuất dữ liệu các bảng từ MongoDB Atlas...`);
  const collections = await mongoose.connection.db.listCollections().toArray();
  const dumpData = {};

  for (const col of collections) {
    const colName = col.name;
    const docs = await mongoose.connection.db.collection(colName).find({}).toArray();
    dumpData[colName] = docs;
    console.log(`   - Bảng [${colName}]: ${docs.length} bản ghi`);
  }

  const jsonString = JSON.stringify(dumpData, null, 2);
  const rawBuffer = Buffer.from(jsonString, "utf-8");
  console.log(`\n2. Kích thước dữ liệu trích xuất: ${(rawBuffer.length / 1024).toFixed(2)} KB`);

  console.log(`3. Đang mã hóa dữ liệu bằng chuẩn quân sự AES-256-GCM...`);
  const { encryptedBuffer, ivHex, authTagHex } = encryptBuffer(rawBuffer);

  // Đóng gói metadata giải mã kèm theo file sao lưu
  const backupPayload = {
    version: "1.0",
    createdAt: new Date().toISOString(),
    ivHex,
    authTagHex,
    sizeOriginal: rawBuffer.length,
    sizeEncrypted: encryptedBuffer.length,
    data: encryptedBuffer.toString("base64"),
  };

  const backupFileName = `db_backup_${timestamp}.enc.json`;
  const localBackupPath = path.join(backupDir, backupFileName);
  await fs.promises.writeFile(localBackupPath, JSON.stringify(backupPayload, null, 2));

  console.log(`✅ Đã lưu bản sao lưu mã hóa cục bộ tại: ${localBackupPath}`);

  // 4. Đẩy 1 bản sao ngoại tuyến lên Google Drive
  console.log(`\n4. Đang đẩy bản sao lưu mã hóa lên Google Drive thư mục backups/${yyyy}/${mm}...`);
  try {
    const driveRelativeDir = `backups/${yyyy}/${mm}`;
    const driveResult = await uploadEncryptedFile(
      Buffer.from(JSON.stringify(backupPayload)),
      driveRelativeDir,
      backupFileName,
      "application/json"
    );
    console.log(`✅ Đã sao lưu ngoại tuyến thành công lên Google Drive (ID: ${driveResult.driveFileId})`);
  } catch (driveErr) {
    console.warn(`⚠️ Đẩy bản sao lưu lên Drive thất bại (Bản local vẫn an toàn 100%):`, driveErr.message);
  }

  console.log("\n===============================================================================");
  console.log("🎉 TIẾN TRÌNH SAO LƯU CƠ SỞ DỮ LIỆU ĐÃ HOÀN TẤT THÀNH CÔNG!                     ");
  console.log("===============================================================================");

  await mongoose.disconnect();
  process.exit(0);
}

backupDatabase().catch((err) => {
  console.error("Lỗi khi sao lưu CSDL:", err);
  process.exit(1);
});
