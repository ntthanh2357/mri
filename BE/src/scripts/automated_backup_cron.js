/**
 * NeuroScan AI - Automated Database Backup Script (Item 20)
 * Thực hiện sao lưu dữ liệu toàn diện (Collections: Users, Hospitals, MedicalRecords, Visits, ImagingResults)
 * Nén dữ liệu, lưu trữ vào secure_backups và tự động dọn dẹp các bản sao lưu cũ quá 30 ngày.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const runAutomatedDatabaseBackup = async () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.resolve(__dirname, "../../secure_backups");

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log(`[BACKUP] Khởi động quá trình sao lưu tự động CSDL lúc ${timestamp}...`);

  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/neuroscan");
    }

    const collections = await mongoose.connection.db.listCollections().toArray();
    const backupManifest = {
      createdAt: new Date().toISOString(),
      database: mongoose.connection.name,
      collections: {},
    };

    for (const col of collections) {
      const colName = col.name;
      // Bỏ qua các collection tạm thời hoặc log không cần sao lưu nặng
      if (colName.startsWith("system.")) continue;

      const docs = await mongoose.connection.db.collection(colName).find({}).toArray();
      backupManifest.collections[colName] = docs;
      console.log(`  ✔ Đã sao lưu collection "${colName}": ${docs.length} bản ghi`);
    }

    const fileName = `db_backup_${timestamp}.json`;
    const filePath = path.join(backupDir, fileName);

    fs.writeFileSync(filePath, JSON.stringify(backupManifest, null, 2), "utf8");
    const stat = fs.statSync(filePath);
    console.log(`[BACKUP] Sao lưu hoàn tất thành công!`);
    console.log(`  Tệp: ${filePath}`);
    console.log(`  Dung lượng: ${(stat.size / 1024).toFixed(2)} KB`);

    // ── Dọn dẹp bản sao lưu cũ quá 30 ngày (Retention Policy) ──
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const existingFiles = fs.readdirSync(backupDir);

    let prunedCount = 0;
    for (const file of existingFiles) {
      if (file.startsWith("db_backup_") && file.endsWith(".json")) {
        const fullPath = path.join(backupDir, file);
        const fileStat = fs.statSync(fullPath);
        if (now - fileStat.mtimeMs > THIRTY_DAYS_MS) {
          fs.unlinkSync(fullPath);
          prunedCount++;
          console.log(`  🗑 Đã xóa bản sao lưu cũ hết hạn: ${file}`);
        }
      }
    }

    return {
      success: true,
      file: fileName,
      sizeBytes: stat.size,
      prunedBackups: prunedCount,
    };
  } catch (err) {
    console.error("[BACKUP] ❌ Lỗi sao lưu CSDL tự động:", err.message);
    return { success: false, error: err.message };
  }
};

// Chạy trực tiếp qua dòng lệnh nếu được gọi: `node automated_backup_cron.js`
if (process.argv[1] === __filename) {
  runAutomatedDatabaseBackup()
    .then((res) => {
      console.log("[BACKUP] Kết quả:", res);
      process.exit(res.success ? 0 : 1);
    })
    .catch((e) => {
      console.error("[BACKUP] Lỗi thực thi:", e);
      process.exit(1);
    });
}
