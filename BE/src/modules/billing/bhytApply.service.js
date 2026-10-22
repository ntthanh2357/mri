import { BhytInfo } from "./models/bhytInfo.model.js";
import { isCardExpired, fmtDateVN } from "./bhytCard.util.js";
import { getPayOSLink, releasePayOSLink, markInvoicePaidByPayOS, inFlightMessage, MONEY_IN_FLIGHT } from "./payosLink.util.js";

const owedOf = (inv) => inv.patientPayAmount ?? ((inv.totalAmount || 0) - (inv.bhytInfo?.bhytAmount || 0));

/** Thẻ BHYT đang dùng của bệnh nhân (đã xác minh & còn hạn thì mới được trừ tiền) */
export const findActiveCard = (hospitalId, patientId) =>
  BhytInfo.findOne({ hospitalId, patientId, isActive: { $ne: false } }).sort({ updatedAt: -1 });

/**
 * Áp BHYT vào hóa đơn chờ thu (dùng chung: nút "Áp dụng BHYT" & tự áp khi phiếu thu sang quầy / trước khi thu).
 * Trả về { ok, code, message, data }. Không gửi response — nơi gọi tự xử lý.
 */
export const applyBhytCore = async (invoice, { bhyt = null, treatmentType = "outpatient", isOutOfNetwork = false, hasTransferForm = false, auto = false } = {}) => {
  if (invoice.status !== "chờ thanh toán") {
    return { ok: false, code: "NOT_PENDING", message: "Không thể chỉnh sửa hóa đơn đã thanh toán." };
  }
  const card = bhyt || (await findActiveCard(invoice.hospitalId, invoice.patientId));
  if (!card) return { ok: false, code: "NO_CARD", message: "Bệnh nhân chưa khai báo thẻ BHYT. Vui lòng khai báo thẻ ở bước Tiếp nhận trước khi áp dụng." };
  if (String(card.patientId) !== String(invoice.patientId)) return { ok: false, code: "WRONG_PATIENT", message: "Thẻ BHYT không thuộc bệnh nhân của hóa đơn này." };
  if (card.isActive === false) return { ok: false, code: "REPLACED", message: "Thẻ này đã được thay bằng thẻ mới. Vui lòng dùng thẻ đang hiệu lực của bệnh nhân." };
  if (isCardExpired(card.expiresAt)) return { ok: false, code: "EXPIRED", message: `Thẻ BHYT đã hết hạn từ ngày ${fmtDateVN(card.expiresAt)}. Bệnh nhân cần gia hạn thẻ hoặc tự chi trả.` };
  if (card.manuallyVerified !== true) return { ok: false, code: "UNVERIFIED", message: "Thẻ BHYT này chưa được lễ tân xác minh. Vui lòng mở mục Khai báo thẻ BHYT, đối chiếu thẻ gốc với CCCD rồi lưu lại trước khi áp dụng." };

  // Chốt chặn: bệnh nhân có thể đã quét mã VietQR (số tiền chưa trừ BHYT) trước khi áp BHYT
  if (invoice.orderCode) {
    const link = await getPayOSLink(invoice.orderCode);
    if (link.status === "PAID") {
      const fullPaid = link.amountPaid || owedOf(invoice);
      await markInvoicePaidByPayOS(invoice, "BHYT-Check", invoice.orderCode, fullPaid);
      // Đã trả đủ khi chưa trừ BHYT → phần BHYT đáng lẽ được hưởng phải hoàn lại cho bệnh nhân
      const shouldBe = Math.round((invoice.totalAmount || 0) * (card.coverageRate / 100));
      invoice.duplicatePayment = {
        flagged: true,
        detectedAt: new Date(),
        orderCode: Number(invoice.orderCode),
        amount: shouldBe,
        note: `Bệnh nhân đã chuyển khoản đủ ${fullPaid.toLocaleString("vi-VN")}đ qua VietQR trước khi áp BHYT (${card.coverageRate}%) → cần hoàn phần BHYT ${shouldBe.toLocaleString("vi-VN")}đ cho bệnh nhân.`,
      };
      await invoice.save();
      return { ok: false, code: "PAID_BEFORE_BHYT", message: invoice.duplicatePayment.note };
    }
    if (MONEY_IN_FLIGHT.includes(link.status) || link.status === "UNKNOWN") {
      return { ok: false, code: "PAYOS_IN_FLIGHT", message: inFlightMessage(link.status) };
    }
    // Mã còn chờ → hủy để bệnh nhân không quét nhầm mã có số tiền cũ (trạng thái được lưu cùng hóa đơn bên dưới)
    await releasePayOSLink(invoice, "Áp dụng BHYT — số tiền thay đổi");
  }

  const totalAmount = invoice.totalAmount || 0;
  const effectiveOutOfNetwork = isOutOfNetwork || card.isOutOfNetwork;
  const effectiveTransferForm = hasTransferForm || card.hasTransferForm;
  let effectiveRate = card.coverageRate;
  if (effectiveOutOfNetwork && !effectiveTransferForm && treatmentType === "outpatient") effectiveRate = 0;

  // Áp lại cho cùng hóa đơn (vd. đổi dịch vụ) → trả lại phần đã cộng vào lũy kế lần trước, tránh cộng dồn 2 lần
  const previous = String(invoice.bhytInfo?.bhytId || "") === String(card._id) ? (invoice.bhytInfo?.bhytAmount || 0) : 0;
  const usedBefore = Math.max(0, (card.usedThisYear || 0) - previous);
  const annualCap = card.annualCap || 72000000;
  const remainingCap = Math.max(0, annualCap - usedBefore);
  const bhytAmount = Math.min(Math.round(totalAmount * (effectiveRate / 100)), remainingCap);
  const patientAmount = totalAmount - bhytAmount;

  invoice.bhytInfo = {
    bhytId: card._id,
    cardNumber: `****${card.cardNumber?.slice(-4)}`,
    coverageRate: effectiveRate,
    bhytAmount,
    patientCopayAmount: patientAmount,
    annualCap,
    usedThisYear: usedBefore + bhytAmount,
    isOutOfNetwork: effectiveOutOfNetwork,
    priorAuthorization: card.priorAuthorizations?.[0]?.approvalNumber || null,
    appliedOnTotal: totalAmount,
    autoApplied: auto,
  };
  invoice.patientPayAmount = patientAmount; // Bệnh nhân chỉ trả phần đồng chi trả
  await invoice.save();

  card.invoiceId = invoice._id;
  card.usedThisYear = usedBefore + bhytAmount;
  await card.save();

  return { ok: true, data: { invoiceId: invoice._id, totalAmount, bhytAmount, patientCopayAmount: patientAmount, coverageRate: effectiveRate } };
};

/**
 * Tự áp BHYT nếu bệnh nhân có thẻ hợp lệ (đã xác minh, còn hạn) mà hóa đơn chưa áp, hoặc đã áp trên tổng tiền cũ.
 * Thẻ chưa xác minh / hết hạn → không áp, trả lý do để quầy thu ngân biết.
 */
export const autoApplyBhytIfEligible = async (invoice) => {
  if (!invoice || invoice.status !== "chờ thanh toán") return { applied: false };
  const upToDate = invoice.bhytInfo?.bhytId && invoice.bhytInfo?.appliedOnTotal === invoice.totalAmount;
  if (upToDate) return { applied: false, upToDate: true };
  const card = await findActiveCard(invoice.hospitalId, invoice.patientId);
  if (!card) return { applied: false };
  const res = await applyBhytCore(invoice, { bhyt: card, treatmentType: card.treatmentType || "outpatient", auto: true });
  return res.ok ? { applied: true, ...res.data } : { applied: false, code: res.code, reason: res.message };
};

/**
 * Tổng tiền hóa đơn vừa thay đổi (thêm/bớt dịch vụ, thuốc, giường) → tính lại phần BHYT:
 *  - thẻ còn hợp lệ → áp lại theo tổng mới (không cộng dồn lũy kế)
 *  - không áp lại được (thẻ hết hạn / chưa xác minh / đã thay) → gỡ phần BHYT cũ đã sai số tiền, trả lại lũy kế cho thẻ
 */
export const reconcileBhytAfterTotalChange = async (invoice) => {
  const auto = await autoApplyBhytIfEligible(invoice);
  if (!auto.applied && !auto.upToDate && invoice.bhytInfo?.bhytId && invoice.bhytInfo.appliedOnTotal !== invoice.totalAmount
      && !["PAID_BEFORE_BHYT", "PAYOS_IN_FLIGHT"].includes(auto.code)) {
    const card = await BhytInfo.findById(invoice.bhytInfo.bhytId);
    if (card) {
      card.usedThisYear = Math.max(0, (card.usedThisYear || 0) - (invoice.bhytInfo.bhytAmount || 0));
      await card.save();
    }
    invoice.bhytInfo = undefined;
    invoice.patientPayAmount = undefined;
    await invoice.save();
  }
  return auto;
};
