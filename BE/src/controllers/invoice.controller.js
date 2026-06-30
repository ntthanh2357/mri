import { Invoice } from "../models/invoice.model.js";
import { Visit } from "../models/visit.model.js";
import { Hospital } from "../models/hospital.model.js";
import { MedicalRecord } from "../models/medicalRecord.model.js";
import { EMRVersion } from "../models/emrVersion.model.js";
import { User } from "../models/user.model.js";
import { Drug } from "../models/drug.model.js";
import { Prescription } from "../models/prescription.model.js";

// @desc    Lễ tân tạo hóa đơn và thanh toán
// @route   POST /api/v1/invoices/visit/:visitId
// @access  Private (Receptionist, Admin)
export const createAndPayInvoice = async (req, res) => {
  try {
    const { visitId } = req.params;
    const { paymentMethod } = req.body;
    
    const visit = await Visit.findById(visitId);
    if (!visit) return res.status(404).json({ message: "Không tìm thấy lượt khám" });
    
    if (visit.hospitalId.toString() !== req.user.hospitalId) {
      return res.status(403).json({ message: "Không có quyền" });
    }

    const existingInvoice = await Invoice.findOne({ visitId });
    if (existingInvoice && existingInvoice.status !== "hủy") {
      return res.status(400).json({ message: "Lượt khám này đã có hóa đơn." });
    }

    const hospital = await Hospital.findById(req.user.hospitalId);

    // Xây dựng items dịch vụ khám lâm sàng và hình ảnh
    let items = [{ description: "Khám bệnh", amount: hospital.pricing.examFee, type: "exam" }];
    if (visit.mriOrder && visit.mriOrder.orderedAt) {
      items.push({ description: "Chụp MRI", amount: hospital.pricing.mriFee, type: "mri" });
      if (visit.mriOrder.requestAiAnalysis) {
        items.push({ description: "Phân tích AI chẩn đoán", amount: hospital.pricing.aiFee, type: "ai" });
      }
    }

    // ── Tự động tính tiền thuốc từ Đơn thuốc đã kê trong lượt khám ───────────
    const prescription = await Prescription.findOne({
      patient_id: visit.patientId,
      createdAt: { $gte: visit.createdAt },
      isBilled: { $ne: true }
    });

    if (prescription && prescription.drugs && prescription.drugs.length > 0) {
      for (const pDrug of prescription.drugs) {
        // Tìm thông tin thuốc trong danh mục của bệnh viện
        const dbDrug = await Drug.findOne({
          hospitalId: req.user.hospitalId,
          name: { $regex: new RegExp(`^${pDrug.name.trim()}$`, "i") }
        });

        const unitPrice = dbDrug ? dbDrug.price : 0;
        const totalDrugPrice = unitPrice * pDrug.quantity;

        items.push({
          description: `Thuốc: ${pDrug.name} (SL: ${pDrug.quantity} ${pDrug.unit || 'Viên'})`,
          amount: totalDrugPrice,
          type: "drug"
        });

        // Trừ tồn kho nếu thuốc được cấu hình trong hệ thống
        if (dbDrug) {
          dbDrug.stock.quantity = Math.max(0, dbDrug.stock.quantity - pDrug.quantity);
          dbDrug.stock.lastUpdated = new Date();
          await dbDrug.save();
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

    // Map payment method to database enum (tiền mặt / chuyển khoản)
    let mappedMethod = "tiền mặt";
    if (paymentMethod === "transfer" || paymentMethod === "chuyển khoản") {
      mappedMethod = "chuyển khoản";
    }

    const invoice = new Invoice({
      hospitalId: req.user.hospitalId,
      patientId: visit.patientId,
      visitId,
      items,
      totalAmount,
      status: "đã thanh toán",
      paymentMethod: mappedMethod,
      paidAt: new Date()
    });

    await invoice.save();

    // Đánh dấu đơn thuốc đã được xuất hóa đơn
    if (prescription) {
      prescription.isBilled = true;
      prescription.invoiceId = invoice._id;
      await prescription.save();
    }

    visit.invoiceId = invoice._id;
    visit.status = "đã đóng";
    await visit.save();

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

    if (invoice.hospitalId.toString() !== req.user.hospitalId) {
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

        for (const pDrug of prescription.drugs) {
          const dbDrug = await Drug.findOne({
            hospitalId: req.user.hospitalId,
            name: { $regex: new RegExp(`^${pDrug.name.trim()}$`, "i") }
          });

          const unitPrice = dbDrug ? dbDrug.price : 0;
          const totalDrugPrice = unitPrice * pDrug.quantity;

          invoice.items.push({
            description: `Thuốc: ${pDrug.name} (SL: ${pDrug.quantity} ${pDrug.unit || 'Viên'})`,
            amount: totalDrugPrice,
            type: "drug"
          });

          // Trừ tồn kho thực tế
          if (dbDrug) {
            dbDrug.stock.quantity = Math.max(0, dbDrug.stock.quantity - pDrug.quantity);
            dbDrug.stock.lastUpdated = new Date();
            await dbDrug.save();
          }
        }

        // Cập nhật lại tổng tiền hóa đơn
        invoice.totalAmount = invoice.items.reduce((sum, item) => sum + item.amount, 0);

        // Đánh dấu đơn thuốc đã xuất hóa đơn
        prescription.isBilled = true;
        prescription.invoiceId = invoice._id;
        await prescription.save();
      }

      // Cập nhật trạng thái lượt khám
      visit.status = "đã đóng";
      await visit.save();
    }

    invoice.status = "đã thanh toán";
    
    // Map payment method to database enum (tiền mặt / chuyển khoản)
    let mappedMethod = "tiền mặt";
    if (paymentMethod === "transfer" || paymentMethod === "chuyển khoản") {
      mappedMethod = "chuyển khoản";
    }
    invoice.paymentMethod = mappedMethod;
    invoice.paidAt = new Date();
    
    await invoice.save();

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
              new: `Đã xác nhận thanh toán thành công cho bệnh nhân (Mã HS: ${medicalId || 'N/A'}, ID: ${invoice.patientId}) bởi Điều dưỡng / Lễ tân (ID: ${req.user._id})`
            }
          };

          const emrVersion = new EMRVersion({
            medicalRecordId: medicalRecord._id,
            version: medicalRecord.currentVersion || 1,
            modifiedBy: `${req.user?.profile?.name || req.user?.email || "Điều dưỡng / Lễ tân"} (ID: ${req.user?._id})`,
            changes,
          });
          
          await emrVersion.save();
          medicalRecord.currentVersion = nextVersion;
          await medicalRecord.save();
          console.log(`[Audit Log] Created EMRVersion v${nextVersion - 1} for payment confirmation by ${req.user?._id}.`);
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

