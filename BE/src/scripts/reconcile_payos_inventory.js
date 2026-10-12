import mongoose from "mongoose";
import dotenv from "dotenv";
import { Invoice } from "../modules/billing/models/invoice.model.js";
import { Drug } from "../modules/pharmacy/models/drug.model.js";
import { acquireDistributedLock, releaseDistributedLock } from "../models/systemLock.model.js";
import payos from "../utils/payos.js";
import { deductStockForInvoice } from "../modules/billing/invoice.controller.js";
import { tenantStorage } from "../middlewares/tenant.middleware.js";

dotenv.config();

/**
 * Script Đối soát và Lưới An toàn Tồn kho PayOS (VietQR) & Xử lý Hóa đơn Kẹt (Distributed Safe)
 * Chức năng:
 * 1. Khóa phân tán (Distributed Lock) trên MongoDB chống xung đột khi chạy trên nhiều instance/pod.
 * 2. Giai đoạn 1: Quét hóa đơn đã thanh toán nhưng chưa trừ tồn kho, đối chiếu với sổ biến động (stockMovements).
 * 3. Giai đoạn 2: Lưới an toàn giải cứu hóa đơn kẹt 'đang xử lý' (>10 phút) thông qua việc xác thực trạng thái thực tế từ PayOS API.
 * 4. Chế độ --fix: Tự động xử lý dứt điểm và ghi nhận biến động kho chuẩn xác kèm balanceAfter.
 */
export async function reconcilePayOSInventory({ dryRun = true } = {}) {
  const LOCK_KEY = "cron_reconcile_payos_inventory";
  const lock = await acquireDistributedLock(LOCK_KEY, { ttlSeconds: 300 });

  if (!lock.acquired) {
    console.warn(`[DistributedLock] Tác vụ đối soát đang được thực thi bởi một instance khác (${lock.reason || lock.error}). Bỏ qua lượt chạy này.`);
    return { skipped: true, reason: lock.reason };
  }

  console.log(`\n======================================================================`);
  console.log(`🔍 BẮT ĐẦU ĐỐI SOÁT PAYOS & GIẢI CỨU HÓA ĐƠN KẸT (Distributed Lock: OK)`);
  console.log(`   Chế độ: ${dryRun ? "DRY-RUN / CHỈ ĐỌC" : "FIX / THỰC THI ĐIỀU CHỈNH"}`);
  console.log(`======================================================================\n`);

  try {
    // ── GIAI ĐOẠN 1: ĐỐI SOÁT HÓA ĐƠN ĐÃ THANH TOÁN THIẾU TRỪ KHO ────────
    console.log("--- GIAI ĐOẠN 1: RÀ SOÁT TỒN KHO HÓA ĐƠN 'ĐÃ THANH TOÁN' ---");
    const payosInvoices = await Invoice.find({
      $or: [{ orderCode: { $ne: null } }, { paymentMethod: "vietqr" }],
      status: "đã thanh toán"
    }).setOptions({ bypassTenancy: true }).lean();

    console.log(`📋 Tìm thấy ${payosInvoices.length} hóa đơn PayOS đã thanh toán.`);

    let totalDiscrepancies = 0;
    let missingItemsCount = 0;
    const discrepancyDetails = [];

    for (const inv of payosInvoices) {
      const drugItems = (inv.items || []).filter(it => it.type === "drug" && it.quantity > 0);
      if (drugItems.length === 0) continue;

      if (inv.stockDeductionStatus === "DEDUCTED") continue;

      for (const item of drugItems) {
        let drug = null;
        if (item.drugId) {
          drug = await Drug.findById(item.drugId);
        } else {
          drug = await Drug.findOne({
            hospitalId: inv.hospitalId,
            name: new RegExp(`^${(item.drugName || item.description || "").replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i")
          });
        }

        if (!drug) {
          discrepancyDetails.push({
            invoiceId: inv._id,
            orderCode: inv.orderCode,
            drugName: item.drugName || item.description,
            quantity: item.quantity,
            status: "NOT_FOUND_IN_DB"
          });
          totalDiscrepancies++;
          continue;
        }

        const hasMovement = (drug.stockMovements || []).some(m => 
          m.invoiceId && m.invoiceId.toString() === inv._id.toString() && ["dispense", "export"].includes(m.type)
        );

        if (!hasMovement) {
          totalDiscrepancies++;
          missingItemsCount += item.quantity;
          const canDeductSafely = drug.stock.quantity >= item.quantity;
          discrepancyDetails.push({
            invoiceId: inv._id,
            orderCode: inv.orderCode,
            drugId: drug._id,
            drugName: drug.name,
            currentStock: drug.stock.quantity,
            quantityMissingDeduction: item.quantity,
            status: canDeductSafely ? "MISSING_DEDUCTION" : "SHORTAGE_RISK_MANUAL_AUDIT_REQUIRED"
          });

          if (!dryRun) {
            if (!canDeductSafely) {
              console.error(`   ⚠️ CẢNH BÁO TỒN KHO: "${drug.name}" hiện chỉ còn ${drug.stock.quantity} (cần trừ bù ${item.quantity}). Bỏ qua tự động để tránh âm kho. Cần dược sĩ kiểm kê đối soát tay!`);
              continue;
            }

            const updated = await Drug.findOneAndUpdate(
              { _id: drug._id, "stock.quantity": { $gte: item.quantity } },
              {
                $inc: { "stock.quantity": -item.quantity },
                $set: { "stock.lastUpdated": new Date() },
                $push: {
                  stockMovements: {
                    type: "export",
                    quantity: item.quantity,
                    balanceAfter: drug.stock.quantity - item.quantity,
                    invoiceId: inv._id,
                    reason: `[Đối soát PayOS] Trừ bù tồn kho lịch sử cho hóa đơn ${inv._id} (Mã GD: ${inv.orderCode})`,
                    timestamp: new Date()
                  }
                }
              },
              { new: true }
            );

            if (updated) {
              await Invoice.findByIdAndUpdate(inv._id, {
                $set: {
                  stockDeductionStatus: "DEDUCTED",
                  paymentNotes: (inv.paymentNotes || "") + " | [Reconciled] Đã trừ bù tồn kho lịch sử."
                }
              });
              console.log(`   ✅ Đã trừ bù ${item.quantity} ${drug.stock.unit} "${drug.name}". Tồn kho mới: ${updated.stock.quantity}`);
            }
          }
        }
      }
    }

    // ── GIAI ĐOẠN 2: LƯỚI AN TOÀN GIẢI CỨU HÓA ĐƠN KẸT 'ĐANG XỬ LÝ' ───────
    console.log("\n--- GIAI ĐOẠN 2: LƯỚI AN TOÀN GIẢI CỨU HÓA ĐƠN KẸT 'ĐANG XỬ LÝ' ---");
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const stuckInvoices = await Invoice.find({
      status: "đang xử lý",
      updatedAt: { $lt: tenMinutesAgo }
    }).setOptions({ bypassTenancy: true });

    console.log(`📋 Tìm thấy ${stuckInvoices.length} hóa đơn đang kẹt trạng thái 'đang xử lý' (>10 phút).`);
    const stuckResolved = [];

    for (const stuck of stuckInvoices) {
      if (!stuck.orderCode) {
        console.warn(`   ⚠️ Hóa đơn ${stuck._id} không có orderCode PayOS, bỏ qua kiểm tra API.`);
        continue;
      }

      let payosPayment = null;
      try {
        if (payos.paymentRequests && typeof payos.paymentRequests.get === "function") {
          payosPayment = await payos.paymentRequests.get(stuck.orderCode);
        }
      } catch (payosApiErr) {
        console.warn(`   ⚠️ Không thể truy vấn PayOS API cho mã ${stuck.orderCode}: ${payosApiErr.message}`);
      }

      const payosStatus = payosPayment?.status || "UNKNOWN";
      console.log(`   🔍 Hóa đơn ${stuck._id} (Mã GD: ${stuck.orderCode}) -> Trạng thái PayOS: ${payosStatus}`);

      if (!dryRun) {
        const hospitalIdStr = stuck.hospitalId ? stuck.hospitalId.toString() : null;

        if (payosStatus === "PAID") {
          // Bệnh nhân thực tế đã trả tiền
          if (stuck.stockDeductionStatus === "SHORTAGE_FLAGGED") {
            console.log(`   ℹ️ Hóa đơn ${stuck._id} bị thiếu kho (SHORTAGE_FLAGGED). Giữ nguyên 'đang xử lý' cho Dược sĩ giải quyết.`);
          } else {
            // Thử trừ kho và hoàn tất
            await tenantStorage.run({ hospitalId: hospitalIdStr, bypassTenancy: !hospitalIdStr }, async () => {
              const stockRes = await deductStockForInvoice({
                invoice: stuck,
                performedBy: null,
                reason: `[Cron Giải Cứu] Tự động hoàn tất thanh toán từ đối soát PayOS API`
              });

              if (stockRes.success) {
                stuck.status = "đã thanh toán";
                stuck.stockDeductionStatus = "DEDUCTED";
                stuck.paymentNotes = (stuck.paymentNotes || "") + " | [Cron PayOS API] Xác nhận PAID và đã trừ kho an toàn.";
                await stuck.save();
                stuckResolved.push({ invoiceId: stuck._id, orderCode: stuck.orderCode, action: "SETTLED_PAID" });
                console.log(`   ✅ Đã giải cứu hóa đơn ${stuck._id} sang 'đã thanh toán'.`);
              } else {
                stuck.stockDeductionStatus = "SHORTAGE_FLAGGED";
                stuck.paymentNotes = (stuck.paymentNotes || "") + ` | [Cron PayOS API] Xác nhận PAID nhưng thiếu kho: ${stockRes.error}`;
                await stuck.save();
                stuckResolved.push({ invoiceId: stuck._id, orderCode: stuck.orderCode, action: "FLAGGED_SHORTAGE" });
              }
            });
          }
        } else if (["CANCELLED", "EXPIRED"].includes(payosStatus)) {
          // Giao dịch đã hủy hoặc hết hạn trên PayOS
          stuck.status = "đã hủy";
          stuck.paymentNotes = (stuck.paymentNotes || "") + ` | [Cron PayOS API] Giao dịch PayOS đã kết thúc với trạng thái: ${payosStatus}.`;
          await stuck.save();
          stuckResolved.push({ invoiceId: stuck._id, orderCode: stuck.orderCode, action: "CANCELLED" });
          console.log(`   🛑 Đã chuyển hóa đơn ${stuck._id} sang 'đã hủy' do PayOS hủy/hết hạn.`);
        } else if (payosStatus === "PENDING" || payosStatus === "UNKNOWN") {
          // Kẹt quá 30 phút mà chưa thanh toán: Khôi phục về 'chờ thanh toán' để bệnh nhân thanh toán lại
          const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
          if (new Date(stuck.updatedAt) < thirtyMinutesAgo) {
            stuck.status = "chờ thanh toán";
            stuck.paymentNotes = (stuck.paymentNotes || "") + ` | [Cron Lưới An Toàn] Quá 30 phút chưa thanh toán thành công, tự động khôi phục về chờ thanh toán.`;
            await stuck.save();
            stuckResolved.push({ invoiceId: stuck._id, orderCode: stuck.orderCode, action: "REVERTED_PENDING" });
            console.log(`   🔄 Đã khôi phục hóa đơn ${stuck._id} về 'chờ thanh toán'.`);
          }
        }
      }
    }

    console.log("\n======================================================================");
    console.log("📊 KẾT QUẢ ĐỐI SOÁT & GIẢI CỨU TỒN KHO:");
    console.log(`   - Tổng số dòng thuốc chưa trừ kho (Giai đoạn 1): ${totalDiscrepancies}`);
    console.log(`   - Tổng số đơn vị thuốc thiếu hụt sổ sách: ${missingItemsCount}`);
    console.log(`   - Tổng số hóa đơn kẹt 'đang xử lý' được xử lý (Giai đoạn 2): ${stuckResolved.length}`);
    if (discrepancyDetails.length > 0) console.table(discrepancyDetails);
    if (stuckResolved.length > 0) console.table(stuckResolved);
    console.log("======================================================================\n");

    return { 
      totalInvoices: payosInvoices.length, 
      totalDiscrepancies, 
      missingItemsCount, 
      stuckCount: stuckInvoices.length,
      stuckResolved,
      details: discrepancyDetails 
    };
  } finally {
    await releaseDistributedLock(LOCK_KEY, lock.holder);
    console.log(`[DistributedLock] Đã giải phóng khóa phân tán '${LOCK_KEY}'.`);
  }
}

// Chạy trực tiếp qua CLI
if (process.argv[1]?.endsWith("reconcile_payos_inventory.js")) {
  const isFix = process.argv.includes("--fix");
  const mongoUri = process.env.TEST_MONGO_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/mri_hospital";

  mongoose.connect(mongoUri)
    .then(async () => {
      await reconcilePayOSInventory({ dryRun: !isFix });
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(err => {
      console.error("Lỗi kết nối CSDL:", err.message);
      process.exit(1);
    });
}
