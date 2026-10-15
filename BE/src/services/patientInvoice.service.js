import { Invoice } from "../models/invoice.model.js";

/**
 * Bệnh nhân xem hóa đơn viện phí của mình (chỉ xem; thanh toán tại quầy, thanh toán online UC-PAT-10 đang tạm gác).
 * Chỉ trả phần bệnh nhân cần: các dòng phí, BHYT chi trả, phần bệnh nhân trả, trạng thái. Không trả trường nội bộ
 * (phê duyệt hoàn tiền, kiểm tra chống rửa tiền, thử nghiệm lâm sàng, ghi chú thu ngân, số lô thuốc, số thẻ BHYT đầy đủ...).
 */

const MAX_LIMIT = 50;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const sum = (list, pick) => list.reduce((n, x) => n + num(pick(x)), 0);

const toItem = (it) => {
  const cov = it?.insuranceCoverage || {};
  const amount = num(it?.amount);
  const insuranceAmount = cov.isCovered ? num(cov.insuranceAmount) : 0;
  return {
    description: String(it?.drugName || it?.description || ""),
    type: it?.type || "other",
    quantity: num(it?.quantity) || 1,
    unit: it?.type === "drug" ? String(it?.unit || "") : "",
    unitPrice: num(it?.unitPrice) || amount,
    amount,
    covered: !!cov.isCovered,
    insuranceAmount,
    patientAmount: cov.isCovered && cov.patientCopayAmount !== undefined ? num(cov.patientCopayAmount) : amount - insuranceAmount,
  };
};

/** Hóa đơn (lean, có thể đã populate hospitalId/visitId) → bản cho bệnh nhân. */
export const toPatientInvoice = (inv) => {
  const items = (Array.isArray(inv?.items) ? inv.items : []).map(toItem);
  const totalAmount = num(inv?.totalAmount) || sum(items, (i) => i.amount);
  // BHYT: ưu tiên tổng đã giám định trên hóa đơn, không có thì cộng theo từng dòng
  const insuranceAmount = num(inv?.bhytInfo?.bhytAmount) || sum(items, (i) => i.insuranceAmount);
  const patientAmount = inv?.patientPayAmount !== null && inv?.patientPayAmount !== undefined
    ? num(inv.patientPayAmount)
    : Math.max(0, totalAmount - insuranceAmount);
  const card = String(inv?.bhytInfo?.cardNumber || "").replace(/\s+/g, "");
  return {
    _id: String(inv?._id),
    createdAt: inv?.createdAt || null,
    status: inv?.status || "chờ thanh toán",
    hospitalName: inv?.hospitalId?.name || "",
    visitDate: inv?.visitId?.date || inv?.visitId?.createdAt || null,
    visitReason: inv?.visitId?.reason || "",
    totalAmount,
    insuranceAmount,
    patientAmount,
    bhyt: insuranceAmount > 0 || inv?.bhytInfo?.coverageRate
      ? { coverageRate: num(inv?.bhytInfo?.coverageRate) || null, cardLast4: card ? card.slice(-4) : null }
      : null,
    paidAt: inv?.paidAt || null,
    paymentMethod: inv?.paymentMethod || "",
    refund: inv?.status === "hoàn trả" || num(inv?.refundAmount) > 0
      ? { amount: num(inv?.refundAmount), reason: inv?.refundReason || "", at: inv?.refundedAt || null }
      : null,
    items,
  };
};

/** Hóa đơn của bệnh nhân, mới nhất trước; `unpaidTotal`: tổng phần bệnh nhân còn phải trả. */
export const listPatientInvoices = async (patientId, { limit } = {}) => {
  const n = Math.min(Math.max(parseInt(limit, 10) || MAX_LIMIT, 1), MAX_LIMIT);
  const rows = await Invoice.find({ patientId })
    .sort({ createdAt: -1 })
    .limit(n)
    .select("createdAt status totalAmount patientPayAmount items bhytInfo.bhytAmount bhytInfo.coverageRate bhytInfo.cardNumber paidAt paymentMethod refundAmount refundReason refundedAt hospitalId visitId")
    .populate({ path: "hospitalId", select: "name", options: { bypassTenancy: true } })
    .populate({ path: "visitId", select: "date createdAt reason", options: { bypassTenancy: true } })
    .setOptions({ bypassTenancy: true }) // lọc tường minh theo đúng bệnh nhân; bệnh nhân có thể khám nhiều bệnh viện
    .lean();
  const invoices = rows.map(toPatientInvoice);
  const unpaidTotal = invoices.filter((i) => i.status === "chờ thanh toán").reduce((s, i) => s + i.patientAmount, 0);
  return { invoices, unpaidTotal };
};
