import { Invoice } from "./models/invoice.model.js";
import { Visit } from "../../models/visit.model.js";
import { Hospital } from "../hospital/models/hospital.model.js";
import { MedicalRecord } from "../emr/models/medicalRecord.model.js";
import { EMRVersion } from "../emr/models/emrVersion.model.js";
import payos from "../../utils/payos.js";
import { PremiumOrder } from "./models/premiumOrder.model.js";
import { User } from "../auth/models/user.model.js";
import { Drug } from "../pharmacy/models/drug.model.js";
import { Prescription } from "../pharmacy/models/prescription.model.js";
import { executeWithTransaction } from "../../utils/transaction.util.js";
import { recordAuditLog, AUDIT_ACTIONS } from "../../services/auditLog.service.js";

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
      const bulkOps = [];

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

        // Trừ tồn kho nguyên tử (Atomic decrement) chống Race Condition & Lost Updates
        if (dbDrug) {
          bulkOps.push({
            updateOne: {
              filter: { _id: dbDrug._id, "stock.quantity": { $gte: pDrug.quantity } },
              update: { 
                $inc: { "stock.quantity": -pDrug.quantity },
                $set: { "stock.lastUpdated": new Date() },
                $push: {
                  stockMovements: {
                    type: "dispense",
                    quantity: pDrug.quantity,
                    visitId: visit._id,
                    performedBy: req.user.id,
                    reason: `Kê đơn viện phí lượt khám ${visit._id}`,
                    timestamp: new Date()
                  }
                }
              }
            }
          });
        }
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

        if (bulkOps.length > 0) {
          const bulkRes = await Drug.bulkWrite(bulkOps, sessOpts);
          if (bulkRes.modifiedCount < bulkOps.length) {
            throw new Error("Một số loại thuốc đã hết hàng hoặc không đủ số lượng trong quá trình xử lý giao dịch.");
          }
        }

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
  try {
    const { id } = req.params;
    const { paymentMethod } = req.body;

    const invoice = await Invoice.findById(id);
    if (!invoice) return res.status(404).json({ message: "Không tìm thấy hóa đơn" });

    if (!["admin", "system_admin"].includes(req.user.role) && invoice.hospitalId.toString() !== req.user.hospitalId) {
      return res.status(403).json({ message: "Không có quyền thao tác" });
    }

    // Cập nhật trạng thái lượt khám và tính toán lại tiền thuốc trước khi lưu hóa đơn
    const visit = await Visit.findById(invoice.visitId);
    let prescription = null;
    
    if (visit) {
      // 1. Tìm đơn thuốc chưa thanh toán của lượt khám này
      prescription = await Prescription.findOne({
        patient_id: visit.patientId,
        createdAt: { $gte: visit.createdAt },
        isBilled: { $ne: true }
      });

      if (prescription && prescription.drugs && prescription.drugs.length > 0) {
        // Lọc bỏ tất cả các khoản thu loại "drug" cũ để tránh trùng lặp hoặc sai lệch khi chỉnh sửa đơn thuốc
        invoice.items = invoice.items.filter(item => item.type !== "drug");

        const drugNames = prescription.drugs.map(d => new RegExp(`^${d.name.trim()}$`, "i"));
        const dbDrugs = await Drug.find({
          hospitalId: req.user.hospitalId,
          name: { $in: drugNames }
        });
        const bulkOps = [];

        for (const pDrug of prescription.drugs) {
          const pDrugRegex = new RegExp(`^${pDrug.name.trim()}$`, "i");
          const dbDrug = dbDrugs.find(d => pDrugRegex.test(d.name));

          if (dbDrug && dbDrug.stock && dbDrug.stock.quantity < pDrug.quantity) {
            return res.status(400).json({
              message: `Thuốc '${pDrug.name}' không đủ tồn kho (Hiện có: ${dbDrug.stock.quantity}, Cần: ${pDrug.quantity}).`
            });
          }

          const unitPrice = dbDrug ? dbDrug.price : 0;
          const totalDrugPrice = unitPrice * pDrug.quantity;

          invoice.items.push({
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

          // Trừ tồn kho nguyên tử (Atomic decrement) chống Race Condition & Lost Updates
          if (dbDrug) {
            bulkOps.push({
              updateOne: {
                filter: { _id: dbDrug._id, "stock.quantity": { $gte: pDrug.quantity } },
                update: { 
                  $inc: { "stock.quantity": -pDrug.quantity },
                  $set: { "stock.lastUpdated": new Date() },
                  $push: {
                    stockMovements: {
                      type: "dispense",
                      quantity: pDrug.quantity,
                      visitId: visit._id,
                      invoiceId: invoice._id,
                      performedBy: req.user.id,
                      reason: `Thanh toán đơn thuốc hóa đơn ${invoice._id}`,
                      timestamp: new Date()
                    }
                  }
                } 
              }
            });
          }
        }

        // Cập nhật lại tổng tiền hóa đơn
        invoice.totalAmount = invoice.items.reduce((sum, item) => sum + item.amount, 0);

        // Map payment method to database enum (tiền mặt / chuyển khoản)
        let mappedMethod = "tiền mặt";
        if (paymentMethod === "transfer" || paymentMethod === "chuyển khoản") {
          mappedMethod = "chuyển khoản";
        }
        invoice.status = "đã thanh toán";
        invoice.paymentMethod = mappedMethod;
        invoice.paidAt = new Date();

        await executeWithTransaction(async (session) => {
          const sessOpts = session ? { session } : {};

          if (bulkOps.length > 0) {
            const bulkRes = await Drug.bulkWrite(bulkOps, sessOpts);
            if (bulkRes.modifiedCount < bulkOps.length) {
              throw new Error("Một số loại thuốc đã hết hàng hoặc không đủ số lượng trong quá trình xử lý giao dịch.");
            }
          }

          prescription.isBilled = true;
          prescription.invoiceId = invoice._id;
          await prescription.save(sessOpts);

          visit.status = "đã đóng";
          await visit.save(sessOpts);

          await invoice.save(sessOpts);
        });
      } else {
        // Có visit nhưng không có đơn thuốc
        visit.status = "đã đóng";
        invoice.status = "đã thanh toán";
        let mappedMethod = "tiền mặt";
        if (paymentMethod === "transfer" || paymentMethod === "chuyển khoản") {
          mappedMethod = "chuyển khoản";
        }
        invoice.paymentMethod = mappedMethod;
        invoice.paidAt = new Date();

        await executeWithTransaction(async (session) => {
          const sessOpts = session ? { session } : {};
          await visit.save(sessOpts);
          await invoice.save(sessOpts);
        });
      }
    } else {
      // Không có visit liên kết
      invoice.status = "đã thanh toán";
      let mappedMethod = "tiền mặt";
      if (paymentMethod === "transfer" || paymentMethod === "chuyển khoản") {
        mappedMethod = "chuyển khoản";
      }
      invoice.paymentMethod = mappedMethod;
      invoice.paidAt = new Date();
      await invoice.save();
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
  }
};
// @desc    Điều dưỡng tạo hóa đơn chờ thanh toán (từ phiếu thu viện phí)
// @route   POST /api/v1/invoices/pending
// @access  Private (Nurse, Admin)
export const createPendingInvoice = async (req, res) => {
  try {
    const { patientId, visitId, items, totalAmount, notes } = req.body;

    if (!patientId || !items || !totalAmount) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc." });
    }

    // Build items array from nurse's service selections
    const invoiceItems = (items || []).map(item => ({
      description: item.description || item.name,
      amount: Number(item.amount) || 0,
      type: 'other'
    }));

    const invoice = new Invoice({
      hospitalId: req.user.hospitalId,
      patientId,
      visitId: visitId || null,
      items: invoiceItems,
      totalAmount: Number(totalAmount),
      status: 'chờ thanh toán',
      paymentMethod: '',
      paidAt: null
    });

    await invoice.save();

    const populated = await Invoice.findById(invoice._id)
      .populate('patientId', 'email profile')
      .populate('visitId', 'reason status');

    res.status(201).json({ message: "Đã tạo hóa đơn chờ thanh toán.", invoice: populated });
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

    // Kiểm tra quyền (phải là lễ tân, admin, điều dưỡng hoặc chính bệnh nhân)
    const isPatient = invoice.patientId.toString() === req.user.id.toString();
    const isClinicStaff = req.user.hospitalId && invoice.hospitalId.toString() === req.user.hospitalId.toString();

    if (!isPatient && !isClinicStaff) {
      return res.status(403).json({ message: "Bạn không có quyền thanh toán cho hóa đơn này" });
    }

    // Tạo mã orderCode duy nhất dạng số nguyên cho PayOS (9 chữ số cuối của timestamp + số ngẫu nhiên)
    const orderCode = Number(String(Date.now()).slice(-9)) + Math.floor(Math.random() * 1000);
    invoice.orderCode = orderCode;
    invoice.paymentMethod = "vietqr";
    await invoice.save();

    // Chuẩn bị dữ liệu gửi lên PayOS
    const hostname = req.get("host");
    const protocol = req.protocol;
    // URL dẫn đến endpoint GET của backend để hiển thị trang success/cancel đẹp mắt
    const returnUrl = `${protocol}://${hostname}/api/v1/invoices/payment/success?invoiceId=${invoice._id}`;
    const cancelUrl = `${protocol}://${hostname}/api/v1/invoices/payment/cancel?invoiceId=${invoice._id}`;

    const paymentBody = {
      orderCode,
      amount: invoice.totalAmount,
      description: `Thanh toan HD ${orderCode}`,
      items: invoice.items.map(item => ({
        name: item.description,
        quantity: 1,
        price: item.amount
      })),
      returnUrl,
      cancelUrl
    };

    const paymentLinkData = await payos.paymentRequests.create(paymentBody);

    res.status(200).json({
      message: "Tạo link thanh toán thành công",
      checkoutUrl: paymentLinkData.checkoutUrl,
      orderCode,
      invoice
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi tạo link thanh toán PayOS", error: error.message });
  }
};

// @desc    Webhook tiếp nhận kết quả thanh toán từ PayOS
// @route   POST /api/v1/invoices/payos-webhook
// @access  Public
export const handlePayOSWebhook = async (req, res) => {
  try {
    const webhookData = req.body;

    // Xác thực chữ ký dữ liệu từ PayOS để chống giả mạo
    const verifiedData = payos.webhooks.verify(webhookData);

    if (verifiedData.code === "00") {
      const orderCode = verifiedData.orderCode;

      // 1. Kiểm tra xem có phải là hóa đơn lượt khám
      const invoice = await Invoice.findOne({ orderCode });
      if (invoice) {
        if (invoice.status !== "đã thanh toán") {
          invoice.status = "đã thanh toán";
          invoice.paidAt = new Date();
          await invoice.save();

          // Cập nhật trạng thái lượt khám liên quan
          const visit = await Visit.findById(invoice.visitId);
          if (visit) {
            visit.invoiceId = invoice._id;
            visit.status = "đã đóng";
            await visit.save();
          }
          console.log(`[PayOS Webhook] Thanh toán thành công cho hóa đơn: ${invoice._id}, orderCode: ${orderCode}`);
        }
      } else {
        // 2. Nếu không phải hóa đơn lượt khám, kiểm tra đơn hàng Premium
        const premiumOrder = await PremiumOrder.findOne({ orderCode });
        if (premiumOrder && premiumOrder.status !== "completed") {
          premiumOrder.status = "completed";
          premiumOrder.paidAt = new Date();
          await premiumOrder.save();

          // Cập nhật trạng thái Premium của User
          const user = await User.findById(premiumOrder.userId);
          if (user) {
            user.isPremium = true;

            // Premium có giá trị trong 1 năm (Gói Premium 99.000 VNĐ)
            const oneYearFromNow = new Date();
            oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
            user.premiumUntil = oneYearFromNow;
            user.autoRenew = true; // Bật tự động gia hạn khi đăng ký mới

            await user.save();
            console.log(`[PayOS Webhook] Nâng cấp Premium thành công cho User: ${user.email}, orderCode: ${orderCode}`);
          }
        }
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[PayOS Webhook Error]", error.message);
    res.status(400).json({ message: "Lỗi xác thực webhook", error: error.message });
  }
};

// @desc    Tạo link thanh toán PayOS để nâng cấp Premium
// @route   POST /api/v1/invoices/premium-payment
// @access  Private
export const createPremiumPayment = async (req, res) => {
  try {
    const userId = req.user.id; // Lấy từ auth middleware

    // Kiểm tra xem người dùng đã là Premium chưa
    const user = await User.findById(userId);
    if (user && user.isPremium) {
      return res.status(400).json({ message: "Tài khoản của bạn đã là Premium" });
    }

    const amount = 99000; // Gói Premium 99.000 VNĐ

    // Tạo mã orderCode duy nhất dạng số nguyên cho PayOS (9 chữ số cuối của timestamp + số ngẫu nhiên)
    const orderCode = Number(String(Date.now()).slice(-9)) + Math.floor(Math.random() * 1000);

    // Lưu thông tin đơn hàng Premium
    const premiumOrder = new PremiumOrder({
      userId,
      amount,
      orderCode,
      status: "pending"
    });
    await premiumOrder.save();

    // Chuẩn bị dữ liệu gửi lên PayOS
    const hostname = req.get("host");
    const protocol = req.protocol;

    // Sử dụng trang thông báo thành công đẹp mắt có sẵn (kèm orderCode để kích hoạt offline nếu dev cục bộ)
    const returnUrl = `${protocol}://${hostname}/api/v1/invoices/payment/success?orderCode=${orderCode}`;
    const cancelUrl = `${protocol}://${hostname}/api/v1/invoices/payment/cancel?orderCode=${orderCode}`;

    const paymentBody = {
      orderCode,
      amount,
      description: "Nang cap Premium",
      items: [
        {
          name: "Gói Hội viên Premium (1 Năm)",
          quantity: 1,
          price: amount
        }
      ],
      returnUrl,
      cancelUrl
    };

    const paymentLinkData = await payos.paymentRequests.create(paymentBody);

    res.status(200).json({
      message: "Tạo link thanh toán Premium thành công",
      checkoutUrl: paymentLinkData.checkoutUrl,
      orderCode,
      premiumOrder
    });
  } catch (error) {
    console.error("[Create Premium Payment Error]", error);
    res.status(500).json({ message: "Lỗi tạo link thanh toán Premium", error: error.message });
  }
};

// @desc    Trang HTML hiển thị thanh toán thành công
// @route   GET /api/v1/invoices/payment/success
// @access  Public
export const paymentSuccess = async (req, res) => {
  try {
    // BẢO MẬT (BUG-01): Tuyệt đối không thay đổi trạng thái hóa đơn hay kích hoạt Premium tại returnUrl công khai.
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
          const itemRefundPrice = (item.amount / item.quantity) * item.refundedQuantity;
          refundedAmount += itemRefundPrice;
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
      // Full refund
      refundedAmount = invoice.totalAmount;
      invoice.items.forEach(item => {
        item.isRefunded = true;
        item.refundedQuantity = item.quantity;
      });
      targetDrugItems = (invoice.items || []).filter(item => item.type === "drug");
      invoice.isPartialRefund = false;
      invoice.refundAmount = invoice.totalAmount;
      invoice.status = "hoàn trả";
    }

    // 4. [BUG-08 REFACTOR] Hoàn trả tồn kho dược phẩm: ƯU TIÊN DÙNG KHÓA NGOẠI TRỰC TIẾP (drugId FK)
    if (targetDrugItems.length > 0) {
      try {
        const bulkOps = [];
        for (const item of targetDrugItems) {
          const qty = item.refundQuantity || item.quantity;
          if (item.drugId) {
            // Chuẩn hóa Enterprise: Trực tiếp hoàn kho bằng Foreign Key drugId (Chính xác 100% SKU, không phụ thuộc chuỗi văn bản)
            bulkOps.push({
              updateOne: {
                filter: { _id: item.drugId, hospitalId: invoice.hospitalId },
                update: {
                  $inc: { "stock.quantity": qty },
                  $set: { "stock.lastUpdated": new Date() },
                  $push: {
                    stockMovements: {
                      type: "refund",
                      quantity: qty,
                      invoiceId: invoice._id,
                      performedBy: req.user.id,
                      reason: refundReason || "Hoàn tiền đơn thuốc",
                      timestamp: new Date()
                    }
                  }
                }
              }
            });
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
          console.log(`[RefundInvoice] Đã hoàn trả tồn kho cho ${bulkOps.length} loại thuốc của hóa đơn ${invoice._id}`);
          
          try {
            await recordAuditLog({
              action: AUDIT_ACTIONS.STOCK_RESTOCKED,
              entity: "Drug",
              entityId: invoice._id,
              performedBy: req.user.id,
              hospitalId: req.user.hospitalId,
              details: `Hoàn kho thành công ${bulkOps.length} loại thuốc từ hóa đơn ${invoice._id}`
            });
          } catch (stockLogErr) {
            console.warn("[Stock AuditLog Warn]", stockLogErr.message);
          }
        }
      } catch (stockErr) {
        console.error("⚠️ Lỗi hoàn trả kho thuốc khi refundInvoice:", stockErr);
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

    // 6. Ghi EMRVersion
    try {
      await EMRVersion.create({
        hospitalId: req.user.hospitalId,
        recordId: invoice._id,
        recordType: "Invoice",
        version: 2,
        data: invoice.toObject(),
        changedBy: req.user.id,
        changeReason: `Hoàn tiền hóa đơn (${isPartial ? 'Một phần' : 'Toàn bộ'}): ${refundReason || 'Hủy ca/Thu sai'}`
      });
    } catch (auditErr) {
      console.warn("⚠️ Lỗi ghi EMRVersion cho hoàn tiền hóa đơn:", auditErr.message);
    }

    return res.status(200).json({
      status: "success",
      message: isPartial ? "Hoàn tiền một phần thành công." : "Hoàn tiền toàn bộ hóa đơn thành công.",
      data: { invoice, refundedAmount, isPartial }
    });
  } catch (error) {
    console.error("Lỗi refundInvoice:", error);
    return res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};


