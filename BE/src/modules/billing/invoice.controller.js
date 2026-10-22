import { Invoice } from "./models/invoice.model.js";
import { Visit } from "../../models/visit.model.js";
import { Hospital } from "../hospital/models/hospital.model.js";
import { MedicalRecord } from "../emr/models/medicalRecord.model.js";
import { EMRVersion } from "../emr/models/emrVersion.model.js";
import payos from "../../utils/payos.js";
import { User } from "../auth/models/user.model.js";
import { Drug } from "../pharmacy/models/drug.model.js";
import { Prescription } from "../pharmacy/models/prescription.model.js";
import { deductDrugStockFEFO, restockDrugBatch } from "../pharmacy/services/batchStock.service.js";
import { executeWithTransaction } from "../../utils/transaction.util.js";
import { recordAuditLog, AUDIT_ACTIONS } from "../../services/auditLog.service.js";
import { buildServiceItems, hasVitals } from "./servicePricing.util.js";
import { sendRefundEmail } from "../../services/email.service.js";
import { autoApplyBhytIfEligible, reconcileBhytAfterTotalChange } from "./bhytApply.service.js";
import { syncPrescriptionDrugs, dispenseAndCloseVisit, finalizeReceivedPayment } from "./prescriptionBilling.service.js";
import { BhytInfo } from "./models/bhytInfo.model.js";
import { releasePayOSLink, getPayOSLink, allOrderCodes, setLinkStatus, inFlightMessage, markInvoicePaidByPayOS, MONEY_IN_FLIGHT, PAYOS_LINK_TTL_MINUTES } from "./payosLink.util.js";

import { createNotificationInternal } from "../../controllers/notification.controller.js";
import { tenantStorage } from "../../middlewares/tenant.middleware.js";

/**
 * Hàm trừ kho dùng chung cho toàn bộ các luồng thanh toán (payInvoice, createAndPayInvoice, handlePayOSWebhook)
 * Đảm bảo:
 * 1. Trừ kho THEO LÔ nguyên tắc FEFO (UC-PHA-07): lô hết hạn sớm xuất trước,
 *    lô đã hết hạn bị loại khỏi xuất; guard đồng thời + thử lại trong service.
 * 2. Ghi nguồn lô đã xuất lên từng dòng hóa đơn (item.batches) để hoàn tiền
 *    trước khi phát thuốc hoàn vị về ĐÚNG lô cũ (UC-PHA-06).
 * 3. Hỗ trợ truyền session trong transaction ACID.
 */
export const deductStockForInvoice = async ({ invoice, session = null, performedBy = null, reason = "" }) => {
  // 1. Nếu toàn bộ hóa đơn đã trừ kho hoặc không còn thuốc cần trừ
  if (invoice.stockDeductionStatus === "DEDUCTED") {
    return { success: true, deductedItems: [], isAlreadyDeducted: true };
  }

  // 2. Lọc các dòng thuốc chưa xuất phát vật lý (loại trừ các dòng đã DISPENSED ở ca cấp cứu)
  const drugItems = (invoice.items || []).filter(it => it.type === 'drug' && it.quantity > 0 && it.dispenseStatus !== 'DISPENSED');
  if (drugItems.length === 0) {
    return { success: true, deductedItems: [], isAlreadyDeducted: true };
  }

  const deductedItems = [];

  for (const item of drugItems) {
    const qty = Number(item.quantity) || 1;
    let findQuery = {};
    if (invoice.hospitalId) {
      findQuery.hospitalId = invoice.hospitalId;
    }

    if (item.drugId) {
      findQuery._id = item.drugId;
    } else {
      const escapedName = (item.drugName || item.description || "").replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      findQuery.name = new RegExp(`^${escapedName}$`, "i");
    }

    // Kiểm tra thuốc có tồn tại trong danh mục không
    const drugDoc = await Drug.findOne(findQuery).session(session || null);
    if (!drugDoc) {
      return {
        success: false,
        code: "DRUG_NOT_FOUND",
        error: `Thuốc '${item.drugName || item.description}' không tồn tại trong danh mục dược phẩm của bệnh viện.`,
        failedItem: item
      };
    }

    // 1. Trừ kho theo LÔ nguyên tắc FEFO (UC-PHA-07): lô hết hạn sớm xuất trước,
    //    lô đã hết hạn bị loại; guard đồng thời + vòng thử lại nằm trong service.
    //    Đồng thời ghi nguồn lô đã xuất lên dòng hóa đơn (item.batches) để hoàn
    //    tiền trước khi phát thuốc trả về ĐÚNG lô cũ (UC-PHA-06).
    const deductRes = await deductDrugStockFEFO({
      drugId: drugDoc._id,
      qty,
      performedBy,
      reason: reason || `Xuất thuốc theo hóa đơn ${invoice._id}`,
      type: "dispense",
      invoiceId: invoice._id,
      visitId: invoice.visitId || null,
      session,
    });

    if (!deductRes.ok) {
      return {
        success: false,
        code: deductRes.code,
        error: deductRes.code === "DRUG_NOT_FOUND"
          ? `Thuốc '${item.drugName || item.description}' không tồn tại trong danh mục dược phẩm của bệnh viện.`
          : deductRes.error,
        failedItem: item
      };
    }

    // Ghi nguồn lô đã xuất lên dòng hóa đơn để hoàn vị đúng lô khi refund
    if ((deductRes.breakdown || []).length > 0) {
      item.batches = deductRes.breakdown.map((b) => ({ batchNumber: b.batchNumber, quantity: b.quantity }));
    }

    deductedItems.push({
      drugId: drugDoc._id,
      name: drugDoc.name,
      quantity: qty,
      balanceAfter: deductRes.balanceAfter,
      batches: item.batches || [],
    });
  }

  return { success: true, deductedItems };
};

// @desc    Lễ tân tạo hóa đơn và thanh toán
// @route   POST /api/v1/invoices/visit/:visitId
// @access  Private (Receptionist, Admin)
export const createAndPayInvoice = async (req, res) => {
  try {
    const { visitId } = req.params;
    const { paymentMethod } = req.body;

    const visit = await Visit.findById(visitId);
    if (!visit) return res.status(404).json({ message: "Không tìm thấy lượt khám" });

    if (!["admin", "system_admin"].includes(req.user.role) && visit.hospitalId.toString() !== req.user.hospitalId) {
      return res.status(403).json({ message: "Không có quyền" });
    }

    // [LOGIC-01 FIX] Nếu đã có hóa đơn nháp (do updateStatus tự tạo), cập nhật thay vì từ chối
    // Chỉ từ chối nếu hóa đơn đã được thanh toán hoặc hoàn tiền
    const existingInvoice = await Invoice.findOne({ visitId });
    if (existingInvoice && !['chờ thanh toán', 'hủy'].includes(existingInvoice.status)) {
      return res.status(400).json({ message: "Lượt khám này đã có hóa đơn đã được thanh toán." });
    }

    const hospital = await Hospital.findById(req.user.hospitalId || visit.hospitalId);
    const examFee = hospital?.pricing?.examFee ?? 50000;
    const mriFee = hospital?.pricing?.mriFee ?? 1500000;
    const aiFee = hospital?.pricing?.aiFee ?? 200000;

    // Xây dựng items dịch vụ khám lâm sàng và hình ảnh
    let items = [{ description: "Khám bệnh", amount: examFee, type: "exam" }];
    if (visit.mriOrder && visit.mriOrder.orderedAt) {
      items.push({ description: "Chụp MRI", amount: mriFee, type: "mri" });
      if (visit.mriOrder.requestAiAnalysis) {
        items.push({ description: "Phân tích AI chẩn đoán", amount: aiFee, type: "ai" });
      }
    }

    // [LOGIC-02 FIX] Thêm visitId scope để tránh lấy nhầm đơn thuốc của ca khám khác
    const prescription = await Prescription.findOne({
      patient_id: visit.patientId,
      $or: [
        { visitId: visit._id },                              // scope chính xác theo visitId
        { visitId: null, createdAt: { $gte: visit.createdAt } } // fallback cho đơn thuốc cũ chưa có visitId
      ],
      isBilled: { $ne: true }
    });

    if (prescription && prescription.drugs && prescription.drugs.length > 0) {
      const drugNames = prescription.drugs.map(d => new RegExp(`^${d.name.trim()}$`, "i"));
      const dbDrugs = await Drug.find({
        hospitalId: req.user.hospitalId,
        name: { $in: drugNames }
      });

      for (const pDrug of prescription.drugs) {
        const pDrugRegex = new RegExp(`^${pDrug.name.trim()}$`, "i");
        const dbDrug = dbDrugs.find(d => pDrugRegex.test(d.name));

        // Kiểm tra tồn kho trước khi thanh toán
        if (dbDrug && dbDrug.stock && dbDrug.stock.quantity < pDrug.quantity) {
          return res.status(400).json({
            message: `Thuốc '${pDrug.name}' không đủ tồn kho (Hiện có: ${dbDrug.stock.quantity}, Cần: ${pDrug.quantity}).`
          });
        }

        const unitPrice = dbDrug ? dbDrug.price : 0;
        const totalDrugPrice = unitPrice * pDrug.quantity;

        items.push({
          description: `Thuốc: ${pDrug.name} (SL: ${pDrug.quantity} ${pDrug.unit || 'Viên'})`,
          amount: totalDrugPrice,
          type: "drug",
          drugId: dbDrug ? dbDrug._id : null,
          drugName: pDrug.name,
          quantity: pDrug.quantity,
          unitPrice: unitPrice,
          unit: pDrug.unit || dbDrug?.stock?.unit || 'Viên',
          dosage: pDrug.dosage || null
        });
      }

      // Giao dịch ACID: Trừ kho và tạo/cập nhật hóa đơn
      const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
      let mappedMethod = "tiền mặt";
      if (paymentMethod === "transfer" || paymentMethod === "chuyển khoản") {
        mappedMethod = "chuyển khoản";
      }

      let invoice;
      await executeWithTransaction(async (session) => {
        const sessOpts = session ? { session } : {};

        if (existingInvoice && existingInvoice.status === "chờ thanh toán") {
          existingInvoice.items = items;
          existingInvoice.totalAmount = totalAmount;
          existingInvoice.status = "đã thanh toán";
          // ⚠️ Không gán DEDUCTED trước — hàm trừ kho sẽ short-circuit
          existingInvoice.paymentMethod = mappedMethod;
          existingInvoice.paidAt = new Date();
          invoice = existingInvoice;
        } else {
          invoice = new Invoice({
            hospitalId: req.user.hospitalId,
            patientId: visit.patientId,
            visitId,
            items,
            totalAmount,
            status: "đã thanh toán",
            stockDeductionStatus: "PENDING",
            paymentMethod: mappedMethod,
            paidAt: new Date()
          });
        }

        // Trừ tồn kho bằng hàm dùng chung với balanceAfter chuẩn xác
        const stockRes = await deductStockForInvoice({
          invoice,
          session,
          performedBy: req.user.id,
          reason: `Kê đơn viện phí lượt khám ${visit._id}`
        });

        if (!stockRes.success) {
          throw new Error(stockRes.error);
        }

        // Chỉ phong cờ DEDUCTED sau khi trừ kho thành công (hoặc xác nhận đã trừ)
        invoice.stockDeductionStatus = "DEDUCTED";

        await invoice.save(sessOpts);

        if (prescription) {
          prescription.isBilled = true;
          prescription.invoiceId = invoice._id;
          await prescription.save(sessOpts);
        }

        visit.invoiceId = invoice._id;
        visit.status = "đã đóng";
        await visit.save(sessOpts);
      });

      return res.status(201).json({ message: "Thanh toán thành công", invoice });
    }

    // Trường hợp không có đơn thuốc (chỉ có phí khám / MRI)
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    let mappedMethod = "tiền mặt";
    if (paymentMethod === "transfer" || paymentMethod === "chuyển khoản") {
      mappedMethod = "chuyển khoản";
    }

    let invoice;
    await executeWithTransaction(async (session) => {
      const sessOpts = session ? { session } : {};

      if (existingInvoice && existingInvoice.status === "chờ thanh toán") {
        existingInvoice.items = items;
        existingInvoice.totalAmount = totalAmount;
        existingInvoice.status = "đã thanh toán";
        existingInvoice.paymentMethod = mappedMethod;
        existingInvoice.paidAt = new Date();
        await existingInvoice.save(sessOpts);
        invoice = existingInvoice;
      } else {
        invoice = new Invoice({
          hospitalId: req.user.hospitalId,
          patientId: visit.patientId,
          visitId,
          items,
          totalAmount,
          status: "đã thanh toán",
          paymentMethod: mappedMethod,
          paidAt: new Date()
        });
        await invoice.save(sessOpts);
      }

      visit.invoiceId = invoice._id;
      visit.status = "đã đóng";
      await visit.save(sessOpts);
    });

    res.status(201).json({ message: "Thanh toán thành công", invoice });
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

// @desc    Lấy danh sách hóa đơn
// @route   GET /api/v1/invoices
// @access  Private (Receptionist, Admin)
export const getInvoices = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    if (!hospitalId) {
      return res.status(403).json({ message: "Bạn chưa được gán vào bệnh viện nào." });
    }

    const { status } = req.query;
    let filter = { hospitalId };
    if (status) {
      filter.status = status;
    }

    const invoices = await Invoice.find(filter)
      .populate("patientId", "email profile")
      .populate("visitId", "reason status")
      .sort({ createdAt: -1 });

    res.status(200).json({ invoices });
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

// @desc    Receptionist thanh toán hóa đơn chờ thanh toán
// @route   PUT /api/v1/invoices/:id/pay
// @access  Private (Receptionist, Admin)
export const payInvoice = async (req, res) => {
  let lockedId = null; // khóa chống thu 2 lần cùng lúc
  try {
    const { id } = req.params;
    const { paymentMethod } = req.body;

    const invoice = await Invoice.findById(id);
    if (!invoice) return res.status(404).json({ message: "Không tìm thấy hóa đơn" });

    // Chỉ thu tiền hóa đơn đang chờ (đã thanh toán / đã hoàn trả / đã hủy thì không thu lại)
    if (invoice.status === "đang xử lý") {
      return res.status(400).json({
        message: "Hóa đơn đã nhận tiền nhưng đang kẹt ở trạng thái 'đang xử lý' (lỗi trừ kho) — vui lòng xử lý theo luồng hóa đơn kẹt (nhập kho bù hoặc hoàn tiền), không thu lại.",
      });
    }
    if (invoice.status !== "chờ thanh toán") {
      return res.status(400).json({ message: `Hóa đơn đang ở trạng thái "${invoice.status}" — không thể thu tiền.` });
    }
    // Khóa nguyên tử: chỉ 1 yêu cầu thu tiền được xử lý tại một thời điểm (khóa tự hết sau 60 giây nếu lỗi giữa chừng)
    const lock = await Invoice.updateOne(
      { _id: invoice._id, status: "chờ thanh toán", $or: [{ payLock: null }, { payLock: { $lt: new Date(Date.now() - 60 * 1000) } }] },
      { $set: { payLock: new Date() } }
    );
    if (!lock.modifiedCount) {
      return res.status(409).json({ message: "Hóa đơn đang được xử lý thanh toán ở một yêu cầu khác. Vui lòng tải lại để xem trạng thái." });
    }
    lockedId = invoice._id;

    // Bệnh nhân có thẻ BHYT hợp lệ mà hóa đơn chưa áp (hoặc áp trên tổng cũ) → tự áp trước khi thu
    if (invoice.status === "chờ thanh toán" && (["admin", "system_admin"].includes(req.user.role) || String(invoice.hospitalId) === String(req.user.hospitalId))) {
      const auto = await autoApplyBhytIfEligible(invoice);
      if (auto.code === "PAID_BEFORE_BHYT" || auto.code === "PAYOS_IN_FLIGHT") {
        return res.status(409).json({ code: auto.code, message: auto.reason });
      }
      if (auto.applied && paymentMethod !== "bhyt") {
        return res.status(409).json({
          code: "BHYT_AUTO_APPLIED",
          message: auto.patientCopayAmount > 0
            ? `Hệ thống vừa tự áp BHYT (${auto.coverageRate}%): bệnh nhân chỉ còn trả ${auto.patientCopayAmount.toLocaleString("vi-VN")}đ. Kiểm tra lại số tiền rồi thu.`
            : `Hệ thống vừa tự áp BHYT (${auto.coverageRate}%): BHYT chi trả toàn bộ, bệnh nhân không phải trả tiền.`,
          bhyt: auto,
        });
      }
    }

    // BHYT chi trả 100%: bệnh nhân không phải trả gì → ghi nhận "đã thanh toán" bằng BHYT (không thu tiền mặt / QR)
    // Hóa đơn 0đ nhờ BHYT (kể cả khi lễ tân bấm "thu tiền mặt") → ghi nhận bằng BHYT, không ghi là tiền mặt
    const owedNow = invoice.patientPayAmount ?? (invoice.totalAmount - (invoice.bhytInfo?.bhytAmount || 0));
    const coveredByBhyt = paymentMethod === "bhyt" || (owedNow <= 0 && (invoice.bhytInfo?.bhytAmount || 0) > 0);
    if (coveredByBhyt) {
      const owed = invoice.patientPayAmount ?? (invoice.totalAmount - (invoice.bhytInfo?.bhytAmount || 0));
      if (!(invoice.bhytInfo?.bhytAmount > 0) || owed > 0) {
        return res.status(400).json({ message: "Chỉ hóa đơn được BHYT chi trả 100% (bệnh nhân trả 0đ) mới được xác nhận thanh toán bằng BHYT." });
      }
    }

    // Hóa đơn từng tạo mã VietQR: kiểm tra trước khi thu bằng cách khác để không thu trùng
    if (invoice.status === "chờ thanh toán" && invoice.orderCode) {
      const current = await getPayOSLink(invoice.orderCode);
      setLinkStatus(invoice, invoice.orderCode, current.status);
      if (current.status === "PAID") {
        await markInvoicePaidByPayOS(invoice, "Check", invoice.orderCode, current.amountPaid);
        return res.status(409).json({ message: "Hóa đơn này đã được thanh toán qua VietQR trước đó. Hệ thống đã cập nhật trạng thái 'Đã thanh toán' — không thu thêm.", alreadyPaid: true });
      }
      if (MONEY_IN_FLIGHT.includes(current.status)) {
        await invoice.save();
        return res.status(409).json({ code: "PAYOS_IN_FLIGHT", message: inFlightMessage(current.status) });
      }
      // Mã còn chờ (hoặc không kiểm tra được): lễ tân phải hỏi bệnh nhân đã chuyển khoản chưa rồi mới thu
      if (["PENDING", "UNKNOWN"].includes(current.status) && req.body.confirmNoTransfer !== true && !coveredByBhyt) {
        const entry = (invoice.payosLinks || []).find((l) => Number(l.orderCode) === Number(invoice.orderCode));
        const at = entry?.createdAt ? new Date(entry.createdAt).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }) : "trước đó";
        return res.status(409).json({
          code: "PAYOS_LINK_PENDING",
          message: `Hóa đơn đang có mã VietQR tạo lúc ${at} chờ thanh toán. Hãy hỏi bệnh nhân đã chuyển khoản theo mã này chưa trước khi thu tiền mặt.`,
        });
      }
      await releasePayOSLink(invoice, coveredByBhyt ? "Hóa đơn được BHYT chi trả 100%" : "Đã thu tiền tại quầy");
    }

    if (!["admin", "system_admin"].includes(req.user.role) && invoice.hospitalId.toString() !== req.user.hospitalId) {
      return res.status(403).json({ message: "Không có quyền thao tác" });
    }

    // Đồng bộ tiền thuốc theo đơn trước khi thu — số tiền thu phải khớp với số lễ tân đang thấy trên hóa đơn
    const drugSync = await syncPrescriptionDrugs(invoice);
    if (drugSync.shortages.length) {
      return res.status(400).json({ code: "DRUG_SHORTAGE", message: drugSync.shortages.join(" ") });
    }
    if (drugSync.changed) {
      await invoice.save();
      await reconcileBhytAfterTotalChange(invoice); // tổng mới → tính lại phần BHYT (nếu có thẻ hợp lệ)
      const owedAfter = invoice.patientPayAmount ?? (invoice.totalAmount - (invoice.bhytInfo?.bhytAmount || 0));
      return res.status(409).json({
        code: "DRUGS_ADDED",
        message: `Đơn thuốc vừa được cộng vào hóa đơn: tổng mới ${invoice.totalAmount.toLocaleString("vi-VN")}đ, bệnh nhân trả ${owedAfter.toLocaleString("vi-VN")}đ. Kiểm tra lại số tiền rồi thu.`,
      });
    }

    let mappedMethod = coveredByBhyt ? "BHYT chi trả" : "tiền mặt";
    if (paymentMethod === "transfer" || paymentMethod === "chuyển khoản") {
      mappedMethod = "chuyển khoản";
    }
    invoice.status = "đã thanh toán";
    invoice.paymentMethod = mappedMethod;
    invoice.paidAt = new Date();

    // Trừ kho thuốc theo lô FEFO + đóng lượt khám + lưu hóa đơn trong cùng một giao dịch.
    // Chưa nhận tiền nên thiếu kho → dừng, không thu (lễ tân báo dược sĩ / bác sĩ đổi thuốc)
    try {
      await executeWithTransaction(async (session) => {
        await dispenseAndCloseVisit(invoice, { userId: req.user.id, session, reason: `Thanh toán hóa đơn ${invoice._id} (${mappedMethod})` });
        await invoice.save(session ? { session } : {});
      });
    } catch (stockErr) {
      if (["STOCK_SHORTAGE", "DRUG_NOT_FOUND"].includes(stockErr.code)) {
        return res.status(400).json({ code: "DRUG_SHORTAGE", message: stockErr.message });
      }
      throw stockErr;
    }

    // ── Ghi nhận Lịch sử sửa đổi bệnh án (Audit Trail / EMR Version) ──
    try {
      const patientUser = await User.findById(invoice.patientId);
      if (patientUser) {
        const medicalId = patientUser.profile?.medicalId;
        const patientName = patientUser.profile?.name || patientUser.profile?.fullName;
        
        let query = {};
        if (medicalId) {
          query = { $or: [{ patientId: medicalId }, { patientId: invoice.patientId.toString() }] };
        } else {
          query = { patientId: invoice.patientId.toString() };
        }
        
        let medicalRecord = await MedicalRecord.findOne(query);
        if (!medicalRecord && patientName) {
          medicalRecord = await MedicalRecord.findOne({ patientName });
        }

        if (medicalRecord) {
          const nextVersion = (medicalRecord.currentVersion || 1) + 1;
          
          const changes = {
            paymentStatus: {
              old: "Chờ thanh toán",
              new: `Đã xác nhận thanh toán thành công cho bệnh nhân (Mã HS: ${medicalId || 'N/A'}, ID: ${invoice.patientId}) bởi Điều dưỡng / Lễ tân (ID: ${req.user.id})`
            }
          };

          const emrVersion = new EMRVersion({
            medicalRecordId: medicalRecord._id,
            version: medicalRecord.currentVersion || 1,
            modifiedBy: `${req.user?.profile?.name || req.user?.email || "Điều dưỡng / Lễ tân"} (ID: ${req.user?.id})`,
            changes,
          });
          
          await emrVersion.save();
          medicalRecord.currentVersion = nextVersion;
          await medicalRecord.save();
          console.log(`[Audit Log] Created EMRVersion v${nextVersion - 1} for payment confirmation by ${req.user?.id}.`);
        }
      }
    } catch (auditError) {
      // Log audit error but don't fail the payment request
      console.error("Lỗi ghi nhận lịch sử sửa đổi bệnh án khi thanh toán:", auditError);
    }

    res.status(200).json({ message: "Thanh toán hóa đơn thành công", invoice });
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  } finally {
    if (lockedId) await Invoice.updateOne({ _id: lockedId }, { $set: { payLock: null } }).catch(() => {});
  }
};
// @desc    Điều dưỡng tạo hóa đơn chờ thanh toán (từ phiếu thu viện phí)
// @route   POST /api/v1/invoices/pending
// @access  Private (Nurse, Admin)
export const createPendingInvoice = async (req, res) => {
  try {
    const { visitId, notes } = req.body;

    // Phiếu thu luôn gắn với 1 lượt khám và chỉ lập khi đã đo sinh hiệu + đã chỉ định dịch vụ
    if (!visitId) {
      return res.status(400).json({ message: "Phiếu thu phải gắn với một lượt khám. Vui lòng mở bệnh nhân từ Hàng chờ / Lượt khám hôm nay." });
    }
    const visit = await Visit.findById(visitId);
    if (!visit) return res.status(404).json({ message: "Không tìm thấy lượt khám." });
    if (!["admin", "system_admin"].includes(req.user.role) && String(visit.hospitalId) !== String(req.user.hospitalId)) {
      return res.status(403).json({ message: "Không có quyền thao tác lượt khám này." });
    }
    if (!hasVitals(visit)) {
      return res.status(400).json({ message: "Chưa nhập sinh hiệu. Vui lòng hoàn thành tab Khám bệnh trước khi lập phiếu thu." });
    }
    const services = visit.serviceOrder?.services || [];
    if (!services.length) {
      return res.status(400).json({ message: "Chưa có phiếu chỉ định. Vui lòng hoàn thành tab Chỉ định trước khi lập phiếu thu." });
    }

    // Giá tính theo bảng giá bệnh viện (bỏ qua số tiền gửi từ màn hình)
    const hospital = await Hospital.findById(visit.hospitalId).lean();
    const serviceItems = buildServiceItems(services, hospital?.pricing);

    // Mỗi lượt khám chỉ 1 hóa đơn chờ thu: đã có thì cập nhật phần dịch vụ, giữ nguyên thuốc / giường / MRI do hệ thống thêm
    const existingPaid = await Invoice.findOne({ visitId: visit._id, status: "đã thanh toán" }).lean();
    if (existingPaid) {
      return res.status(409).json({ message: "Lượt khám này đã được thanh toán. Dịch vụ phát sinh thêm cần lập hóa đơn bổ sung ở quầy thu ngân." });
    }
    let invoice = await Invoice.findOne({ visitId: visit._id, status: "chờ thanh toán" });
    if (invoice) {
      // Số tiền sắp thay đổi → mã VietQR cũ (nếu có) không còn đúng
      const link = await releasePayOSLink(invoice, "Hóa đơn được cập nhật dịch vụ");
      if (link.status === "PAID") {
        return res.status(409).json({ message: "Hóa đơn này đã được thanh toán qua VietQR. Dịch vụ phát sinh thêm cần lập hóa đơn bổ sung ở quầy thu ngân." });
      }
      const kept = invoice.items.filter((it) => ["drug", "bed"].includes(it.type)
        || (["mri", "ai"].includes(it.type) && !serviceItems.some((s) => s.type === it.type)));
      invoice.items = [...serviceItems, ...kept];
    } else {
      invoice = new Invoice({
        hospitalId: visit.hospitalId,
        patientId: visit.patientId,
        visitId: visit._id,
        items: serviceItems,
        status: "chờ thanh toán",
        paymentMethod: "",
        paidAt: null,
      });
    }
    invoice.totalAmount = invoice.items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
    if (notes !== undefined) invoice.notes = String(notes || "");
    // Giữ thông tin BHYT cũ (nếu có) để bước tự áp bên dưới tính lại đúng theo tổng mới mà không cộng dồn lũy kế 2 lần
    await invoice.save();

    // Gắn hóa đơn vào lượt khám để luồng y lệnh MRI / hoàn tất ca không lập thêm hóa đơn trùng
    if (!visit.invoiceId || String(visit.invoiceId) !== String(invoice._id)) {
      visit.invoiceId = invoice._id;
      await visit.save();
    }

    const populated = await Invoice.findById(invoice._id)
      .populate('patientId', 'email profile')
      .populate('visitId', 'reason status');

    // Bệnh nhân có BHYT hợp lệ → tự áp ngay để quầy thu ngân & mã VietQR dùng đúng số tiền sau BHYT
    const bhytAuto = await reconcileBhytAfterTotalChange(invoice);
    const finalInvoice = await Invoice.findById(invoice._id).populate('patientId', 'email profile').populate('visitId', 'reason status');

    res.status(201).json({ message: "Đã gửi phiếu thu sang quầy thu ngân.", invoice: finalInvoice, bhytAuto });
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

// @desc    Tạo link thanh toán PayOS cho lượt khám
// @route   POST /api/v1/invoices/visit/:visitId/payos
// @access  Private
export const createPayOSPayment = async (req, res) => {
  try {
    const { visitId } = req.params; // Có thể là invoiceId hoặc visitId

    let invoice = null;
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(visitId);

    if (isValidObjectId) {
      // 1. Tìm theo invoiceId trước
      invoice = await Invoice.findOne({ _id: visitId, status: "chờ thanh toán" });
      // 2. Nếu không thấy, tìm theo visitId
      if (!invoice) {
        invoice = await Invoice.findOne({ visitId, status: "chờ thanh toán" });
      }
    }

    if (!invoice) return res.status(404).json({ message: "Không tìm thấy hóa đơn ở trạng thái chờ thanh toán" });

    // UC-REC-08: báo rõ khi máy chủ chưa cấu hình cổng PayOS
    if (!process.env.PAYOS_CLIENT_ID || !process.env.PAYOS_API_KEY || !process.env.PAYOS_CHECKSUM_KEY) {
      return res.status(503).json({ message: "Cổng thanh toán PayOS chưa được cấu hình trên máy chủ (thiếu PAYOS_CLIENT_ID / PAYOS_API_KEY / PAYOS_CHECKSUM_KEY). Vui lòng thu tiền mặt hoặc liên hệ quản trị." });
    }

    // Kiểm tra quyền (phải là lễ tân, admin, điều dưỡng hoặc chính bệnh nhân)
    const isPatient = invoice.patientId.toString() === req.user.id.toString();
    const isClinicStaff = req.user.hospitalId && invoice.hospitalId.toString() === req.user.hospitalId.toString();

    if (!isPatient && !isClinicStaff) {
      return res.status(403).json({ message: "Bạn không có quyền thanh toán cho hóa đơn này" });
    }

    // Cộng tiền thuốc theo đơn (nếu có) trước khi tính số tiền in lên mã QR
    const drugSync = await syncPrescriptionDrugs(invoice);
    if (drugSync.shortages.length) {
      return res.status(400).json({ code: "DRUG_SHORTAGE", message: drugSync.shortages.join(" ") });
    }
    if (drugSync.changed) await invoice.save();

    // Tự áp BHYT (nếu có thẻ hợp lệ) trước khi tính số tiền in lên mã QR
    const bhytAuto = await reconcileBhytAfterTotalChange(invoice);
    if (bhytAuto.code === "PAID_BEFORE_BHYT" || bhytAuto.code === "PAYOS_IN_FLIGHT") {
      return res.status(409).json({ code: bhytAuto.code, message: bhytAuto.reason });
    }

    // UC-REC-06: chỉ thu phần bệnh nhân phải trả sau khi đã khấu trừ BHYT
    const amountDue = Math.round(invoice.patientPayAmount ?? (invoice.totalAmount - (invoice.bhytInfo?.bhytAmount || 0)));
    if (amountDue <= 0) {
      return res.status(400).json({ message: "Hóa đơn này bệnh nhân không phải trả tiền (BHYT chi trả 100%). Bấm 'Xác nhận BHYT chi trả' thay vì tạo mã VietQR." });
    }

    // Mã cũ của hóa đơn: đã trả / đang xử lý → dừng; còn hạn & đúng số tiền → DÙNG LẠI (không tạo mã thứ 2)
    if (invoice.orderCode) {
      const old = await getPayOSLink(invoice.orderCode);
      setLinkStatus(invoice, invoice.orderCode, old.status);
      if (old.status === "PAID") {
        await markInvoicePaidByPayOS(invoice, "Check", invoice.orderCode, old.amountPaid);
        return res.status(409).json({ message: "Hóa đơn này đã được thanh toán qua VietQR trước đó. Hệ thống đã cập nhật trạng thái 'Đã thanh toán'.", alreadyPaid: true });
      }
      if (MONEY_IN_FLIGHT.includes(old.status) || old.status === "UNKNOWN") {
        await invoice.save();
        return res.status(409).json({ code: "PAYOS_IN_FLIGHT", message: inFlightMessage(old.status) });
      }
      const entry = (invoice.payosLinks || []).find((l) => Number(l.orderCode) === Number(invoice.orderCode));
      const stillValid = entry?.qrCode && entry.expiresAt && new Date(entry.expiresAt).getTime() - Date.now() > 60 * 1000;
      if (old.status === "PENDING" && Number(old.amount) === amountDue && stillValid) {
        await invoice.save();
        return res.status(200).json({
          message: "Hiển thị lại mã VietQR đang chờ thanh toán (không tạo mã mới).",
          reused: true,
          checkoutUrl: entry.checkoutUrl,
          qrCode: entry.qrCode,
          amount: amountDue,
          orderCode: invoice.orderCode,
          expiresAt: entry.expiresAt,
          invoice,
        });
      }
      // Hết hạn / sai số tiền / không còn chuỗi QR → hủy mã cũ (nếu còn chờ) rồi tạo mã mới
      const released = await releasePayOSLink(invoice, "Tạo mã VietQR mới thay thế");
      if (released.status === "PAID") {
        await markInvoicePaidByPayOS(invoice, "Check");
        return res.status(409).json({ message: "Hóa đơn này đã được thanh toán qua VietQR trước đó. Hệ thống đã cập nhật trạng thái 'Đã thanh toán'.", alreadyPaid: true });
      }
      if (MONEY_IN_FLIGHT.includes(released.status) || released.status === "UNKNOWN") {
        await invoice.save();
        return res.status(409).json({ code: "PAYOS_IN_FLIGHT", message: inFlightMessage(released.status) });
      }
    }

    // Tạo mã orderCode duy nhất dạng số nguyên cho PayOS (9 chữ số cuối của timestamp + số ngẫu nhiên)
    const orderCode = Number(String(Date.now()).slice(-9)) + Math.floor(Math.random() * 1000);

    // Chuẩn bị dữ liệu gửi lên PayOS
    const hostname = req.get("host");
    const protocol = req.protocol;
    // URL dẫn đến endpoint GET của backend để hiển thị trang success/cancel đẹp mắt
    const returnUrl = `${protocol}://${hostname}/api/v1/invoices/payment/success?invoiceId=${invoice._id}`;
    const cancelUrl = `${protocol}://${hostname}/api/v1/invoices/payment/cancel?invoiceId=${invoice._id}`;

    const hasBhyt = (invoice.bhytInfo?.bhytAmount || 0) > 0;
    const expiresAt = new Date(Date.now() + PAYOS_LINK_TTL_MINUTES * 60 * 1000);
    const paymentBody = {
      orderCode,
      amount: amountDue,
      description: `Thanh toan HD ${orderCode}`,
      items: hasBhyt
        ? [{ name: "Vien phi dong chi tra sau BHYT", quantity: 1, price: amountDue }]
        : invoice.items.map(item => ({
            name: item.description,
            quantity: 1,
            price: item.amount
          })),
      returnUrl,
      cancelUrl,
      // Mã hết hiệu lực sau PAYOS_LINK_TTL_MINUTES (15) phút để không treo "chờ thanh toán" trên PayOS
      expiredAt: Math.floor(expiresAt.getTime() / 1000),
    };

    const paymentLinkData = await payos.paymentRequests.create(paymentBody);

    // Lưu mã hiện tại + lịch sử mã (không ghi đè mất mã cũ)
    invoice.orderCode = orderCode;
    invoice.payosLinks = [...(invoice.payosLinks || []), {
      orderCode,
      amount: amountDue,
      qrCode: paymentLinkData.qrCode || "",
      checkoutUrl: paymentLinkData.checkoutUrl || "",
      expiresAt,
      status: "PENDING",
      createdAt: new Date(),
    }];
    await invoice.save();

    res.status(200).json({
      message: "Tạo link thanh toán thành công",
      checkoutUrl: paymentLinkData.checkoutUrl,
      qrCode: paymentLinkData.qrCode || null, // UC-REC-08: chuỗi VietQR để hiển thị mã ngay tại quầy
      amount: amountDue,
      orderCode,
      expiresAt,
      invoice
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi tạo link thanh toán PayOS", error: error.message });
  }
};

// Ghi nhận hóa đơn lượt khám đã thanh toán qua PayOS (dùng chung cho webhook và kiểm tra chủ động)

// @desc    UC-REC-08 — Hỏi PayOS trạng thái MỌI mã VietQR của hóa đơn (dự phòng khi webhook không tới / đối soát thu trùng)
// @route   POST /api/v1/invoices/:id/payos-check
// @access  Private (Receptionist, Nurse, Hospital Admin, Admin)
export const checkPayOSPayment = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Không tìm thấy hóa đơn" });
    if (!["admin", "system_admin"].includes(req.user.role) && String(invoice.hospitalId) !== String(req.user.hospitalId)) {
      return res.status(403).json({ message: "Không có quyền thao tác" });
    }
    const codes = allOrderCodes(invoice);
    if (!codes.length) return res.status(200).json({ status: invoice.status, paid: ["đã thanh toán", "đang xử lý"].includes(invoice.status), payosStatus: null, invoice });

    // Dò cả mã cũ: tiền về muộn cho mã đã thay thế vẫn được ghi nhận (hoặc gắn cờ thu trùng)
    let currentStatus = null;
    for (const code of codes) {
      const link = await getPayOSLink(code);
      if (Number(code) === Number(invoice.orderCode)) currentStatus = link.status;
      if (link.status === "PAID") await markInvoicePaidByPayOS(invoice, "Check", code, link.amountPaid);
      else setLinkStatus(invoice, code, link.status);
    }
    await invoice.save();
    return res.status(200).json({
      status: invoice.status,
      paid: ["đã thanh toán", "đang xử lý"].includes(invoice.status),
      payosStatus: currentStatus,
      duplicate: invoice.duplicatePayment?.flagged ? invoice.duplicatePayment : null,
      invoice,
    });
  } catch (error) {
    return res.status(502).json({ message: "Không kiểm tra được trạng thái thanh toán từ PayOS", error: error.message });
  }
};

// @desc    Webhook tiếp nhận kết quả thanh toán từ PayOS
// @route   POST /api/v1/invoices/payos-webhook
// @access  Public
export const handlePayOSWebhook = async (req, res) => {
  let verifiedData;
  try {
    // Xác thực chữ ký dữ liệu từ PayOS để chống giả mạo
    // SDK @payos/node v2: verify() là hàm bất đồng bộ — thiếu await thì verifiedData là Promise và webhook không bao giờ được xử lý
    verifiedData = await payos.webhooks.verify(req.body);
  } catch (error) {
    console.error("[PayOS Webhook Error]", error.message);
    return res.status(400).json({ message: "Lỗi xác thực webhook", error: error.message });
  }

  try {
    if (verifiedData.code !== "00") {
      return res.status(200).json({ success: true, message: "Webhook nhận thành công nhưng không phải trạng thái thành công 00." });
    }
    const orderCode = Number(verifiedData.orderCode);

    // Tìm theo mã hiện tại hoặc mã cũ trong lịch sử (tiền về muộn cho mã đã thay thế).
    // Webhook từ PayOS không có ngữ cảnh bệnh viện → bỏ qua plugin tenancy (an toàn vì chữ ký đã được xác thực ở trên)
    const invoice = await Invoice.findOne({ $or: [{ orderCode }, { "payosLinks.orderCode": orderCode }] }).setOptions({ bypassTenancy: true });
    if (!invoice) {
      console.warn(`[PayOS Webhook] Không tìm thấy hóa đơn cho mã ${orderCode}.`);
      return res.status(200).json({ success: true, message: "Không có hóa đơn khớp mã giao dịch." });
    }

    // Ghi nhận thanh toán + trừ kho FEFO + đóng lượt khám (nguyên tử, idempotent, phát hiện thu trùng)
    const result = await markInvoicePaidByPayOS(invoice, "Webhook", orderCode, verifiedData.amount);
    if (result === "retry") {
      // Lỗi hạ tầng tạm thời: trả 500 để PayOS gửi lại (tác vụ đối soát 5 phút/lần cũng sẽ thử lại)
      return res.status(500).json({ message: "Lỗi hạ tầng tạm thời, yêu cầu gửi lại webhook.", retryCount: invoice.webhookRetryCount });
    }
    const messages = {
      true: "Thanh toán và trừ tồn kho thành công.",
      false: "Hóa đơn đã được xử lý thanh toán trước đó (idempotent).",
      duplicate: "Hóa đơn đã thanh toán trước đó — gắn cờ THU TRÙNG.",
      flagged: "Đã ghi nhận thanh toán nhưng chưa xuất được kho — hóa đơn chuyển 'đang xử lý'.",
    };
    return res.status(200).json({ success: true, message: messages[String(result)] || "Đã xử lý." });
  } catch (error) {
    console.error("[PayOS Webhook Error]", error.message);
    return res.status(500).json({ message: "Lỗi xử lý webhook", error: error.message });
  }
};

// @desc    Lấy danh sách các hóa đơn kẹt ở trạng thái "đang xử lý" (thiếu kho hoặc timeout)
// @route   GET /api/v1/invoices/stuck-processing
// @access  Private (Pharmacist, Hospital Admin, Admin, Receptionist)
export const getStuckProcessingInvoices = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    const filter = { status: "đang xử lý" };
    if (hospitalId && !["admin", "system_admin"].includes(req.user.role)) {
      filter.hospitalId = hospitalId;
    }

    const invoices = await Invoice.find(filter)
      .populate("patientId", "profile email")
      .populate("visitId", "reason status")
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({ success: true, count: invoices.length, invoices });
  } catch (error) {
    console.error("Lỗi getStuckProcessingInvoices:", error);
    return res.status(500).json({ message: "Lỗi hệ thống", error: error.message });
  }
};

// @desc    Xử lý lối thoát cho hóa đơn kẹt "đang xử lý" (Dược sĩ nhập kho bù -> trừ kho, hoặc Thu ngân hoàn tiền)
// @route   POST /api/v1/invoices/:id/resolve-processing
// @access  Private (Pharmacist, Hospital Admin, Admin)
export const resolveProcessingInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, note } = req.body; // action: "retry_deduct" | "cancel_refund"

    const invoice = await Invoice.findById(id);
    if (!invoice) return res.status(404).json({ message: "Không tìm thấy hóa đơn." });

    if (invoice.status !== "đang xử lý") {
      return res.status(400).json({ message: `Hóa đơn không ở trạng thái 'đang xử lý' (Hiện tại: ${invoice.status}).` });
    }

    if (action === "retry_deduct") {
      // Dược sĩ đã nhập thêm thuốc vào kho, thử trừ kho lại
      await executeWithTransaction(async (session) => {
        const sessOpts = session ? { session } : {};
        // Trừ kho FEFO + đánh dấu đơn thuốc đã tính tiền + đóng lượt khám (giống luồng thanh toán bình thường)
        await dispenseAndCloseVisit(invoice, {
          userId: req.user.id,
          session,
          reason: `Trừ kho bù sau khi bổ sung tồn kho (Người duyệt: ${req.user.email})`,
        });

        invoice.status = "đã thanh toán";
        invoice.dispenseWarning = "";
        invoice.stockDeductionStatus = "DEDUCTED";
        invoice.paymentNotes = note || "Đã bổ sung thuốc và trừ kho thành công.";
        await invoice.save(sessOpts);
      });

      try {
        await recordAuditLog({
          action: AUDIT_ACTIONS.STOCK_ADJUSTED,
          entity: "Invoice",
          entityId: invoice._id,
          performedBy: req.user.id,
          hospitalId: req.user.hospitalId || invoice.hospitalId,
          details: `Xử lý gỡ kẹt hóa đơn PayOS: Dược sĩ đã bổ sung kho và trừ bù tồn kho thành công cho hóa đơn ${invoice._id}. Ghi chú: ${note || 'N/A'}`
        });
      } catch (auditErr) {
        console.warn("[AuditLog Warn]", auditErr.message);
      }

      return res.status(200).json({ success: true, message: "Đã trừ kho bù thành công và chuyển hóa đơn sang 'đã thanh toán'.", invoice });
    } else if (action === "cancel_refund") {
      // Không thể cấp thuốc -> hoàn tiền cho người bệnh
      invoice.status = "hoàn trả";
      invoice.refundReason = note || "Kho không thể cung ứng thuốc sau thanh toán VietQR.";
      invoice.refundedAt = new Date();
      invoice.refundedBy = req.user.id;
      await invoice.save();

      try {
        await recordAuditLog({
          action: AUDIT_ACTIONS.REFUND_APPROVED,
          entity: "Invoice",
          entityId: invoice._id,
          performedBy: req.user.id,
          hospitalId: req.user.hospitalId || invoice.hospitalId,
          details: `Xử lý gỡ kẹt hóa đơn PayOS: Hủy đơn và phê duyệt hoàn trả viện phí do kho thiếu thuốc không thể cấp phát. Ghi chú: ${note || 'N/A'}`
        });
      } catch (auditErr) {
        console.warn("[AuditLog Warn]", auditErr.message);
      }

      return res.status(200).json({ success: true, message: "Đã hủy hóa đơn và chuyển sang trạng thái hoàn trả cho người bệnh.", invoice });
    } else {
      return res.status(400).json({ message: "action phải là 'retry_deduct' hoặc 'cancel_refund'." });
    }
  } catch (error) {
    console.error("Lỗi resolveProcessingInvoice:", error);
    return res.status(500).json({ message: error.message || "Lỗi xử lý hóa đơn treo.", error: error.message });
  }
};

// @desc    Trang HTML hiển thị thanh toán thành công
// @route   GET /api/v1/invoices/payment/success
// @access  Public
export const paymentSuccess = async (req, res) => {
  try {
    // BẢO MẬT (BUG-01): Tuyệt đối không thay đổi trạng thái hóa đơn tại returnUrl công khai.
    // Toàn bộ việc cập nhật trạng thái thanh toán bắt buộc phải thông qua Webhook PayOS đã xác thực chữ ký số HMAC.
    const { orderCode, invoiceId } = req.query || {};
    if (orderCode || invoiceId) {
      console.log(`[PaymentSuccess Redirect] User redirected back with orderCode: ${orderCode || 'N/A'}, invoiceId: ${invoiceId || 'N/A'}. Waiting for webhook confirmation.`);
    }
  } catch (error) {
    console.error("Lỗi paymentSuccess:", error);
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Thanh toán thành công - NeuroScan AI</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
        <style>
            body {
                font-family: 'Outfit', sans-serif;
                background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
                color: #f8fafc;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                padding: 20px;
                box-sizing: border-box;
            }
            .card {
                background: rgba(30, 41, 59, 0.7);
                backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 24px;
                padding: 40px;
                text-align: center;
                max-width: 480px;
                width: 100%;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                animation: fadeIn 0.6s ease-out;
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .icon-container {
                width: 80px;
                height: 80px;
                background: rgba(16, 185, 129, 0.1);
                border: 2px solid #10b981;
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                margin: 0 auto 24px;
                animation: scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.3s both;
            }
            @keyframes scaleIn {
                from { transform: scale(0); }
                to { transform: scale(1); }
            }
            .icon-container svg {
                width: 40px;
                height: 40px;
                stroke: #10b981;
            }
            h1 {
                font-size: 28px;
                font-weight: 800;
                margin: 0 0 12px;
                background: linear-gradient(to right, #34d399, #059669);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            p {
                color: #94a3b8;
                font-size: 16px;
                line-height: 1.6;
                margin: 0 0 32px;
            }
            .btn {
                display: inline-block;
                background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                color: white;
                text-decoration: none;
                padding: 14px 32px;
                border-radius: 12px;
                font-weight: 600;
                font-size: 16px;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                border: none;
                cursor: pointer;
                width: 100%;
                box-sizing: border-box;
            }
            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
                background: linear-gradient(135deg, #60a5fa 0%, #2563eb 100%);
            }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon-container">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
            </div>
            <h1>Thanh toán thành công</h1>
            <p>Giao dịch của bạn đã được xử lý an toàn thông qua PayOS. Hồ sơ bệnh án và lịch chụp MRI đã sẵn sàng để tiếp tục.</p>
            <button class="btn" onclick="window.location.href='http://localhost:8081'">Quay lại ứng dụng</button>
        </div>
    </body>
    </html>
  `);
};

// @desc    Trang HTML hiển thị thanh toán bị hủy
// @route   GET /api/v1/invoices/payment/cancel
// @access  Public
export const paymentCancel = async (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Thanh toán bị hủy - NeuroScan AI</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
        <style>
            body {
                font-family: 'Outfit', sans-serif;
                background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
                color: #f8fafc;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                padding: 20px;
                box-sizing: border-box;
            }
            .card {
                background: rgba(30, 41, 59, 0.7);
                backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 24px;
                padding: 40px;
                text-align: center;
                max-width: 480px;
                width: 100%;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                animation: fadeIn 0.6s ease-out;
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .icon-container {
                width: 80px;
                height: 80px;
                background: rgba(239, 68, 68, 0.1);
                border: 2px solid #ef4444;
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                margin: 0 auto 24px;
                animation: scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.3s both;
            }
            @keyframes scaleIn {
                from { transform: scale(0); }
                to { transform: scale(1); }
            }
            .icon-container svg {
                width: 40px;
                height: 40px;
                stroke: #ef4444;
            }
            h1 {
                font-size: 28px;
                font-weight: 800;
                margin: 0 0 12px;
                background: linear-gradient(to right, #f87171, #dc2626);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            p {
                color: #94a3b8;
                font-size: 16px;
                line-height: 1.6;
                margin: 0 0 32px;
            }
            .btn {
                display: inline-block;
                background: linear-gradient(135deg, #475569 0%, #1e293b 100%);
                color: white;
                text-decoration: none;
                padding: 14px 32px;
                border-radius: 12px;
                font-weight: 600;
                font-size: 16px;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(71, 85, 105, 0.3);
                border: none;
                cursor: pointer;
                width: 100%;
                box-sizing: border-box;
            }
            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(71, 85, 105, 0.4);
                background: linear-gradient(135deg, #64748b 0%, #334155 100%);
            }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon-container">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </div>
            <h1>Giao dịch bị hủy</h1>
            <p>Yêu cầu thanh toán của bạn đã bị hủy. Vui lòng thử lại nếu bạn muốn hoàn thành thanh toán dịch vụ.</p>
            <button class="btn" onclick="window.location.href='http://localhost:8081'">Quay lại ứng dụng</button>
        </div>
    </body>
    </html>
  `);
};

// ─────────────────────────────────────────────────────────────────────────────
// M.5 — Hoàn tiền hóa đơn (Full & Partial Refund, Drug FK Restock, Dual Approval, AML)
// PUT /api/v1/invoices/:id/refund
// @access Private (Receptionist, Admin)
// ─────────────────────────────────────────────────────────────────────────────
export const refundInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { refundReason, itemsToRefund, secondApproverId } = req.body;

    if (!["admin", "system_admin", "hospital_admin", "receptionist"].includes(req.user.role)) {
      return res.status(403).json({ message: "Không có quyền thực hiện hoàn tiền hóa đơn." });
    }

    const invoice = await Invoice.findById(id);
    if (!invoice) return res.status(404).json({ message: "Không tìm thấy hóa đơn." });

    if (!["admin", "system_admin"].includes(req.user.role) && invoice.hospitalId.toString() !== req.user.hospitalId) {
      return res.status(403).json({ message: "Không có quyền xử lý hóa đơn của bệnh viện khác." });
    }

    if (invoice.status === "hoàn trả" || invoice.status === "hủy") {
      return res.status(400).json({ message: `Hóa đơn này đã ở trạng thái '${invoice.status}'.` });
    }
    // Chỉ hoàn tiền hóa đơn bệnh nhân đã thực sự thanh toán
    if (invoice.status !== "đã thanh toán") {
      return res.status(400).json({ message: "Hóa đơn chưa được thanh toán nên không có tiền để hoàn trả." });
    }

    // [FIX BUG REFUND-01] Chỉ được hoàn tiền hóa đơn ĐÃ THU TIỀN:
    // - Hoàn cho hóa đơn "chờ thanh toán" sẽ ghi hoàn tiền cho tiền CHƯA TỪNG THU
    //   (refundAmount + notes "[HOÀN TIỀN TOÀN BỘ]..." + audit REFUND_APPROVED đều sai)
    //   và đánh isRefunded toàn bộ item, trong khi kho thì không bị ảnh hưởng —
    //   tạo sổ kế toán lệch chuẩn giữa tiền và kho.
    // - Hóa đơn "đang xử lý" (kẹt trừ kho VietQR/PayOS) phải đi luồng
    //   resolveProcessingInvoice (nhập kho bù hoặc hoàn tiền), không dùng refund.
    // Hóa đơn chưa thu tiền muốn bỏ → để nguyên / hủy, không hoàn tiền.
    if (invoice.status !== "đã thanh toán") {
      return res.status(400).json({
        message: `Không thể hoàn tiền: hóa đơn đang ở trạng thái '${invoice.status}'. Chỉ hóa đơn ĐÃ thanh toán mới được hoàn tiền; hóa đơn chưa thu tiền vui lòng bỏ qua hoặc xử lý theo luồng hủy.`,
      });
    }

    // 1. Phê duyệt 2 cấp cho hóa đơn giá trị cao (Dual Approval Workflow >= 10.000.000 VNĐ - Neuro-Oncology Protocol)
    if (invoice.totalAmount >= 10000000 && req.user.role === "receptionist") {
      if (secondApproverId && (secondApproverId.toString() === req.user.id.toString() || (invoice.refundApproval?.firstApproverId && secondApproverId.toString() === invoice.refundApproval.firstApproverId.toString()))) {
        return res.status(400).json({
          message: "Người phê duyệt cấp 2 (Kế toán trưởng / Ban Giám Đốc) phải khác người lập/yêu cầu cấp 1.",
        });
      }
      if (!secondApproverId && invoice.refundApproval?.approvalStatus !== "approved") {
        invoice.refundApproval = {
          requiresDualApproval: true,
          firstApproverId: req.user.id,
          approvalStatus: "pending_second_approval"
        };
        await invoice.save();
        return res.status(403).json({
          message: "Hóa đơn giá trị cao (≥ 10.000.000 VNĐ) yêu cầu phê duyệt 2 cấp (Kế toán trưởng / Ban Giám Đốc). Đã chuyển sang trạng thái chờ duyệt cấp 2.",
          approvalStatus: "pending_second_approval"
        });
      }
      if (secondApproverId) {
        if (!invoice.refundApproval) invoice.refundApproval = {};
        invoice.refundApproval.secondApproverId = secondApproverId;
        invoice.refundApproval.approvedAt = new Date();
        invoice.refundApproval.approvalStatus = "approved";
      }
    }

    // 2. Cảnh báo AML & Báo cáo Giao dịch đáng ngờ STR (Thông tư 35/2013/TT-NHNN >= 300.000.000 VNĐ)
    if (invoice.totalAmount >= 300000000) {
      const now = new Date();
      const strDeadline = new Date(now.getTime() + 48 * 3600 * 1000); // Báo cáo trong 48h
      const retentionUntil = new Date(now);
      retentionUntil.setFullYear(retentionUntil.getFullYear() + 5); // Lưu trữ tối thiểu 5 năm
      const strReportId = `STR-${invoice.hospitalId ? invoice.hospitalId.toString().slice(-4) : "HOSP"}-${Date.now()}`;

      invoice.amlReport = {
        isFlagged: true,
        flaggedAt: now,
        reportedToAuthority: false,
        strReportId,
        strDeadline,
        retentionUntil,
        reason: "Giao dịch y tế hoàn tiền quy mô lớn vượt ngưỡng 300 triệu VNĐ theo Thông tư 35/2013/TT-NHNN.",
        kycVerified: true,
        kycDetails: {
          fullName: req.body.patientFullName || "Chủ thể giao dịch",
          idCardNumber: req.body.patientIdCard || "N/A",
          nationality: "Việt Nam"
        }
      };
      try {
        await recordAuditLog({
          action: AUDIT_ACTIONS.AML_STR_REPORTED,
          entity: "Invoice",
          entityId: invoice._id,
          performedBy: req.user.id,
          hospitalId: req.user.hospitalId,
          details: `Lập hồ sơ STR phòng chống rửa tiền: ${strReportId}. Hạn chót báo cáo NHNN trong 48h (${strDeadline.toISOString()}). Thời hạn lưu trữ tối thiểu 5 năm theo TT35/2013/TT-NHNN.`
        });
      } catch (amlErr) {
        console.warn("[AML AuditLog Warn]", amlErr.message);
      }
    }

    // 3. Phân biệt Hoàn tiền từng phần (Partial Refund) vs Toàn bộ (Full Refund)
    const isPartial = Array.isArray(itemsToRefund) && itemsToRefund.length > 0;
    let targetDrugItems = [];
    let refundedAmount = 0;
    let grossRefundedNow = 0; // tổng giá trị (chưa tách BHYT) các dòng hoàn trong lần này
    // Chỉ hoàn phần bệnh nhân đã thực trả: phần BHYT chi trả không phải tiền của bệnh nhân (BHXH không thanh toán dịch vụ đã hủy)
    const totalForShare = invoice.totalAmount || 0;
    const patientPaid = invoice.patientPayAmount ?? (totalForShare - (invoice.bhytInfo?.bhytAmount || 0));
    const patientShare = totalForShare > 0 ? Math.max(0, Math.min(1, patientPaid / totalForShare)) : 1;

    if (isPartial) {
      invoice.items.forEach((item, index) => {
        const matchRefund = itemsToRefund.find(r => 
          (r.itemIndex !== undefined && r.itemIndex === index) ||
          (r.drugId && item.drugId && r.drugId.toString() === item.drugId.toString()) ||
          (r.description && item.description.includes(r.description))
        );
        if (matchRefund && !item.isRefunded) {
          item.isRefunded = true;
          item.refundedQuantity = matchRefund.quantity || item.quantity;
          const itemRefundPrice = (item.amount / (item.quantity || 1)) * item.refundedQuantity;
          grossRefundedNow += itemRefundPrice;
          refundedAmount += Math.round(itemRefundPrice * patientShare); // chỉ phần bệnh nhân đồng chi trả của dòng này
          if (item.type === "drug") {
            targetDrugItems.push({ ...item.toObject ? item.toObject() : item, refundQuantity: item.refundedQuantity });
          }
        }
      });
      invoice.isPartialRefund = true;
      invoice.refundAmount = (invoice.refundAmount || 0) + refundedAmount;
      const allItemsRefunded = invoice.items.every(i => i.isRefunded);
      invoice.status = allItemsRefunded ? "hoàn trả" : "đã thanh toán";
    } else {
      // Hoàn toàn bộ: trả lại đúng số bệnh nhân đã thanh toán (không gồm phần BHYT)
      refundedAmount = Math.round(patientPaid);
      invoice.items.forEach(item => {
        item.isRefunded = true;
        item.refundedQuantity = item.quantity;
      });
      targetDrugItems = (invoice.items || []).filter(item => item.type === "drug");
      invoice.isPartialRefund = false;
      invoice.refundAmount = refundedAmount;
      invoice.status = "hoàn trả";
    }

    // 3b. Phần BHYT của dịch vụ bị hoàn sẽ không được BHXH thanh toán → trả lại lũy kế cho thẻ & giảm phần BHYT trên hóa đơn
    const bhytOnInvoice = invoice.bhytInfo?.bhytAmount || 0;
    if (bhytOnInvoice > 0) {
      const bhytReleased = isPartial
        ? Math.min(bhytOnInvoice, Math.round(grossRefundedNow * (1 - patientShare)))
        : bhytOnInvoice;
      if (bhytReleased > 0 && invoice.bhytInfo?.bhytId) {
        try {
          const card = await BhytInfo.findById(invoice.bhytInfo.bhytId);
          if (card) {
            card.usedThisYear = Math.max(0, (card.usedThisYear || 0) - bhytReleased);
            await card.save();
          }
        } catch (bhytErr) {
          console.warn("⚠️ Không cập nhật được lũy kế BHYT khi hoàn tiền:", bhytErr.message);
        }
        invoice.bhytInfo.bhytAmount = bhytOnInvoice - bhytReleased;
      }
    }

    // 4. [BUG-08 REFACTOR] Hoàn trả tồn kho dược phẩm: CHỈ hoàn trả nếu kho ĐÃ TỪNG BỊ KHẤU TRỪ (stockDeductionStatus === 'DEDUCTED')
    // Nếu hóa đơn bị thiếu kho (SHORTAGE_FLAGGED) hoặc chưa trừ kho (PENDING), tuyệt đối không cộng kho để chống tạo tồn kho ma!
    if (targetDrugItems.length > 0) {
      if (invoice.stockDeductionStatus !== "DEDUCTED") {
        console.log(`[RefundInvoice] Hóa đơn ${invoice._id} chưa từng khấu trừ tồn kho (Trạng thái trừ kho: ${invoice.stockDeductionStatus}). Bỏ qua hoàn kho để chống tạo tồn kho ma.`);
      } else {
        try {
          const bulkOps = [];
        let quarantinedCount = 0;
        let restockedCount = 0;

        for (const item of targetDrugItems) {
          const qty = item.refundQuantity || item.quantity;
          const isPhysicallyDispensed = item.dispenseStatus === 'DISPENSED' || invoice.dispenseStatus === 'DISPENSED';

          if (item.drugId) {
            if (isPhysicallyDispensed) {
              // Quy chế Dược Bệnh viện (Thông tư 22/2011/TT-BYT & GPP):
              // Thuốc đã xuất vật lý ra khỏi quầy dược cho người bệnh TUYỆT ĐỐI KHÔNG hoàn lại kho cấp phát chính!
              // Tự động chuyển vào Kho Biệt Trữ / Cách Ly (quarantineStock) chờ kiểm định hoặc tiêu hủy.
              quarantinedCount++;
              bulkOps.push({
                updateOne: {
                  filter: { _id: item.drugId, hospitalId: invoice.hospitalId },
                  update: {
                    $inc: { "quarantineStock.quantity": qty },
                    $set: { "stock.lastUpdated": new Date() },
                    $push: {
                      stockMovements: {
                        type: "return_quarantine",
                        quantity: qty,
                        invoiceId: invoice._id,
                        performedBy: req.user.id,
                        reason: `[Quy chế Dược] Thuốc đã xuất vật lý cho người bệnh - Đưa vào Kho Biệt Trữ kiểm định tiêu hủy: ${refundReason || 'Hoàn tiền trả thuốc'}`,
                        timestamp: new Date()
                      }
                    }
                  }
                }
              });
            } else {
              // Thuốc chưa xuất kho vật lý (bệnh nhân hủy thanh toán trước khi quầy dược phát thuốc)
              // → Hoàn vị về ĐÚNG lô đã xuất (UC-PHA-06): item.batches ghi nguồn lô tại
              // thời điểm trừ kho; hóa đơn cũ không có breakdown → lô hết hạn sớm nhất.
              restockedCount++;
              const restockRes = await restockDrugBatch({
                drugId: item.drugId,
                qty,
                breakdown: Array.isArray(item.batches) && item.batches.length > 0 ? item.batches : null,
                performedBy: req.user.id,
                reason: `[Hủy trước khi phát thuốc] Hoàn kho cấp phát chính: ${refundReason || 'Hủy đơn thuốc'}`,
                invoiceId: invoice._id,
              });
              if (!restockRes.ok) {
                console.error(`⚠️ [RefundInvoice] Hoàn vị kho thất bại cho thuốc '${item.drugName || item.description}': ${restockRes.error}`);
              }
            }
          } else {
            // Fallback an toàn cho các hóa đơn cũ lưu dạng text description
            console.warn(`[LEGACY_REFUND_MIGRATION_WARN] Invoice ${invoice._id} item '${item.description}' using regex fallback. Migration deadline: 2026-12-31.`);
            const match = item.description?.match(/Thuốc:\s*(.+?)\s*\(SL:\s*(\d+)/i);
            if (match) {
              const drugName = match[1].trim();
              const parsedQty = parseInt(match[2], 10);
              if (drugName && !isNaN(parsedQty) && parsedQty > 0) {
                const escapedName = drugName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                bulkOps.push({
                  updateOne: {
                    filter: { hospitalId: invoice.hospitalId, name: new RegExp(`^${escapedName}$`, "i") },
                    update: {
                      $inc: { "stock.quantity": parsedQty },
                      $set: { "stock.lastUpdated": new Date() }
                    }
                  }
                });
              }
            }
          }
        }

        if (bulkOps.length > 0) {
          await Drug.bulkWrite(bulkOps);
          console.log(`[RefundInvoice] Đã xử lý tồn kho (${restockedCount} hoàn kho chính, ${quarantinedCount} đưa vào kho biệt trữ) cho hóa đơn ${invoice._id}`);
          
          try {
            await recordAuditLog({
              action: quarantinedCount > 0 ? "STOCK_QUARANTINED" : AUDIT_ACTIONS.STOCK_RESTOCKED,
              entity: "Drug",
              entityId: invoice._id,
              performedBy: req.user.id,
              hospitalId: req.user.hospitalId,
              details: `Xử lý hoàn tiền dược phẩm: ${restockedCount} loại thuốc chưa xuất vật lý hoàn kho chính, ${quarantinedCount} loại thuốc đã xuất vật lý đưa vào Kho Biệt Trữ kiểm định tiêu hủy theo quy chế GPP.`
            });
          } catch (stockLogErr) {
            console.warn("[Stock AuditLog Warn]", stockLogErr.message);
          }
        }
        } catch (stockErr) {
          console.error("⚠️ Lỗi hoàn trả kho thuốc khi refundInvoice:", stockErr);
        }
      }
    }

    invoice.refundReason = refundReason || 'Theo yêu cầu khách hàng';
    invoice.refundedAt = new Date();
    invoice.refundedBy = req.user.id;
    invoice.notes = `[HOÀN TIỀN ${isPartial ? 'MỘT PHẦN' : 'TOÀN BỘ'}] Số tiền: ${refundedAmount.toLocaleString('vi-VN')} VNĐ. Lý do: ${refundReason || 'N/A'}. Thực hiện bởi: ${req.user.id} vào ${new Date().toLocaleString('vi-VN')}`;
    await invoice.save();

    // 5. Ghi nhận chuỗi băm Audit Trail (TT46/2018/TT-BYT)
    try {
      await recordAuditLog({
        action: AUDIT_ACTIONS.REFUND_APPROVED,
        entity: "Invoice",
        entityId: invoice._id,
        performedBy: req.user.id,
        hospitalId: req.user.hospitalId,
        details: `Hoàn tiền hóa đơn viện phí (${invoice.isPartialRefund ? 'Một phần' : 'Toàn bộ'}). Số tiền hoàn: ${refundedAmount} VNĐ. Lý do: ${refundReason || 'N/A'}`
      });
    } catch (auditErr) {
      console.warn("⚠️ Lỗi ghi recordAuditLog cho refundInvoice:", auditErr.message);
    }

    // 6. (Đã dọn) Block EMRVersion cũ dùng sai schema (recordId/recordType không tồn tại
    // trong model → mọi create đều fail validation từ trước). Vết kiểm toán hoàn tiền
    // đã đầy đủ qua chuỗi hash recordAuditLog (REFUND_APPROVED) + invoice.notes phía trên.

    // UC-REC-04/09: gửi email thông báo hoàn tiền cho bệnh nhân
    let emailSent = false;
    try {
      const patientDoc = await User.findById(invoice.patientId).select("email profile.name profile.fullName").lean();
      emailSent = await sendRefundEmail({
        toEmail: patientDoc?.email,
        patientName: patientDoc?.profile?.name || patientDoc?.profile?.fullName || "Quý bệnh nhân",
        amount: refundedAmount,
        reason: refundReason,
        invoiceCode: String(invoice._id).slice(-8).toUpperCase(),
        isPartial,
      });
    } catch (mailErr) {
      console.warn("⚠️ Không gửi được email hoàn tiền:", mailErr.message);
    }

    return res.status(200).json({
      status: "success",
      message: isPartial ? "Hoàn tiền một phần thành công." : "Hoàn tiền toàn bộ hóa đơn thành công.",
      data: { invoice, refundedAmount, isPartial, emailSent }
    });
  } catch (error) {
    console.error("Lỗi refundInvoice:", error);
    return res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};



// @desc    UC-REC-05 — Cập nhật dịch vụ phát sinh vào hóa đơn đang chờ (hiện tại: tiền giường nội trú)
// @route   POST /api/v1/invoices/:id/sync
// @access  Private (Receptionist, Nurse, Hospital Admin, Admin)
export const syncInvoiceServices = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Không tìm thấy hóa đơn." });
    if (!["admin", "system_admin"].includes(req.user.role) && invoice.hospitalId.toString() !== String(req.user.hospitalId)) {
      return res.status(403).json({ message: "Không có quyền xử lý hóa đơn của bệnh viện khác." });
    }
    if (invoice.status !== "chờ thanh toán") {
      return res.status(400).json({ message: "Chỉ cập nhật được hóa đơn đang chờ thanh toán." });
    }

    const { HospitalBed } = await import("../hospital/models/hospitalBed.model.js");
    const hospital = await Hospital.findById(invoice.hospitalId).lean();
    const bedFee = hospital?.pricing?.bedFee ?? 300000;

    // Giường đang được bệnh nhân của lượt khám này sử dụng
    const bed = await HospitalBed.findOne({
      hospitalId: invoice.hospitalId,
      status: "occupied",
      $or: [{ currentVisitId: invoice.visitId }, { currentPatientId: invoice.patientId }],
    }).lean();

    const changes = [];

    // Thuốc theo đơn của bác sĩ (chưa tính tiền) → đưa vào hóa đơn để quầy thu đủ
    const drugSync = await syncPrescriptionDrugs(invoice);
    if (drugSync.changed) changes.push("tiền thuốc theo đơn");
    const others = invoice.items.filter((it) => it.type !== "bed");
    let items = others;
    if (bed) {
      const since = bed.admittedAt || bed.occupiedAt || invoice.createdAt;
      const days = Math.max(1, Math.ceil((Date.now() - new Date(since).getTime()) / 86400000));
      items = [...others, {
        description: `Giường bệnh ${bed.bedNumber} (${days} ngày × ${bedFee.toLocaleString("vi-VN")}đ)`,
        amount: days * bedFee,
        type: "bed",
        quantity: days,
        unitPrice: bedFee,
        unit: "ngày",
      }];
      changes.push(`Tiền giường ${bed.bedNumber}: ${days} ngày`);
    }

    invoice.items = items;
    invoice.totalAmount = items.reduce((sum, it) => sum + (it.amount || 0), 0);

    await invoice.save();

    // Tổng tiền có thể vừa đổi / hóa đơn chưa áp BHYT → tính lại phần BHYT theo thẻ hợp lệ của bệnh nhân
    const bhytAuto = await reconcileBhytAfterTotalChange(invoice);
    if (bhytAuto.applied) changes.push(`tự áp BHYT ${bhytAuto.coverageRate}%`);

    return res.status(200).json({
      success: true,
      message: changes.length ? `Đã cập nhật: ${changes.join(", ")}.` : "Không có dịch vụ phát sinh mới.",
      invoice,
      bhytAuto,
    });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi cập nhật dịch vụ phát sinh", error: error.message });
  }
};

// @desc    Lễ tân ghi nhận khoản chuyển khoản đối chiếu được trên sao kê ngân hàng
//          (tiền vào mã VietQR đã hủy / hết hạn mà PayOS không ghi nhận, hoặc bệnh nhân chuyển khoản trực tiếp)
// @route   POST /api/v1/invoices/:id/bank-transfer
// @access  Private (Receptionist, Hospital Admin, Admin)
export const recordBankTransfer = async (req, res) => {
  let lockedId = null;
  try {
    const reference = String(req.body.reference || "").trim();
    const amount = Math.round(Number(req.body.amount));
    const note = String(req.body.note || "").trim();
    if (!reference) return res.status(400).json({ message: "Vui lòng nhập mã giao dịch / số bút toán trên sao kê ngân hàng." });
    if (!(amount > 0)) return res.status(400).json({ message: "Số tiền chuyển khoản không hợp lệ." });

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Không tìm thấy hóa đơn." });
    if (!["admin", "system_admin"].includes(req.user.role) && String(invoice.hospitalId) !== String(req.user.hospitalId)) {
      return res.status(403).json({ message: "Không có quyền thao tác hóa đơn này." });
    }
    // Một giao dịch ngân hàng chỉ được ghi nhận cho một hóa đơn
    const usedRef = await Invoice.findOne({ hospitalId: invoice.hospitalId, "bankTransfers.reference": reference }).select("_id").lean();
    if (usedRef) {
      return res.status(409).json({ message: `Mã giao dịch "${reference}" đã được ghi nhận cho ${String(usedRef._id) === String(invoice._id) ? "hóa đơn này" : "một hóa đơn khác"}.` });
    }
    const entry = { reference, amount, note, recordedBy: req.user.id, recordedAt: new Date() };

    // Hóa đơn đã thanh toán / đã hoàn mà sao kê có thêm tiền → bệnh nhân trả trùng, cần hoàn khoản dư
    if (invoice.status !== "chờ thanh toán") {
      invoice.bankTransfers.push(entry);
      invoice.duplicatePayment = {
        flagged: true,
        detectedAt: new Date(),
        orderCode: null,
        amount,
        note: `Sao kê ghi nhận thêm ${amount.toLocaleString("vi-VN")}đ (mã GD ${reference}) trong khi hóa đơn đã ${invoice.status} (${invoice.paymentMethod || "—"}) → cần hoàn khoản dư cho bệnh nhân.`,
      };
      await invoice.save();
      return res.status(200).json({ message: "Đã ghi nhận chuyển khoản và gắn cờ THU TRÙNG — cần hoàn tiền cho bệnh nhân.", duplicate: true, invoice });
    }

    const lock = await Invoice.updateOne(
      { _id: invoice._id, status: "chờ thanh toán", $or: [{ payLock: null }, { payLock: { $lt: new Date(Date.now() - 60 * 1000) } }] },
      { $set: { payLock: new Date() } }
    );
    if (!lock.modifiedCount) return res.status(409).json({ message: "Hóa đơn đang được xử lý thanh toán ở một yêu cầu khác. Vui lòng tải lại." });
    lockedId = invoice._id;

    // Số tiền phải trả hiện tại (đã gồm thuốc theo đơn & BHYT)
    const drugSync = await syncPrescriptionDrugs(invoice);
    if (drugSync.changed) { await invoice.save(); await reconcileBhytAfterTotalChange(invoice); }
    const owed = Math.round(invoice.patientPayAmount ?? (invoice.totalAmount - (invoice.bhytInfo?.bhytAmount || 0)));
    if (amount < owed) {
      return res.status(400).json({ message: `Số tiền trên sao kê (${amount.toLocaleString("vi-VN")}đ) ít hơn số bệnh nhân phải trả (${owed.toLocaleString("vi-VN")}đ). Thu thêm phần còn thiếu trước khi ghi nhận.` });
    }

    // Mã VietQR còn chờ → hủy để không thu thêm lần nữa; mã đó cũng đã được trả → ghi nhận VietQR, khoản sao kê là thu trùng
    const released = await releasePayOSLink(invoice, "Đã nhận chuyển khoản (đối chiếu sao kê)");
    if (released.status === "PAID") {
      await markInvoicePaidByPayOS(invoice, "Check");
      invoice.bankTransfers.push(entry);
      invoice.duplicatePayment = {
        flagged: true,
        detectedAt: new Date(),
        orderCode: null,
        amount,
        note: `Hóa đơn đã được trả qua VietQR, sao kê ghi nhận thêm ${amount.toLocaleString("vi-VN")}đ (mã GD ${reference}) → cần hoàn khoản dư cho bệnh nhân.`,
      };
      await invoice.save();
      return res.status(200).json({ message: "Hóa đơn đã được trả qua VietQR — khoản chuyển khoản này được gắn cờ THU TRÙNG.", duplicate: true, invoice });
    }
    invoice.bankTransfers.push(entry);
    invoice.status = "đã thanh toán";
    invoice.paymentMethod = "chuyển khoản";
    invoice.paidAt = new Date();
    if (amount > owed) {
      invoice.duplicatePayment = {
        flagged: true,
        detectedAt: new Date(),
        orderCode: null,
        amount: amount - owed,
        note: `Bệnh nhân chuyển ${amount.toLocaleString("vi-VN")}đ, nhiều hơn số phải trả ${owed.toLocaleString("vi-VN")}đ → cần hoàn ${(amount - owed).toLocaleString("vi-VN")}đ.`,
      };
    }
    // Tiền đã về → trừ kho FEFO & đóng lượt khám; thiếu kho thì chuyển "đang xử lý" + báo dược sĩ thay vì chặn
    const result = await finalizeReceivedPayment(invoice, { userId: req.user.id, reason: `Chuyển khoản theo sao kê mã GD ${reference}`, label: `chuyển khoản ${reference}` });
    if (result === "retry") {
      return res.status(503).json({ message: "Lỗi hạ tầng tạm thời khi ghi nhận — vui lòng bấm ghi nhận lại sau ít giây." });
    }
    return res.status(200).json({
      message: result === "flagged"
        ? "Đã ghi nhận chuyển khoản nhưng chưa xuất được kho thuốc — hóa đơn chuyển 'đang xử lý', đã báo dược sĩ."
        : "Đã ghi nhận chuyển khoản, hóa đơn chuyển sang \"Đã thanh toán\".",
      invoice,
    });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi ghi nhận chuyển khoản", error: error.message });
  } finally {
    if (lockedId) await Invoice.updateOne({ _id: lockedId }, { $set: { payLock: null } }).catch(() => {});
  }
};
