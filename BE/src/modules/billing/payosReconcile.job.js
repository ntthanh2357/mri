import { Invoice } from "./models/invoice.model.js";
import { getPayOSLink, setLinkStatus, markInvoicePaidByPayOS, payosConfigured } from "./payosLink.util.js";

// Đối soát nền: hỏi PayOS các mã VietQR gần đây chưa "đã trả" — bắt tiền về khi màn QR đã đóng / webhook không tới
const LOOKBACK_HOURS = 48;

export const runPayOSReconcileJob = async () => {
  if (!payosConfigured()) return;
  try {
    const since = new Date(Date.now() - LOOKBACK_HOURS * 3600 * 1000);
    // Job chạy ngoài ngữ cảnh người dùng → bỏ qua plugin tenancy (chỉ đọc mã đơn & cập nhật đúng hóa đơn của mã đó)
    const invoices = await Invoice.find({
      payosLinks: { $elemMatch: { createdAt: { $gte: since }, status: { $ne: "PAID" } } },
    }).setOptions({ bypassTenancy: true });

    let paid = 0;
    for (const invoice of invoices) {
      for (const link of invoice.payosLinks.filter((l) => l.createdAt >= since && l.status !== "PAID")) {
        const remote = await getPayOSLink(link.orderCode);
        if (remote.status === "PAID") {
          const result = await markInvoicePaidByPayOS(invoice, "Reconcile", link.orderCode, remote.amountPaid);
          if (result) paid += 1;
        } else {
          setLinkStatus(invoice, link.orderCode, remote.status);
        }
      }
      if (invoice.isModified()) await invoice.save();
    }
    if (paid) console.log(`[PayOS Reconcile] Ghi nhận ${paid} khoản VietQR về muộn.`);
  } catch (err) {
    console.warn("[PayOS Reconcile] Lỗi đối soát:", err.message);
  }
};
