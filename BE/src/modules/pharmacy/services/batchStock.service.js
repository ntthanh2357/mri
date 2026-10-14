import { Drug } from "../models/drug.model.js";

// ─────────────────────────────────────────────────────────────────────────────
// DỊCH VỤ TỒN KHO THEO LÔ (UC-PHA-07) — nguyên tắc FEFO
// First-Expired-First-Out: lô hết hạn sớm nhất được xuất trước.
//
// Bất biến sổ sách (invariant) bắt buộc với thuốc đã theo lô:
//   stock.quantity === Σ batches[].quantity
// Mọi biến động kho PHẢI đi qua service này để hai sổ không lệch nhau.
//
// Lô ĐÃ hết hạn là "dead stock": bị loại khỏi mọi phép xuất (FEFO bỏ qua),
// chờ thủ tục kiểm định / tiêu hủy — tuyệt đối không cấp phát cho người bệnh.
//
// Tính an toàn đồng thời: updateOne có điều kiện canh (guard) trên
// stock.quantity vừa đọc + vòng thử lại → hai lệnh xuất đụng độ thì bên thua
// đọc lại và tính phân bổ FEFO mới (optimistic concurrency, không cần transaction).
// ─────────────────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 4;

function isExpired(batch, now = new Date()) {
  return Boolean(batch?.expiryDate) && new Date(batch.expiryDate).getTime() <= now.getTime();
}

function toPlainBatches(drug) {
  const raw = Array.isArray(drug?.batches) ? drug.batches : [];
  return raw.map((b) => (b && typeof b.toObject === "function" ? b.toObject() : { ...b }));
}

export function sumBatches(batches = []) {
  return (batches || []).reduce((s, b) => s + (Number(b.quantity) || 0), 0);
}

// Sắp xếp lô theo FEFO: hạn sớm trước; lô không ghi hạn dùng xếp cuối
// (coi như an toàn hạn dài); cùng hạn thì lô nhập trước xuất trước (FIFO).
export function sortBatchesFEFO(batches = []) {
  return [...(batches || [])].sort((a, b) => {
    const ea = a?.expiryDate ? new Date(a.expiryDate).getTime() : Number.POSITIVE_INFINITY;
    const eb = b?.expiryDate ? new Date(b.expiryDate).getTime() : Number.POSITIVE_INFINITY;
    if (ea !== eb) return ea - eb;
    return new Date(a?.receivedAt || 0).getTime() - new Date(b?.receivedAt || 0).getTime();
  });
}

// Phân bổ số lượng cần xuất vào các lô theo FEFO (bỏ qua lô hết hạn).
// Trả về breakdown (lô nào xuất bao nhiêu), shortage (thiếu bao nhiêu do
// không đủ tồn usable) và expiredQty (số lượng kẹt trong lô đã hết hạn).
export function planFEFO(batches = [], qty, now = new Date()) {
  const ordered = sortBatchesFEFO(batches);
  const breakdown = [];
  let remaining = Number(qty) || 0;
  let expiredQty = 0;

  for (const b of ordered) {
    const available = Number(b.quantity) || 0;
    if (available <= 0) continue;
    if (isExpired(b, now)) {
      expiredQty += available; // dead stock — không được xuất
      continue;
    }
    if (remaining <= 0) continue;
    const take = Math.min(remaining, available);
    breakdown.push({
      batchNumber: b.batchNumber || null,
      quantity: take,
      expiryDate: b.expiryDate || null,
    });
    remaining -= take;
  }

  return { breakdown, shortage: Math.max(0, remaining), expiredQty };
}

// ─────────────────────────────────────────────────────────────────────────────
// XUẤT KHO THEO FEFO
// Trả về:
//   { ok, breakdown:[{batchNumber,quantity,expiryDate}], dispensed, shortage,
//     expiredQty, balanceAfter, legacy }
//   { ok:false, code:'DRUG_NOT_FOUND'|'STOCK_SHORTAGE', error, ... }
// allowShortage = true (nhánh cấp cứu): xuất hết số usable đang có thay vì từ chối.
// ─────────────────────────────────────────────────────────────────────────────
export async function deductDrugStockFEFO({
  drugId = null,
  drugDoc = null,
  qty,
  performedBy = null,
  reason = "",
  type = "dispense",
  invoiceId = null,
  visitId = null,
  allowShortage = false,
  session = null,
  now = new Date(),
}) {
  const wanted = Number(qty) || 0;
  if (wanted <= 0) {
    return { ok: true, breakdown: [], dispensed: 0, shortage: 0, expiredQty: 0, balanceAfter: null, legacy: false };
  }

  const sessOpts = session ? { session } : {};
  let lastError = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const drug = attempt === 0 && drugDoc ? drugDoc : await Drug.findById(drugId || drugDoc?._id).session(session || null);
    if (!drug) {
      return { ok: false, code: "DRUG_NOT_FOUND", error: "Không tìm thấy thuốc trong danh mục kho." };
    }

    const total = Number(drug.stock?.quantity) || 0;
    const batches = toPlainBatches(drug);
    const hasBatches = batches.length > 0;

    // Thuốc CHƯA theo lô (legacy): coi tổng kho là một "lô ẩn" (batchNumber null)
    // — giữ nguyên lối trừ tổng truyền thống, movement ghi batchNumber null.
    // Thuốc ĐÃ theo lô: phân bổ FEFO, bỏ qua lô hết hạn (dead stock).
    let breakdown, shortage, expiredQty;
    if (hasBatches) {
      ({ breakdown, shortage, expiredQty } = planFEFO(batches, wanted, now));
    } else {
      breakdown = total >= wanted ? [{ batchNumber: null, quantity: wanted, expiryDate: null }] : [];
      shortage = total >= wanted ? 0 : wanted - total;
      expiredQty = 0;
    }

    if (shortage > 0 && !allowShortage) {
      return {
        ok: false,
        code: "STOCK_SHORTAGE",
        error: `Thuốc '${drug.name}' thiếu tồn kho đủ điều kiện xuất (Cần: ${wanted}, Có thể xuất: ${wanted - shortage}${
          expiredQty > 0 ? ` — đang kẹt ${expiredQty} trong lô đã hết hạn` : ""
        }).`,
        shortage,
        expiredQty,
        available: wanted - shortage,
      };
    }

    const dispensed = wanted - shortage;
    if (dispensed <= 0) {
      // Cấp cứu nhưng kho usable rỗng: không xuất được viên nào — trả về để caller bắn cảnh báo kiểm kê.
      return { ok: true, breakdown: [], dispensed: 0, shortage, expiredQty, balanceAfter: total, legacy: !hasBatches };
    }

    const newTotal = total - dispensed;

    // Nhật ký biến động: 1 movement cho mỗi lô bị chạm, kèm running balance.
    let running = total;
    const movements = breakdown.map((bk) => {
      running -= bk.quantity;
      return {
        type,
        quantity: bk.quantity,
        invoiceId: invoiceId || null,
        visitId: visitId || null,
        performedBy: performedBy || null,
        reason: reason || "Xuất kho theo lô (FEFO)",
        batchNumber: bk.batchNumber,
        balanceAfter: running,
        timestamp: now,
      };
    });

    const update = hasBatches
      ? {
          $set: {
            batches: batches.map((b) => {
              const hit = breakdown.find((x) => (x.batchNumber || null) === (b.batchNumber || null));
              return hit ? { ...b, quantity: (Number(b.quantity) || 0) - hit.quantity } : b;
            }),
            "stock.quantity": newTotal,
            "stock.lastUpdated": now,
          },
        }
      : {
          // Thuốc chưa chuyển sang chế độ theo lô: giữ nguyên lối $inc truyền thống
          $set: { "stock.quantity": newTotal, "stock.lastUpdated": now },
        };
    update.$push = { stockMovements: { $each: movements } };

    const filter = { _id: drug._id, "stock.quantity": total };
    const res = await Drug.updateOne(filter, update, sessOpts);
    if (res.modifiedCount === 1) {
      return { ok: true, breakdown, dispensed, shortage, expiredQty, balanceAfter: newTotal, legacy: !hasBatches };
    }
    // modifiedCount = 0 → có giao dịch khác đổi kho giữa lúc đọc và ghi → đọc lại, tính lại FEFO
    lastError = new Error(`Xung đột đồng thời khi trừ kho thuốc ${drug._id} (lần ${attempt + 1})`);
  }

  return { ok: false, code: "CONCURRENT_CONFLICT", error: lastError?.message || "Xung đột trừ kho, vui lòng thử lại." };
}

// ─────────────────────────────────────────────────────────────────────────────
// HOÀN TRẢ KHO THEO LÔ (UC-PHA-06 — hoàn vị khi hủy/hồàn tiền trước khi phát)
// breakdown = [{batchNumber, quantity}] ghi tại thời điểm xuất → hoàn về ĐÚNG lô cũ
// (giữ nguyên hạn dùng; lô đã hết hạn trong lúc chờ vẫn nhận hoàn — thuốc chưa
// rời kệ nên thuộc về lô của nó). Không có breakdown → đổ vào lô hạn sớm nhất.
// Thuốc chưa theo lô → $inc tổng truyền thống.
// ─────────────────────────────────────────────────────────────────────────────
export async function restockDrugBatch({
  drugId,
  qty,
  breakdown = null,
  performedBy = null,
  reason = "",
  type = "cancel_restock",
  invoiceId = null,
  session = null,
  now = new Date(),
}) {
  const amount = Number(qty) || 0;
  if (amount <= 0) return { ok: true, added: 0, balanceAfter: null };

  const sessOpts = session ? { session } : {};
  let lastError = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const drug = await Drug.findById(drugId).session(session || null);
    if (!drug) return { ok: false, code: "DRUG_NOT_FOUND", error: "Không tìm thấy thuốc trong danh mục kho." };

    const total = Number(drug.stock?.quantity) || 0;
    const batches = toPlainBatches(drug);
    const hasBatches = batches.length > 0;

    // Tính các khoản cộng theo lô — CHỈ áp dụng cho thuốc đã theo lô.
    // Thuốc legacy luôn $inc tổng truyền thống (bất biến hai sổ không áp dụng).
    const adds = [];
    if (hasBatches) {
      if (Array.isArray(breakdown) && breakdown.length > 0) {
        for (const bk of breakdown) {
          const q = Number(bk.quantity) || 0;
          if (q > 0) adds.push({ batchNumber: bk.batchNumber || null, quantity: q });
        }
      } else {
        // Không rõ lô gốc → đổ vào lô sắp hết hạn sớm nhất (đúng thứ tự FEFO lần sau)
        const sorted = sortBatchesFEFO(batches.filter((b) => (Number(b.quantity) || 0) > 0));
        const target = sorted[0] || sortBatchesFEFO(batches)[0];
        adds.push({ batchNumber: target?.batchNumber || null, quantity: amount });
      }
    }

    const newTotal = total + amount;
    let update;
    let movements = [];

    if (!hasBatches && adds.length === 0) {
      // Legacy: thuốc chưa theo lô
      update = { $set: { "stock.quantity": newTotal, "stock.lastUpdated": now } };
      movements = [
        {
          type,
          quantity: amount,
          invoiceId: invoiceId || null,
          performedBy: performedBy || null,
          reason: reason || "Hoàn vị kho",
          batchNumber: null,
          balanceAfter: newTotal,
          timestamp: now,
        },
      ];
    } else {
      // Áp dụng các khoản cộng vào mảng lô; lô chưa tồn tại thì tái tạo (expiry null)
      const nextBatches = batches.map((b) => ({ ...b }));
      for (const add of adds) {
        let target = add.batchNumber === null
          ? nextBatches.find((b) => !b.batchNumber)
          : nextBatches.find((b) => b.batchNumber === add.batchNumber);
        if (!target) {
          target = {
            batchNumber: add.batchNumber || null,
            quantity: 0,
            expiryDate: null,
            supplier: "",
            receivedAt: now,
            receivedBy: performedBy || null,
          };
          nextBatches.push(target);
        }
        target.quantity = (Number(target.quantity) || 0) + add.quantity;
      }
      // Bảo đảm bất biến tổng = Σ lô
      let running = total;
      movements = adds.map((add) => {
        running += add.quantity;
        return {
          type,
          quantity: add.quantity,
          invoiceId: invoiceId || null,
          performedBy: performedBy || null,
          reason: reason || "Hoàn vị kho theo lô",
          batchNumber: add.batchNumber,
          balanceAfter: running,
          timestamp: now,
        };
      });
      update = {
        $set: {
          batches: nextBatches,
          "stock.quantity": newTotal,
          "stock.lastUpdated": now,
        },
      };
    }
    update.$push = { stockMovements: { $each: movements } };

    const filter = { _id: drug._id, "stock.quantity": total };
    const res = await Drug.updateOne(filter, update, sessOpts);
    if (res.modifiedCount === 1) {
      return { ok: true, added: amount, balanceAfter: newTotal, batches: adds };
    }
    lastError = new Error(`Xung đột đồng thời khi hoàn vị kho thuốc ${drug._id} (lần ${attempt + 1})`);
  }

  return { ok: false, code: "CONCURRENT_CONFLICT", error: lastError?.message || "Xung đột hoàn vị kho, vui lòng thử lại." };
}

// ─────────────────────────────────────────────────────────────────────────────
// NHẬP LÔ MỚI / GỘP LÔ (updateStock action 'add' | 'import')
// Tự sinh số lô nếu bỏ trống: LO-YYYYMMDD-XXXX
// ─────────────────────────────────────────────────────────────────────────────
export async function importDrugBatch({
  drugId,
  qty,
  batchNumber = "",
  expiryDate = null,
  supplier = "",
  performedBy = null,
  reason = "",
  session = null,
  now = new Date(),
}) {
  const amount = Number(qty) || 0;
  if (amount <= 0) return { ok: false, code: "INVALID_QTY", error: "Số lượng nhập phải lớn hơn 0." };

  const sessOpts = session ? { session } : {};
  let number = (batchNumber || "").trim();
  if (!number) {
    const d = now;
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    number = `LO-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  let lastError = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const drug = await Drug.findById(drugId).session(session || null);
    if (!drug) return { ok: false, code: "DRUG_NOT_FOUND", error: "Không tìm thấy thuốc trong danh mục kho." };

    const total = Number(drug.stock?.quantity) || 0;
    const batches = toPlainBatches(drug);
    const nextBatches = batches.map((b) => ({ ...b }));

    let target = nextBatches.find((b) => b.batchNumber === number);
    if (target) {
      target.quantity = (Number(target.quantity) || 0) + amount;
      if (expiryDate) target.expiryDate = new Date(expiryDate);
      if (supplier) target.supplier = supplier.trim();
    } else {
      nextBatches.push({
        batchNumber: number,
        quantity: amount,
        expiryDate: expiryDate ? new Date(expiryDate) : drug.expiryDate || null,
        supplier: supplier ? supplier.trim() : "",
        receivedAt: now,
        receivedBy: performedBy || null,
      });
    }

    const newTotal = total + amount;
    const update = {
      $set: { batches: nextBatches, "stock.quantity": newTotal, "stock.lastUpdated": now },
      $push: {
        stockMovements: {
          type: "import",
          quantity: amount,
          performedBy: performedBy || null,
          reason: reason || `Nhập kho lô ${number}`,
          batchNumber: number,
          balanceAfter: newTotal,
          timestamp: now,
        },
      },
    };

    const filter = { _id: drug._id, "stock.quantity": total };
    const res = await Drug.updateOne(filter, update, sessOpts);
    if (res.modifiedCount === 1) {
      return { ok: true, batchNumber: number, added: amount, balanceAfter: newTotal };
    }
    lastError = new Error(`Xung đột khi nhập lô thuốc ${drug._id} (lần ${attempt + 1})`);
  }

  return { ok: false, code: "CONCURRENT_CONFLICT", error: lastError?.message || "Xung đột nhập kho, vui lòng thử lại." };
}
