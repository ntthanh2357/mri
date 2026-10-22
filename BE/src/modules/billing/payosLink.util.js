import payos from "../../utils/payos.js";
import { Invoice } from "./models/invoice.model.js";
import { finalizeReceivedPayment } from "./prescriptionBilling.service.js";
import { tenantStorage } from "../../middlewares/tenant.middleware.js";

// Link VietQR PayOS chỉ có hiệu lực trong khoảng này — quá hạn PayOS tự chuyển sang "hết hạn", không treo "chờ thanh toán"
export const PAYOS_LINK_TTL_MINUTES = 15;

// Trạng thái cho thấy tiền đã / đang về → tuyệt đối không hủy link, không tạo mã mới, không thu thêm
export const MONEY_IN_FLIGHT = ["PAID", "PROCESSING", "UNDERPAID"];

export const payosConfigured = () => !!(process.env.PAYOS_CLIENT_ID && process.env.PAYOS_API_KEY && process.env.PAYOS_CHECKSUM_KEY);

/** Đọc trạng thái 1 link trên PayOS (không thay đổi gì). Lỗi mạng → "UNKNOWN" để nơi gọi xử lý thận trọng. */
export const getPayOSLink = async (orderCode) => {
  if (!orderCode || !payosConfigured()) return { status: null };
  try {
    const link = await payos.paymentRequests.get(Number(orderCode));
    return { status: link?.status || null, amount: link?.amount, amountPaid: link?.amountPaid };
  } catch (err) {
    console.warn(`[PayOS] Không đọc được link ${orderCode}:`, err.message);
    return { status: "UNKNOWN" };
  }
};

/** Mọi mã đơn PayOS từng tạo cho hóa đơn (lịch sử + mã hiện tại), mới nhất trước */
export const allOrderCodes = (invoice) => {
  const codes = [...(invoice?.payosLinks || []).map((l) => Number(l.orderCode)), Number(invoice?.orderCode || 0)].filter(Boolean);
  return [...new Set(codes)].reverse();
};

/** Cập nhật trạng thái 1 mã trong lịch sử của hóa đơn (chưa lưu — nơi gọi tự save) */
export const setLinkStatus = (invoice, orderCode, status) => {
  const entry = (invoice.payosLinks || []).find((l) => Number(l.orderCode) === Number(orderCode));
  if (entry && status && status !== "UNKNOWN") entry.status = status;
};

/**
 * Giải phóng link PayOS hiện tại của hóa đơn (khi số tiền đổi / thu bằng cách khác).
 *  - PENDING → hủy trên PayOS
 *  - PAID / PROCESSING / UNDERPAID / UNKNOWN → KHÔNG hủy, trả trạng thái để nơi gọi dừng lại
 */
export const releasePayOSLink = async (invoice, reason = "Hóa đơn đã thay đổi / thu bằng hình thức khác") => {
  if (!invoice?.orderCode || !payosConfigured()) return { status: null };
  const { status } = await getPayOSLink(invoice.orderCode);
  if (status === "PENDING") {
    try {
      await payos.paymentRequests.cancel(Number(invoice.orderCode), reason.slice(0, 200));
      setLinkStatus(invoice, invoice.orderCode, "CANCELLED");
      return { status: "CANCELLED" };
    } catch (err) {
      console.warn(`[PayOS] Không hủy được link ${invoice.orderCode}:`, err.message);
      return { status: "UNKNOWN" };
    }
  }
  setLinkStatus(invoice, invoice.orderCode, status);
  return { status };
};

/** Thông báo trả về cho lễ tân khi tiền có thể đang về */
export const inFlightMessage = (status) => ({
  PROCESSING: "Giao dịch VietQR của hóa đơn này đang được ngân hàng xử lý. Vui lòng chờ vài phút rồi bấm kiểm tra lại — KHÔNG thu thêm tiền mặt / tạo mã mới.",
  UNDERPAID: "Mã VietQR của hóa đơn này đã nhận một phần tiền. Vui lòng kiểm tra giao dịch trên PayOS trước khi thu thêm.",
  UNKNOWN: "Không kiểm tra được trạng thái mã VietQR trên PayOS (lỗi kết nối). Vui lòng thử lại sau ít phút trước khi thu tiền.",
}[status]);

/**
 * Ghi nhận hóa đơn đã thanh toán qua PayOS (webhook / kiểm tra chủ động / tác vụ đối soát).
 * Hóa đơn đã thu trước đó mà mã lại nhận tiền → gắn cờ thu trùng.
 * Trả về: true (đã ghi nhận) | false (đã xử lý trước đó) | "duplicate" | "retry" (lỗi tạm thời, thử lại sau) | "flagged" (đã nhận tiền nhưng kẹt kho)
 */
export const markInvoicePaidByPayOS = async (invoice, source, paidCode = invoice.orderCode, amount = null) => {
  setLinkStatus(invoice, paidCode, "PAID");
  if (["đã thanh toán", "hoàn trả", "đang xử lý"].includes(invoice.status)) {
    // Đúng mã đã ghi nhận trước đó → không làm gì (idempotent)
    if (Number(invoice.paidOrderCode) === Number(paidCode) || Number(invoice.duplicatePayment?.orderCode) === Number(paidCode)) {
      await invoice.save();
      return false;
    }
    // Hóa đơn đã được thu (tiền mặt / BHYT / mã VietQR khác) mà mã này lại nhận tiền → THU TRÙNG
    const owed = invoice.patientPayAmount ?? (invoice.totalAmount - (invoice.bhytInfo?.bhytAmount || 0));
    invoice.duplicatePayment = {
      flagged: true,
      detectedAt: new Date(),
      orderCode: Number(paidCode),
      amount: amount ?? owed,
      note: `Hóa đơn đã được thu (${invoice.paymentMethod || "—"}) nhưng mã VietQR ${paidCode} vẫn nhận thêm tiền → cần hoàn khoản dư cho bệnh nhân.`,
    };
    await invoice.save();
    console.warn(`[PayOS ${source}] ⚠️ THU TRÙNG hóa đơn ${invoice._id}: mã ${paidCode} nhận tiền sau khi hóa đơn đã thanh toán.`);
    return "duplicate";
  }

  // Chiếm hóa đơn nguyên tử: webhook, nút kiểm tra và tác vụ đối soát có thể chạy cùng lúc → chỉ 1 bên được trừ kho
  const claimed = await Invoice.updateOne(
    { _id: invoice._id, status: "chờ thanh toán" },
    { $set: { status: "đang xử lý", paymentMethod: "vietqr", paidAt: new Date(), paidOrderCode: Number(paidCode) } },
    { bypassTenancy: true }
  );
  if (!claimed.modifiedCount) {
    const fresh = await Invoice.findById(invoice._id).setOptions({ bypassTenancy: true });
    if (fresh && fresh.status !== "chờ thanh toán") return markInvoicePaidByPayOS(fresh, source, paidCode, amount);
    return false;
  }
  invoice.status = "đang xử lý";
  invoice.paymentMethod = "vietqr";
  invoice.paidAt = new Date();
  invoice.paidOrderCode = Number(paidCode);

  // Giống luồng thu tại quầy: trừ kho thuốc theo lô FEFO + đóng lượt khám, chạy trong ngữ cảnh bệnh viện của hóa đơn
  const hospitalId = invoice.hospitalId ? String(invoice.hospitalId) : null;
  const result = await tenantStorage.run({ hospitalId, bypassTenancy: !hospitalId }, () =>
    finalizeReceivedPayment(invoice, { reason: `Thanh toán VietQR PayOS mã GD ${paidCode}`, label: `VietQR ${paidCode}` })
  );
  // Lỗi tạm thời: để mã ở trạng thái "đang xử lý" (không cho tạo mã mới / thu thêm) và để tác vụ đối soát thử lại
  if (result === "retry") setLinkStatus(invoice, paidCode, "PROCESSING");
  if (result === "paid") console.log(`[PayOS ${source}] Thanh toán thành công cho hóa đơn: ${invoice._id}, orderCode: ${paidCode}`);
  return result === "paid" ? true : result;
};
