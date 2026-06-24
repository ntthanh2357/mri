import { Invoice } from "../models/invoice.model.js";
import { Visit } from "../models/visit.model.js";
import { Hospital } from "../models/hospital.model.js";

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

    const hospital = await Hospital.findById(req.user.hospitalId);

    // Xây dựng items
    let items = [{ description: "Khám bệnh", amount: hospital.pricing.examFee, type: "exam" }];
    if (visit.mriOrder && visit.mriOrder.orderedAt) {
      items.push({ description: "Chụp MRI", amount: hospital.pricing.mriFee, type: "mri" });
      if (visit.mriOrder.requestAiAnalysis) {
        items.push({ description: "Phân tích AI chẩn đoán", amount: hospital.pricing.aiFee, type: "ai" });
      }
    }

    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

    const invoice = new Invoice({
      hospitalId: req.user.hospitalId,
      patientId: visit.patientId,
      visitId,
      items,
      totalAmount,
      status: "đã thanh toán",
      paymentMethod,
      paidAt: new Date()
    });

    await invoice.save();

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

    invoice.status = "đã thanh toán";
    invoice.paymentMethod = paymentMethod || "cash";
    invoice.paidAt = new Date();
    await invoice.save();

    // Cập nhật trạng thái lượt khám
    const visit = await Visit.findById(invoice.visitId);
    if (visit) {
      visit.status = "đã đóng";
      await visit.save();
    }

    res.status(200).json({ message: "Thanh toán hóa đơn thành công", invoice });
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

