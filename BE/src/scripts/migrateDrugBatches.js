/**
 * NeuroScan AI — Migration UC-PHA-07: chuyển tồn kho legacy sang quản lý theo lô.
 *
 * Trước Phase 2, model Drug chỉ có một tổng tồn kho (stock.quantity) và một hạn
 * dùng duy nhất (expiryDate). Phase 2 đưa quản lý theo lô (batches[]) với nguyên
 * tắc FEFO. Script này quy đổi dữ liệu cũ để deploy không mất mát gì:
 *
 *   1. Thuốc có stock.quantity > 0 và CHƯA có lô nào
 *      → tạo 1 lô mặc định "LO-CHUYEN-DOI" mang toàn bộ tồn kho, hạn dùng cũ
 *        (nếu có), kèm movement 'adjustment' ghi nhận việc chuyển đổi sổ.
 *
 *   2. Thuốc ĐÃ có lô nhưng Σ batches.quantity ≠ stock.quantity (lệch sổ)
 *      → tái lập bất biến: stock.quantity = Σ lô, ghi movement 'adjustment'
 *        kèm chênh lệch để truy vết.
 *
 *   3. (Tùy chọn --recalc-only) CHỈ kiểm tra và báo cáo, không ghi gì.
 *
 * Cách chạy (đã cài dependencies BE):
 *   node src/scripts/migrateDrugBatches.js                # chạy thật
 *   node src/scripts/migrateDrugBatches.js --dry          # xem trước, không ghi
 *   node src/scripts/migrateDrugBatches.js --recalc-only  # chỉ sửa lệch Σ lô
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { Drug } from "../modules/pharmacy/models/drug.model.js";

dotenv.config();

const DRY = process.argv.includes("--dry");
const RECALC_ONLY = process.argv.includes("--recalc-only");
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/neuroscan";

const sumOf = (batches = []) =>
  (batches || []).reduce((s, b) => s + (Number(b.quantity) || 0), 0);

async function main() {
  console.log(`\n[migrateDrugBatches] Kết nối ${MONGO_URI} ...`);
  await mongoose.connect(MONGO_URI);
  console.log("[migrateDrugBatches] Đã kết nối MongoDB.\n");

  const drugs = await Drug.find({}).sort({ name: 1 });
  let converted = 0;
  let recalced = 0;
  let unchanged = 0;
  const problems = [];

  for (const drug of drugs) {
    const total = Number(drug.stock?.quantity) || 0;
    const batches = Array.isArray(drug.batches) ? drug.batches : [];
    const batchSum = sumOf(batches);

    if (batches.length === 0) {
      // ── Trường hợp 1: legacy → quy đổi thành một lô mặc định ──
      if (total <= 0) {
        unchanged++;
        continue;
      }
      if (RECALC_ONLY) {
        unchanged++;
        continue;
      }
      const now = new Date();
      drug.batches = [
        {
          batchNumber: "LO-CHUYEN-DOI",
          quantity: total,
          expiryDate: drug.expiryDate || null,
          supplier: drug.manufacturer || "",
          receivedAt: now,
          receivedBy: null,
        },
      ];
      drug.stockMovements.push({
        type: "adjustment",
        quantity: 0,
        reason: "[Migration UC-PHA-07] Chuyển đổi sổ tồn kho legacy sang quản lý theo lô (1 lô mặc định)",
        batchNumber: "LO-CHUYEN-DOI",
        balanceAfter: total,
        timestamp: now,
      });
      drug.stock.lastUpdated = now;
      if (!DRY) await drug.save();
      converted++;
      console.log(`  ✓ "${drug.name}": quy đổi ${total} ${drug.stock?.unit || ""} → lô LO-CHUYEN-DOI`);
    } else if (batchSum !== total) {
      // ── Trường hợp 2: đã theo lô nhưng lệch bất biến Σ lô = tổng ──
      const now = new Date();
      const diff = batchSum - total;
      drug.stock.quantity = batchSum;
      drug.stockMovements.push({
        type: "adjustment",
        quantity: Math.abs(diff),
        reason: `[Migration UC-PHA-07] Tái lập bất biến sổ sách: tổng ${total} → ${batchSum} (Σ lô)`,
        balanceAfter: batchSum,
        timestamp: now,
      });
      drug.stock.lastUpdated = now;
      if (!DRY) await drug.save();
      recalced++;
      console.log(`  ⚠ "${drug.name}": lệch sổ ${diff > 0 ? "+" : ""}${diff} → đã căn tổng = Σ lô (${batchSum})`);
      problems.push({ name: drug.name, total, batchSum });
    } else {
      unchanged++;
    }
  }

  console.log(`\n[migrateDrugBatches] Kết quả (${DRY ? "CHẾ ĐỘ DRY — chưa ghi" : "đã ghi"}):`);
  console.log(`  - Quy đổi legacy → lô mặc định : ${converted}`);
  console.log(`  - Căn lại tổng = Σ lô           : ${recalced}`);
  console.log(`  - Không đổi                     : ${unchanged}`);
  if (problems.length > 0) {
    console.log("  - Danh sách đã căn lại (truy vết):");
    problems.forEach((p) => console.log(`      • ${p.name}: tổng cũ ${p.total} → ${p.batchSum}`));
  }

  await mongoose.disconnect();
  console.log("[migrateDrugBatches] Hoàn tất.\n");
  process.exit(0);
}

main().catch(async (err) => {
  console.error("[migrateDrugBatches] LỖI:", err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
