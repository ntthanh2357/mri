import { Visit } from "../../models/visit.model.js";
import { Drug } from "../pharmacy/models/drug.model.js";
import { Prescription } from "../pharmacy/models/prescription.model.js";
import { User } from "../auth/models/user.model.js";
import { Invoice } from "./models/invoice.model.js";
import { executeWithTransaction } from "../../utils/transaction.util.js";
import { createNotificationInternal } from "../../controllers/notification.controller.js";
// Hàm trừ kho theo lô FEFO dùng chung của mọi luồng thanh toán (import vòng: chỉ gọi lúc chạy, không dùng khi nạp module)
import { deductStockForInvoice } from "./invoice.controller.js";

const escapeRx = (s) => String(s || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Đơn thuốc chưa tính tiền của lượt khám (lọc theo bệnh viện để chạy được cả trong webhook không có ngữ cảnh người dùng).
 * Không khớp theo mốc thời gian (đơn kê trước khi mở lượt khám) → đối chiếu theo tên thuốc đang có trên hóa đơn.
 */
const findOpenPrescription = async (invoice, visit) => {
  if (!visit) return null;
  const base = { hospitalId: invoice.hospitalId, patient_id: visit.patientId, isBilled: { $ne: true } };
  const byTime = await Prescription.findOne({ ...base, createdAt: { $gte: visit.createdAt } });
  if (byTime) return byTime;
  const invDrugNames = (invoice.items || [])
    .filter((it) => it.type === "drug")
    .map((it) => (it.drugName || "").trim().toLowerCase())
    .filter(Boolean);
  if (!invDrugNames.length) return null;
  const candidates = await Prescription.find(base).sort({ createdAt: -1 });
  return candidates.find((p) => (p.drugs || []).some((d) => invDrugNames.includes((d.name || "").trim().toLowerCase()))) || null;
};

const loadDrugs = async (invoice, prescription) => {
  const names = (prescription?.drugs || []).map((d) => new RegExp(`^${escapeRx(d.name)}$`, "i"));
  if (!names.length) return [];
  return Drug.find({ hospitalId: invoice.hospitalId, name: { $in: names } });
};

/**
 * Đưa thuốc theo đơn (chưa tính tiền) vào hóa đơn — CHƯA trừ kho.
 * Gọi khi mở hóa đơn ở quầy / trước khi tạo mã VietQR / trước khi thu để số tiền hiển thị đã gồm tiền thuốc.
 * Trả về { changed, shortages: [câu báo thiếu kho] }. Nơi gọi tự save hóa đơn.
 */
export const syncPrescriptionDrugs = async (invoice) => {
  if (!invoice?.visitId || invoice.status !== "chờ thanh toán") return { changed: false, shortages: [] };
  const visit = await Visit.findById(invoice.visitId);
  const prescription = await findOpenPrescription(invoice, visit);
  if (!prescription?.drugs?.length) return { changed: false, shortages: [] };

  const dbDrugs = await loadDrugs(invoice, prescription);
  const shortages = [];
  const drugItems = prescription.drugs.map((pDrug) => {
    const rx = new RegExp(`^${escapeRx(pDrug.name)}$`, "i");
    const dbDrug = dbDrugs.find((d) => rx.test(d.name));
    if (dbDrug?.stock && dbDrug.stock.quantity < pDrug.quantity) {
      shortages.push(`Thuốc '${pDrug.name}' không đủ tồn kho (hiện có ${dbDrug.stock.quantity}, cần ${pDrug.quantity}).`);
    }
    const unitPrice = (dbDrug && dbDrug.price) || pDrug.price || pDrug.unitPrice || 0;
    return {
      description: `Thuốc: ${pDrug.name} (SL: ${pDrug.quantity} ${pDrug.unit || "Viên"})`,
      amount: unitPrice * pDrug.quantity,
      type: "drug",
      drugId: dbDrug ? dbDrug._id : null,
      drugName: pDrug.name,
      quantity: pDrug.quantity,
      unitPrice,
      unit: pDrug.unit || dbDrug?.stock?.unit || "Viên",
      dosage: pDrug.dosage || null,
    };
  });

  // So với dòng thuốc đang có trong hóa đơn → chỉ thay khi đơn thuốc khác đi
  const key = (it) => `${it.drugName || it.description}|${it.quantity}|${it.amount}`;
  const current = invoice.items.filter((it) => it.type === "drug").map(key).sort().join(";");
  const next = drugItems.map(key).sort().join(";");
  if (current === next) return { changed: false, shortages };

  invoice.items = [...invoice.items.filter((it) => it.type !== "drug"), ...drugItems];
  invoice.totalAmount = invoice.items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  return { changed: true, shortages };
};

/**
 * Hóa đơn vừa được thu tiền: trừ kho thuốc theo lô FEFO (ghi nguồn lô lên dòng hóa đơn để hoàn vị khi refund),
 * đánh dấu đơn thuốc đã tính tiền, đóng lượt khám. Chạy trong session của giao dịch nếu có.
 * Kho không đủ / thuốc không có trong danh mục → ném lỗi có err.code (STOCK_SHORTAGE / DRUG_NOT_FOUND / ...).
 */
export const dispenseAndCloseVisit = async (invoice, { userId = null, session = null, reason = "" } = {}) => {
  const sessOpts = session ? { session } : {};
  const visit = invoice.visitId ? await Visit.findById(invoice.visitId).session(session || null) : null;
  const prescription = await findOpenPrescription(invoice, visit);

  const stockRes = await deductStockForInvoice({
    invoice,
    session,
    performedBy: userId,
    reason: reason || `Thanh toán hóa đơn ${invoice._id} (${invoice.paymentMethod || "—"})`,
  });
  if (!stockRes.success) {
    const err = new Error(stockRes.error || "Thiếu tồn kho dược phẩm");
    err.code = stockRes.code || "STOCK_SHORTAGE";
    throw err;
  }
  invoice.stockDeductionStatus = "DEDUCTED";

  if (prescription) {
    prescription.isBilled = true;
    prescription.invoiceId = invoice._id;
    await prescription.save(sessOpts);
  }
  if (visit) {
    visit.invoiceId = invoice._id;
    visit.status = "đã đóng";
    await visit.save(sessOpts);
  }
  return stockRes;
};

const TRANSIENT_CODES = ["ETIMEDOUT", "ECONNRESET", 112, "CONCURRENT_CONFLICT"];
const isTransient = (err) =>
  TRANSIENT_CODES.includes(err?.code) ||
  /WriteConflict|timed out|MongoNetworkError|TransientTransactionError/.test(err?.message || "");

/**
 * Tiền ĐÃ về (VietQR / chuyển khoản theo sao kê): trừ kho + đóng lượt khám + chuyển "đã thanh toán" trong 1 giao dịch.
 * Không được chặn hay quay về "chờ thanh toán" vì bệnh nhân đã trả tiền:
 *  - Lỗi hạ tầng tạm thời → giữ "chờ thanh toán" để webhook / tác vụ đối soát thử lại (tối đa 5 lần)
 *  - Thiếu kho / lỗi vĩnh viễn → "đang xử lý" + cờ trừ kho, báo dược sĩ & quản trị (luồng gỡ kẹt resolve-processing)
 * Trả về "paid" | "retry" | "flagged". Hóa đơn (bản trong bộ nhớ) được cập nhật theo kết quả.
 */
export const finalizeReceivedPayment = async (invoice, { userId = null, reason = "", label = "" } = {}) => {
  try {
    await executeWithTransaction(async (session) => {
      await dispenseAndCloseVisit(invoice, { userId, session, reason });
      invoice.status = "đã thanh toán";
      await invoice.save(session ? { session } : {});
    });
    return "paid";
  } catch (err) {
    if (isTransient(err)) {
      const retries = (invoice.webhookRetryCount || 0) + 1;
      if (retries < 5) {
        await Invoice.updateOne(
          { _id: invoice._id },
          { $set: { status: "chờ thanh toán", webhookRetryCount: retries, paymentNotes: `Lỗi hạ tầng tạm thời khi ghi nhận ${label} (lần ${retries}/5): ${err.message}. Hệ thống sẽ thử lại.` } }
        ).catch(() => {});
        invoice.status = "chờ thanh toán";
        invoice.webhookRetryCount = retries;
        return "retry";
      }
    }
    const flag = err.code === "STOCK_SHORTAGE" ? "SHORTAGE_FLAGGED" : isTransient(err) ? "EXCEEDED_MAX_RETRIES" : "PERMANENT_ERROR_FLAGGED";
    const note = `Đã nhận tiền (${label}) nhưng chưa xuất được kho thuốc (${flag}): ${err.message}`;
    await Invoice.updateOne(
      { _id: invoice._id },
      { $set: { status: "đang xử lý", stockDeductionStatus: flag, paymentNotes: note, dispenseWarning: note } }
    ).catch(() => {});
    invoice.status = "đang xử lý";
    invoice.stockDeductionStatus = flag;
    invoice.paymentNotes = note;
    invoice.dispenseWarning = note;
    console.error(`[Thanh toán ${label}] ⚠️ Hóa đơn ${invoice._id}: ${note}`);

    // Báo dược sĩ & quản trị của bệnh viện để nhập kho bù hoặc hoàn tiền
    try {
      const staff = await User.find({ hospitalId: invoice.hospitalId, role: { $in: ["hospital_admin", "pharmacist"] } }).select("_id").lean();
      for (const u of staff) {
        await createNotificationInternal({
          hospitalId: invoice.hospitalId,
          recipientId: u._id,
          type: flag === "SHORTAGE_FLAGGED" ? "stock_shortage" : "system_alert",
          title: "🚨 Đã nhận tiền nhưng chưa xuất được thuốc",
          message: `Hóa đơn ${String(invoice._id).slice(-8).toUpperCase()} đã thanh toán (${label}) nhưng ${err.message}. Hóa đơn chuyển sang 'đang xử lý' — cần nhập kho bù hoặc hoàn tiền.`,
          relatedId: invoice._id,
        });
      }
    } catch (notifErr) {
      console.error("[Thanh toán] Không gửi được thông báo thiếu kho:", notifErr.message);
    }
    return "flagged";
  }
};
