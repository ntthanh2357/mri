import mongoose, { isValidObjectId } from "mongoose";
import { Drug } from "./models/drug.model.js";
import { Prescription } from "./models/prescription.model.js";
import { Invoice } from "../billing/models/invoice.model.js";
import { User } from "../auth/models/user.model.js";
import { VitalSign } from "../emr/models/vitalSign.model.js";
import { successResponse, errorResponse } from "../../utils/response.util.js";
import { createNotificationInternal } from "../../controllers/notification.controller.js";
import { assessPrescriptionSafety } from "./services/drugSafety.service.js";
import { generateRemindersForPrescription } from "../../controllers/patient.controller.js";
import { deductStockForInvoice } from "../billing/invoice.controller.js";

// ── Helper: Lấy hospitalId từ user (Admin dùng query, hospital_admin dùng JWT) ─
function resolveHospitalId(req) {
  if (["admin", "system_admin"].includes(req.user.role) && req.query.hospitalId) {
    return req.query.hospitalId;
  }
  return req.user.hospitalId || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// DR-01: Lấy danh sách thuốc của bệnh viện
// GET /api/drugs
// @access hospital_admin, doctor, nurse, technician, admin
// ─────────────────────────────────────────────────────────────────────────────
export const getDrugs = async (req, res) => {
  try {
    const hospitalId = resolveHospitalId(req);
    if (!hospitalId) {
      return errorResponse(res, "Không xác định được bệnh viện.", 400);
    }

    const { search, category, lowStock, isActive } = req.query;

    // Build filter
    const filter = { hospitalId };
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { activeIngredient: { $regex: escaped, $options: "i" } },
        { manufacturer: { $regex: escaped, $options: "i" } },
      ];
    }
    // Lọc thuốc tồn kho thấp (< minStock)
    if (lowStock === "true") {
      filter.$expr = { $lt: ["$stock.quantity", "$stock.minStock"] };
    }

    const drugs = await Drug.find(filter)
      .sort({ name: 1 })
      .lean();

    return successResponse(res, { drugs, total: drugs.length }, "Lấy danh sách thuốc thành công.");
  } catch (error) {
    console.error("Lỗi getDrugs:", error);
    return errorResponse(res, "Lỗi hệ thống khi lấy danh sách thuốc.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DR-02: Xem chi tiết 1 thuốc
// GET /api/drugs/:id
// @access hospital_admin, doctor, nurse
// ─────────────────────────────────────────────────────────────────────────────
export const getDrugById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return errorResponse(res, "ID thuốc không hợp lệ.", 400);
    }

    const drug = await Drug.findById(id).lean();
    if (!drug) {
      return errorResponse(res, "Không tìm thấy thuốc.", 404);
    }

    // Ownership check
    if (!["admin", "system_admin"].includes(req.user.role) && drug.hospitalId.toString() !== req.user.hospitalId?.toString()) {
      return errorResponse(res, "Bạn không có quyền xem thuốc này.", 403);
    }

    return successResponse(res, { drug }, "Lấy thông tin thuốc thành công.");
  } catch (error) {
    console.error("Lỗi getDrugById:", error);
    return errorResponse(res, "Lỗi hệ thống.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DR-03: Thêm thuốc mới vào danh mục bệnh viện
// POST /api/drugs
// @access hospital_admin
// ─────────────────────────────────────────────────────────────────────────────
export const createDrug = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId; // Chỉ hospital_admin mới tạo → luôn dùng JWT
    if (!hospitalId) {
      return errorResponse(res, "Tài khoản chưa được gán bệnh viện.", 400);
    }

    const {
      name, activeIngredient, category, manufacturer,
      dosageInstructions, price, expiryDate, interactions,
      stock, bmiWarningThreshold
    } = req.body;

    if (!name || !name.trim()) {
      return errorResponse(res, "Tên thuốc không được để trống.", 400);
    }

    // Kiểm tra trùng tên trong cùng BV
    const existing = await Drug.findOne({ hospitalId, name: { $regex: new RegExp(`^${name.trim()}$`, "i") } });
    if (existing) {
      return errorResponse(res, `Thuốc "${name}" đã tồn tại trong danh mục bệnh viện.`, 409);
    }

    const drug = new Drug({
      hospitalId,
      name: name.trim(),
      activeIngredient: activeIngredient?.trim() || "",
      category: category || "other",
      manufacturer: manufacturer?.trim() || "",
      dosageInstructions: dosageInstructions?.trim() || "",
      price: Number(price) || 0,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      interactions: Array.isArray(interactions) ? interactions : [],
      bmiWarningThreshold: bmiWarningThreshold || { min: 18.5, max: 25.0 },
      stock: {
        quantity: Number(stock?.quantity) || 0,
        unit: stock?.unit || "Viên",
        minStock: Number(stock?.minStock) || 10,
        lastUpdated: new Date(),
      },
      isActive: true,
    });

    await drug.save();
    return successResponse(res, { drug }, "Thêm thuốc vào danh mục thành công!", 201);
  } catch (error) {
    console.error("Lỗi createDrug:", error);
    return errorResponse(res, "Lỗi hệ thống khi tạo thuốc.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DR-04: Cập nhật thông tin thuốc
// PUT /api/drugs/:id
// @access hospital_admin
// ─────────────────────────────────────────────────────────────────────────────
export const updateDrug = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return errorResponse(res, "ID thuốc không hợp lệ.", 400);
    }

    const drug = await Drug.findById(id);
    if (!drug) return errorResponse(res, "Không tìm thấy thuốc.", 404);

    // Ownership check
    if (!["admin", "system_admin"].includes(req.user.role) && drug.hospitalId.toString() !== req.user.hospitalId?.toString()) {
      return errorResponse(res, "Bạn không có quyền sửa thuốc này.", 403);
    }

    const {
      name, activeIngredient, category, manufacturer,
      dosageInstructions, price, expiryDate, interactions,
      bmiWarningThreshold, isActive
    } = req.body;

    // Kiểm tra trùng tên nếu đổi tên
    if (name && name.trim().toLowerCase() !== drug.name.toLowerCase()) {
      const dup = await Drug.findOne({ hospitalId: drug.hospitalId, name: { $regex: new RegExp(`^${name.trim()}$`, "i") }, _id: { $ne: id } });
      if (dup) return errorResponse(res, `Thuốc "${name}" đã tồn tại trong danh mục.`, 409);
      drug.name = name.trim();
    }

    if (activeIngredient !== undefined) drug.activeIngredient = activeIngredient.trim();
    if (category) drug.category = category;
    if (manufacturer !== undefined) drug.manufacturer = manufacturer.trim();
    if (dosageInstructions !== undefined) drug.dosageInstructions = dosageInstructions.trim();
    if (price !== undefined) drug.price = Number(price);
    if (expiryDate !== undefined) drug.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (Array.isArray(interactions)) drug.interactions = interactions;
    if (bmiWarningThreshold) drug.bmiWarningThreshold = bmiWarningThreshold;
    if (typeof isActive === "boolean") drug.isActive = isActive;

    await drug.save();
    return successResponse(res, { drug }, "Cập nhật thông tin thuốc thành công!");
  } catch (error) {
    console.error("Lỗi updateDrug:", error);
    return errorResponse(res, "Lỗi hệ thống khi cập nhật thuốc.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DR-05: Xóa thuốc khỏi danh mục
// DELETE /api/drugs/:id
// @access hospital_admin
// ─────────────────────────────────────────────────────────────────────────────
export const deleteDrug = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return errorResponse(res, "ID thuốc không hợp lệ.", 400);
    }

    const drug = await Drug.findById(id);
    if (!drug) return errorResponse(res, "Không tìm thấy thuốc.", 404);

    // Ownership check
    if (!["admin", "system_admin"].includes(req.user.role) && drug.hospitalId.toString() !== req.user.hospitalId?.toString()) {
      return errorResponse(res, "Bạn không có quyền xóa thuốc này.", 403);
    }

    await Drug.findByIdAndDelete(id);
    return successResponse(res, { deletedId: id }, `Đã xóa thuốc "${drug.name}" khỏi danh mục.`);
  } catch (error) {
    console.error("Lỗi deleteDrug:", error);
    return errorResponse(res, "Lỗi hệ thống khi xóa thuốc.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DR-06: Cập nhật tồn kho (nhập thêm / xuất bớt)
// POST /api/drugs/:id/stock
// @access hospital_admin
// ─────────────────────────────────────────────────────────────────────────────
export const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return errorResponse(res, "ID thuốc không hợp lệ.", 400);
    }

    const drug = await Drug.findById(id);
    if (!drug) return errorResponse(res, "Không tìm thấy thuốc.", 404);

    // Ownership check
    if (!["admin", "system_admin"].includes(req.user.role) && drug.hospitalId.toString() !== req.user.hospitalId?.toString()) {
      return errorResponse(res, "Bạn không có quyền cập nhật tồn kho thuốc này.", 403);
    }

    const { action, quantity, unit, minStock } = req.body;

    if (!["set", "add", "subtract"].includes(action)) {
      return errorResponse(res, "action phải là 'set', 'add' hoặc 'subtract'.", 400);
    }

    const qty = Number(quantity);
    if (isNaN(qty) || qty < 0) {
      return errorResponse(res, "Số lượng phải là số không âm.", 400);
    }

    if (action === "set") {
      drug.stock.quantity = qty;
    } else if (action === "add") {
      drug.stock.quantity += qty;
    } else if (action === "subtract") {
      if (drug.stock.quantity - qty < 0) {
        return errorResponse(res, `Không đủ tồn kho. Hiện có: ${drug.stock.quantity} ${drug.stock.unit}.`, 400);
      }
      drug.stock.quantity -= qty;
    }

    if (unit) drug.stock.unit = unit;
    if (minStock !== undefined) drug.stock.minStock = Number(minStock);
    drug.stock.lastUpdated = new Date();

    await drug.save();

    // Kiểm tra ngưỡng cảnh báo sau khi cập nhật
    const isLowStock = drug.stock.quantity < drug.stock.minStock;

    // ── Gửi thông báo tới Hospital Admin khi hết thuốc / sắp hết thuốc ───────
    if (isLowStock) {
      try {
        const admins = await User.find({ hospitalId: drug.hospitalId, role: "hospital_admin" }).lean();
        for (const admin of admins) {
          await createNotificationInternal({
            hospitalId: drug.hospitalId,
            recipientId: admin._id,
            type: "low_stock",
            title: "⚠️ Cảnh báo tồn kho dược phẩm",
            message: `Thuốc "${drug.name}" trong kho chỉ còn ${drug.stock.quantity} ${drug.stock.unit} (dưới ngưỡng an toàn ${drug.stock.minStock}). Vui lòng lập kế hoạch nhập thêm.`,
            relatedId: drug._id,
          });
        }
      } catch (notifErr) {
        console.warn("⚠️ Không thể gửi thông báo cảnh báo kho cho Admin:", notifErr.message);
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    return successResponse(res, {
      drug,
      isLowStock,
      stockStatus: isLowStock ? "LOW" : "OK",
      message: isLowStock
        ? `⚠️ Cảnh báo: Tồn kho "${drug.name}" chỉ còn ${drug.stock.quantity} ${drug.stock.unit} (dưới ngưỡng ${drug.stock.minStock}).`
        : `✅ Cập nhật tồn kho thành công. Còn ${drug.stock.quantity} ${drug.stock.unit}.`,
    }, "Cập nhật tồn kho thành công!");
  } catch (error) {
    console.error("Lỗi updateStock:", error);
    return errorResponse(res, "Lỗi hệ thống khi cập nhật tồn kho.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DR-07: Lấy danh sách cảnh báo tồn kho thấp
// GET /api/drugs/alerts/low-stock
// @access hospital_admin
// ─────────────────────────────────────────────────────────────────────────────
export const getLowStockAlerts = async (req, res) => {
  try {
    const hospitalId = resolveHospitalId(req);
    if (!hospitalId) return errorResponse(res, "Không xác định được bệnh viện.", 400);

    // MongoDB aggregation để so sánh quantity < minStock
    const alerts = await Drug.aggregate([
      {
        $match: {
          hospitalId: { $eq: mongoose.Types.ObjectId.createFromHexString(hospitalId.toString()) },
          isActive: true,
        },
      },
      {
        $match: {
          $expr: { $lt: ["$stock.quantity", "$stock.minStock"] },
        },
      },
      {
        $project: {
          name: 1, category: 1, "stock.quantity": 1, "stock.unit": 1,
          "stock.minStock": 1, "stock.lastUpdated": 1, expiryDate: 1,
          shortage: { $subtract: ["$stock.minStock", "$stock.quantity"] },
        },
      },
      { $sort: { shortage: -1 } },
    ]);

    return successResponse(res, { alerts, total: alerts.length }, "Lấy danh sách cảnh báo tồn kho thành công.");
  } catch (error) {
    console.error("Lỗi getLowStockAlerts:", error);
    return errorResponse(res, "Lỗi hệ thống.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Giữ lại hàm checkPrescription cũ (không thay đổi)
// POST /api/drugs/check-prescription
// ─────────────────────────────────────────────────────────────────────────────

// Danh mục thuốc mặc định chuyên khoa Ung Thư Não & Phẫu thuật Thần kinh
const defaultDrugs = [
  { name: "Temozolomide", category: "chemotherapy", dosageInstructions: "150mg - 200mg/m2/ngày x 5 ngày chu kỳ 28 ngày (Phác đồ Stupp)", interactions: ["Valproate"] },
  { name: "Mannitol", category: "anti_edema", dosageInstructions: "0.25g - 1g/kg truyền tĩnh mạch trong 30-60 phút chống phù não cấp", interactions: [] },
  { name: "Dexamethasone", category: "corticosteroid", dosageInstructions: "4mg - 16mg mỗi ngày uống sáng sau ăn chống phù não quanh u", interactions: [] },
  { name: "Bevacizumab", category: "chemotherapy", dosageInstructions: "10mg/kg truyền tĩnh mạch mỗi 2 tuần điều trị u thần kinh đệm tái phát", interactions: [] },
  { name: "Keppra", category: "anticonvulsant", dosageInstructions: "500mg - 1500mg mỗi ngày, chia 2 lần chống co giật do u não", interactions: ["Depakine", "Tegretol"] },
  { name: "Depakine", category: "anticonvulsant", dosageInstructions: "20mg - 30mg/kg/ngày", interactions: ["Keppra", "Phenobarbital", "Diazepam", "Temozolomide"] },
  { name: "Tegretol", category: "anticonvulsant", dosageInstructions: "200mg - 1200mg mỗi ngày", interactions: ["Keppra"] },
  { name: "Phenobarbital", category: "psychotropic", dosageInstructions: "50mg - 200mg uống trước khi đi ngủ", interactions: ["Depakine", "Diazepam", "Donepezil"] },
  { name: "Diazepam", category: "psychotropic", dosageInstructions: "2mg - 10mg mỗi ngày", interactions: ["Phenobarbital", "Depakine"] },
  { name: "Donepezil", category: "other", dosageInstructions: "5mg - 10mg uống tối trước ngủ", interactions: ["Phenobarbital"] },
];

export const checkPrescription = async (req, res) => {
  try {
    const { patientId, medications, orders, diagnosis, requestAi } = req.body;

    if (!patientId) {
      return errorResponse(res, "Thiếu thông tin bệnh nhân.", 400);
    }

    const safetyResult = await assessPrescriptionSafety({
      patientId,
      medications: medications || [],
      orders: orders || [],
      diagnosis: diagnosis || "",
      requestAi: !!requestAi
    });

    return successResponse(res, {
      warnings: safetyResult.warnings,
      classifications: safetyResult.classifications,
      safetyScore: safetyResult.safetyScore,
      status: safetyResult.status,
      evaluationCoverage: safetyResult.evaluationCoverage,
      sources: safetyResult.sources,
      bmi: safetyResult.patientContext?.bmi || null,
      allergies: safetyResult.patientContext?.allergies || ["Gadolinium"],
      patientContext: safetyResult.patientContext,
      openFdaDetails: safetyResult.openFdaDetails,
      aiConsultation: safetyResult.aiConsultation
    }, "Kiểm tra dược lâm sàng thông minh thành công.");
  } catch (error) {
    console.error("Lỗi checkPrescription:", error);
    return errorResponse(res, "Lỗi kiểm tra dược lâm sàng hệ thống.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PH-01: Lấy danh sách hàng đợi đơn thuốc quầy Dược (Pharmacy Queue)
// GET /api/drugs/queue
// @access pharmacist, hospital_admin, admin
// ─────────────────────────────────────────────────────────────────────────────
export const getPharmacyQueue = async (req, res) => {
  try {
    const hospitalId = resolveHospitalId(req);
    if (!hospitalId) return errorResponse(res, "Không xác định được bệnh viện.", 400);

    const { status } = req.query;
    const filter = { hospitalId };

    if (status) {
      filter.dispenseStatus = status;
    } else {
      // Mặc định lấy các đơn cần xử lý: chờ thẩm định, sẵn sàng phát, hoặc chờ phát
      filter.dispenseStatus = { 
        $in: ["AWAITING_PHARMACY_VERIFICATION", "READY", "PENDING_DISPENSE"] 
      };
    }

    const prescriptions = await Prescription.find(filter)
      .populate("patient_id", "profile email")
      .populate("doctorId", "profile email")
      .populate("invoiceId", "totalAmount status paymentMethod dispenseStatus")
      .sort({ createdAt: -1 })
      .lean();

    // Sắp xếp ưu tiên: CRITICAL và Cấp cứu lên đầu hàng đợi
    prescriptions.sort((a, b) => {
      const isCritA = a.clinicalSafety?.status === "CRITICAL" || a.clinicalSafety?.overrideCategory === "ACUTE_EMERGENCY";
      const isCritB = b.clinicalSafety?.status === "CRITICAL" || b.clinicalSafety?.overrideCategory === "ACUTE_EMERGENCY";
      if (isCritA && !isCritB) return -1;
      if (!isCritA && isCritB) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return successResponse(res, { prescriptions, total: prescriptions.length }, "Lấy hàng đợi quầy Dược thành công.");
  } catch (error) {
    console.error("Lỗi getPharmacyQueue:", error);
    return errorResponse(res, "Lỗi hệ thống khi lấy hàng đợi Dược.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PH-02: Dược sĩ thẩm định / Xác nhận kép đơn thuốc nguy cơ cao (Dual-Sign Verify)
// POST /api/drugs/prescriptions/:id/verify
// @access pharmacist, hospital_admin, admin
// ─────────────────────────────────────────────────────────────────────────────
export const verifyPrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const prescription = await Prescription.findById(id);
    if (!prescription) return errorResponse(res, "Không tìm thấy đơn thuốc.", 404);

    // 1. Chống tự xác nhận (Separation of Duties): Bác sĩ kê đơn không được tự duyệt cho chính mình
    if (prescription.doctorId && prescription.doctorId.toString() === req.user.id.toString()) {
      return errorResponse(res, "Bác sĩ kê đơn tuyệt đối không được đồng thời là người xác nhận kép (Dual-Sign) cho chính mình.", 403);
    }

    if (prescription.dispenseStatus === "DISPENSED") {
      return errorResponse(res, "Đơn thuốc đã được phát, không thể thẩm định lại.", 400);
    }

    const prevStatus = prescription.dispenseStatus;
    prescription.clinicalSafety.dualSignStatus = "VERIFIED";
    prescription.clinicalSafety.coSignedBy = req.user?.profile?.name || req.user?.email || "Dược sĩ lâm sàng";
    prescription.clinicalSafety.coSignedAt = new Date();

    prescription.verifiedBy = req.user.id;
    prescription.verifiedAt = new Date();
    prescription.verificationNote = note || "Dược sĩ lâm sàng đã rà soát và chấp thuận ghi đè chuyên môn.";

    // Chuyển trạng thái sang READY (sẵn sàng xuất phát khi bệnh nhân thanh toán)
    prescription.dispenseStatus = "READY";

    prescription.dispenseHistory.push({
      fromStatus: prevStatus,
      toStatus: "READY",
      performedBy: req.user.id,
      performerName: req.user?.profile?.name || req.user?.email || "Dược sĩ lâm sàng",
      reason: note || "Dược sĩ lâm sàng ký duyệt xác nhận kép (Dual-Sign Approved)",
      timestamp: new Date()
    });

    await prescription.save();

    return successResponse(res, { prescription }, "Dược sĩ lâm sàng đã thẩm định và ký duyệt đơn thuốc thành công!");
  } catch (error) {
    console.error("Lỗi verifyPrescription:", error);
    return errorResponse(res, "Lỗi hệ thống khi thẩm định đơn thuốc.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PH-03: Dược sĩ từ chối đơn thuốc nguy cơ cao (Reject Prescription)
// POST /api/drugs/prescriptions/:id/reject
// @access pharmacist, hospital_admin, admin
// ─────────────────────────────────────────────────────────────────────────────
export const rejectPrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 10) {
      return errorResponse(res, "Bắt buộc nhập lý do từ chối chuyên môn chi tiết (tối thiểu 10 ký tự).", 400);
    }

    const prescription = await Prescription.findById(id);
    if (!prescription) return errorResponse(res, "Không tìm thấy đơn thuốc.", 404);

    if (prescription.dispenseStatus === "DISPENSED") {
      return errorResponse(res, "Đơn thuốc đã được phát cho người bệnh, không thể từ chối.", 400);
    }

    const prevStatus = prescription.dispenseStatus;
    prescription.clinicalSafety.dualSignStatus = "REJECTED";
    prescription.dispenseStatus = "REJECTED_BY_PHARMACY";
    prescription.rejectionReason = reason.trim();

    prescription.dispenseHistory.push({
      fromStatus: prevStatus,
      toStatus: "REJECTED_BY_PHARMACY",
      performedBy: req.user.id,
      performerName: req.user?.profile?.name || req.user?.email || "Dược sĩ lâm sàng",
      reason: reason.trim(),
      timestamp: new Date()
    });

    await prescription.save();

    // Gửi thông báo trả về cho Bác sĩ điều trị
    if (prescription.doctorId) {
      try {
        await createNotificationInternal({
          hospitalId: prescription.hospitalId,
          recipientId: prescription.doctorId,
          type: "prescription_rejected",
          title: "❌ Đơn thuốc bị Khoa Dược từ chối duyệt",
          message: `Đơn thuốc của bệnh nhân chẩn đoán "${prescription.diagnosis}" bị Dược sĩ lâm sàng từ chối duyệt: ${reason.trim()}. Vui lòng xem xét điều chỉnh phác đồ!`,
          relatedId: prescription._id
        });
      } catch (notifErr) {
        console.warn("Không gửi được thông báo cho Bác sĩ:", notifErr.message);
      }
    }

    return successResponse(res, { prescription }, "Đã từ chối đơn thuốc và gửi phản hồi cho Bác sĩ điều trị.");
  } catch (error) {
    console.error("Lỗi rejectPrescription:", error);
    return errorResponse(res, "Lỗi hệ thống khi từ chối đơn thuốc.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// PH-04: Dược sĩ xác nhận phát thuốc vật lý cho người bệnh (Dispense Prescription)
// POST /api/drugs/prescriptions/:id/dispense
// @access pharmacist, hospital_admin, admin
// ─────────────────────────────────────────────────────────────────────────────
export const dispensePrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const { partiallyDispensed = false, dispensedItems = [] } = req.body;
    const now = new Date();

    const prescription = await Prescription.findById(id);
    if (!prescription) return errorResponse(res, "Không tìm thấy đơn thuốc.", 404);

    if (prescription.dispenseStatus === "DISPENSED") {
      return errorResponse(res, "Đơn thuốc này đã được phát hoàn tất trước đó.", 400);
    }

    if (prescription.dispenseStatus === "REJECTED_BY_PHARMACY") {
      return errorResponse(res, "Đơn thuốc đã bị Dược sĩ từ chối, không thể xuất phát.", 400);
    }

    // 1. Kiểm tra hạn sử dụng của thuốc trước khi giao (Chống phát thuốc quá hạn)
    for (const item of (prescription.drugs || [])) {
      const escapedDrugName = (item.name || "").replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const drugDoc = await Drug.findOne({
        hospitalId: prescription.hospitalId,
        name: new RegExp(`^${escapedDrugName}$`, "i")
      });
      if (drugDoc && drugDoc.expiryDate && new Date(drugDoc.expiryDate) < new Date()) {
        return errorResponse(
          res, 
          `[CẢNH BÁO AN TOÀN DƯỢC] Thuốc '${item.name}' đã hết hạn sử dụng (Hạn dùng: ${new Date(drugDoc.expiryDate).toLocaleDateString("vi-VN")}). Tuyệt đối cấm cấp phát cho người bệnh!`, 
          400
        );
      }
    }

    // 2. Kiểm tra chốt chặn Dual-Sign tại tầng phát thuốc
    if (prescription.clinicalSafety?.requiresDualSign) {
      const isDualSigned = prescription.clinicalSafety?.dualSignStatus === "VERIFIED";
      const isAcuteEmergency = prescription.clinicalSafety?.overrideCategory === "ACUTE_EMERGENCY";

      if (!isDualSigned && !isAcuteEmergency) {
        return errorResponse(
          res,
          "Đơn thuốc có cảnh báo lâm sàng mức CRITICAL chưa được Dược sĩ lâm sàng ký duyệt (Dual-Sign). Không thể phát thuốc cho người bệnh.",
          403
        );
      }

      // Xử lý ngoại lệ Cấp cứu (ACUTE_EMERGENCY): Cho phát thuốc trước, kích hoạt cờ hậu kiểm bắt buộc trong 24h
      if (!isDualSigned && isAcuteEmergency) {
        prescription.postHocReviewRequired = true;
        prescription.postHocDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
        console.warn(`[EMERGENCY_DISPENSE] Đơn thuốc cấp cứu ${prescription._id} được phát trước, kích hoạt cờ hậu kiểm trong 24h.`);
      }
    }

    // 3. Kiểm tra trạng thái thanh toán viện phí (Payment check)
    let linkedInvoice = null;
    if (prescription.invoiceId) {
      linkedInvoice = await Invoice.findById(prescription.invoiceId);
    } else {
      linkedInvoice = await Invoice.findOne({
        patientId: prescription.patient_id,
        "items.type": "drug"
      }).sort({ createdAt: -1 });
    }

    const isAcuteEmergency = prescription.clinicalSafety?.overrideCategory === "ACUTE_EMERGENCY";
    const isEmergencyDebt = linkedInvoice && (linkedInvoice.billingType === "emergency_debt" || linkedInvoice.paymentMethod === "ghi nợ cấp cứu");

    // Miễn viện phí / BHYT 100% / Thử nghiệm lâm sàng / Tài trợ từ thiện có nguồn gốc xác thực
    const isVerifiedCharity = 
      linkedInvoice?.billingType === "charity" &&
      linkedInvoice?.charityApproval?.isApproved === true &&
      Boolean(linkedInvoice?.charityApproval?.programCode || linkedInvoice?.charityApproval?.approvedBy);

    const isVerifiedTrial = 
      ["clinical_trial", "sponsored"].includes(linkedInvoice?.billingType) &&
      Boolean(linkedInvoice?.clinicalTrialProtocol?.protocolId) &&
      Boolean(linkedInvoice?.clinicalTrialProtocol?.sponsorContractId || linkedInvoice?.clinicalTrialProtocol?.sponsorName);

    const isCardNotExpired = !linkedInvoice?.bhytInfo?.cardExpiryDate || new Date(linkedInvoice.bhytInfo.cardExpiryDate) >= new Date();
    const isCardValidFormat = Boolean(linkedInvoice?.bhytInfo?.cardNumber && linkedInvoice.bhytInfo.cardNumber.trim().length >= 10);
    const isVerifiedBHYT100 = linkedInvoice &&
      linkedInvoice.patientPayAmount === 0 &&
      linkedInvoice.bhytInfo?.coverageRate === 100 &&
      linkedInvoice.bhytInfo?.isCardValid !== false &&
      isCardNotExpired &&
      isCardValidFormat &&
      !linkedInvoice.items?.some(it => it.type === 'drug' && (it.insuranceCoverage?.patientCopayAmount > 0 || (it.insuranceCoverage?.coverageRate || 0) < 100));

    const isZeroCopay = isVerifiedCharity || isVerifiedTrial || isVerifiedBHYT100;

    // Nguyên tắc cấp cứu y khoa (Luật Khám bệnh, chữa bệnh): Cấp cứu đe dọa tính mạng không được trì hoãn vì viện phí
    const isInvoiceSettled = 
      linkedInvoice && 
      (linkedInvoice.status === "đã thanh toán" || isZeroCopay || isEmergencyDebt);

    // Nếu không phải ca cấp cứu và hóa đơn chưa thanh toán -> Chặn phát thuốc tại quầy
    if (!isInvoiceSettled && !isAcuteEmergency) {
      return errorResponse(
        res, 
        `Hóa đơn viện phí chưa được thanh toán hoàn tất (Trạng thái: ${linkedInvoice ? linkedInvoice.status : 'Chưa có hóa đơn'}). Bệnh nhân phải hoàn tất viện phí trước khi quầy Dược giao thuốc.`, 
        400
      );
    }

    // Nếu là ca cấp cứu: Ưu tiên xuất thuốc cứu người trước theo nguyên tắc cấp cứu y khoa.
    // Đồng thời TRỪ KHO VẬT LÝ TỪNG DÒNG THUỐC CỦA ĐƠN THUỐC NÀY để sổ sách phản ánh đúng thực tế quầy:
    if (isAcuteEmergency) {
      for (const pDrug of (prescription.drugs || [])) {
        const qty = pDrug.quantity || 1;
        const escapedDrugName = (pDrug.name || "").replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        const drugDoc = await Drug.findOne({
          hospitalId: prescription.hospitalId,
          name: new RegExp(`^${escapedDrugName}$`, "i")
        });

        if (drugDoc) {
          const currentQty = drugDoc.stock?.quantity || 0;
          const hasEnough = currentQty >= qty;

          if (hasEnough) {
            await Drug.findOneAndUpdate(
              { _id: drugDoc._id, "stock.quantity": { $gte: qty } },
              {
                $inc: { "stock.quantity": -qty },
                $set: { "stock.lastUpdated": new Date() },
                $push: {
                  stockMovements: {
                    type: "dispense",
                    quantity: qty,
                    balanceAfter: currentQty - qty,
                    invoiceId: linkedInvoice?._id || null,
                    reason: `[Cấp cứu khẩn cấp - Luật KCB] Xuất thuốc cấp cứu đơn ${prescription._id}`,
                    timestamp: new Date()
                  }
                }
              }
            );
          } else {
            // Thiếu tồn kho trong cấp cứu nguy kịch: Không chặn cứu người, xuất số hiện có và bắn cảnh báo khẩn cấp
            console.error(`🚨 [CẤP CỨU THIẾU KHO SỔ SÁCH] Thuốc '${pDrug.name}' cần ${qty} nhưng kho chỉ có ${currentQty}.`);
            await Drug.findOneAndUpdate(
              { _id: drugDoc._id },
              {
                $set: { "stock.quantity": 0, "stock.lastUpdated": new Date() },
                $push: {
                  stockMovements: {
                    type: "dispense",
                    quantity: currentQty,
                    balanceAfter: 0,
                    invoiceId: linkedInvoice?._id || null,
                    reason: `[Cấp cứu khẩn cấp - Lệch kho] Xuất ${currentQty}/${qty} hộp thuốc cấp cứu cứu người. Cần kiểm kê!`,
                    timestamp: new Date()
                  }
                }
              }
            );

            try {
              const chiefs = await User.find({ hospitalId: prescription.hospitalId, role: { $in: ["hospital_admin", "admin", "pharmacist"] } });
              for (const chief of chiefs) {
                await createNotificationInternal({
                  hospitalId: prescription.hospitalId,
                  recipientId: chief._id,
                  type: "stock_shortage",
                  title: "🚨 Báo động lệch kho cấp cứu (Emergency Variance Alert)",
                  message: `Thuốc cấp cứu '${pDrug.name}' (Đơn ${prescription._id}) đã được xuất phát cứu người bệnh nhưng sổ sách thiếu tồn kho (Yêu cầu: ${qty}, Thực tế có: ${currentQty}). Đề nghị Dược sĩ kiểm kê và nhập bù tồn kho gấp!`,
                  relatedId: prescription._id
                });
              }
            } catch (notifErr) {
              console.error("[Emergency Shortage Notif Error]", notifErr.message);
            }
          }
        }
      }

      // Cập nhật trạng thái dòng thuốc trên hóa đơn liên kết (để thanh toán sau không trừ lại)
      if (linkedInvoice) {
        let allItemsDispensed = true;
        if (Array.isArray(linkedInvoice.items)) {
          linkedInvoice.items.forEach(it => {
            const matchesDrug = (prescription.drugs || []).some(pd => 
              pd.name && (it.drugName || it.description || "").toLowerCase().includes(pd.name.toLowerCase())
            );
            if (matchesDrug) {
              it.dispenseStatus = "DISPENSED";
              it.dispensedAt = now;
              it.dispensedBy = req.user.id;
            } else if (it.type === "drug" && it.dispenseStatus !== "DISPENSED") {
              allItemsDispensed = false;
            }
          });
        }
        if (allItemsDispensed) {
          linkedInvoice.stockDeductionStatus = "DEDUCTED";
        }
        linkedInvoice.paymentNotes = (linkedInvoice.paymentNotes || "") + " | [Cấp cứu khẩn cấp - Luật KCB] Đã trừ kho cấp cứu tại quầy; chờ quyết toán viện phí.";
        await linkedInvoice.save();
      }
    }

    // 4. Cập nhật trạng thái DISPENSED hoặc PARTIALLY_DISPENSED
    const prevStatus = prescription.dispenseStatus;
    const targetStatus = partiallyDispensed ? "PARTIALLY_DISPENSED" : "DISPENSED";
    prescription.dispenseStatus = targetStatus;
    prescription.dispensedAt = now;
    prescription.dispensedBy = req.user.id;

    prescription.dispenseHistory.push({
      fromStatus: prevStatus,
      toStatus: targetStatus,
      performedBy: req.user.id,
      performerName: req.user?.profile?.name || req.user?.email || "Dược sĩ quầy",
      reason: prescription.postHocReviewRequired 
        ? "[Cấp cứu] Phát thuốc trước khẩn cấp, đưa vào hàng đợi hậu kiểm Dược 24h" 
        : (partiallyDispensed ? "Phát thuốc từng phần (do thiếu số lượng hoặc người bệnh hoãn một số thuốc)" : "Đã kiểm tra đối chiếu và giao thuốc vật lý cho người bệnh"),
      timestamp: now
    });

    await prescription.save();

    // 5. Đồng bộ hóa sang hóa đơn nếu có (theo từng dòng thuốc khớp với đơn)
    if (linkedInvoice) {
      linkedInvoice.dispensedAt = now;
      linkedInvoice.dispensedBy = req.user.id;
      if (Array.isArray(linkedInvoice.items)) {
        linkedInvoice.items.forEach(it => {
          if (it.type === "drug") {
            const matchesDrug = (prescription.drugs || []).some(pd => 
              pd.name && (it.drugName || it.description || "").toLowerCase().includes(pd.name.toLowerCase())
            );
            if (matchesDrug) {
              it.dispenseStatus = targetStatus;
              it.dispensedAt = now;
              it.dispensedBy = req.user.id;
            }
          }
        });

        const drugItems = linkedInvoice.items.filter(it => it.type === "drug");
        const allDispensed = drugItems.length > 0 && drugItems.every(it => it.dispenseStatus === "DISPENSED");
        const anyDispensed = drugItems.some(it => it.dispenseStatus === "DISPENSED" || it.dispenseStatus === "PARTIALLY_DISPENSED");

        linkedInvoice.dispenseStatus = allDispensed ? "DISPENSED" : (anyDispensed ? "PARTIALLY_DISPENSED" : "PENDING");
      } else {
        linkedInvoice.dispenseStatus = targetStatus;
      }
      await linkedInvoice.save();
    }

    // 6. TỰ ĐỘNG KÍCH HOẠT LỊCH NHẮC UỐNG THUỐC TẠI ĐÚNG THỜI ĐIỂM PHÁT THUỐC (Cách ly lỗi)
    try {
      await generateRemindersForPrescription(prescription);
      console.log(`[MedicationReminders] Đã sinh lịch nhắc thuốc cho bệnh nhân ${prescription.patient_id} tính từ mốc phát thuốc ${now.toISOString()}`);
    } catch (reminderErr) {
      console.error("Lỗi sinh lịch nhắc thuốc sau phát thuốc:", reminderErr.message);
    }

    return successResponse(res, { prescription, invoice: linkedInvoice }, `Đã hoàn tất xuất phát thuốc (${targetStatus}) cho người bệnh và kích hoạt lịch uống thuốc.`);
  } catch (error) {
    console.error("Lỗi dispensePrescription:", error);
    return errorResponse(res, "Lỗi hệ thống khi phát thuốc.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PH-05: Dược sĩ hậu kiểm đơn thuốc cấp cứu 24h (Post-hoc Review)
// POST /api/drugs/prescriptions/:id/post-hoc-review
// @access pharmacist, hospital_admin, admin
// ─────────────────────────────────────────────────────────────────────────────
export const postHocReviewPrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const { note, decision } = req.body; // decision: "APPROVED" | "FLAGGED_DEVIATION"

    const prescription = await Prescription.findById(id);
    if (!prescription) return errorResponse(res, "Không tìm thấy đơn thuốc.", 404);

    if (!prescription.postHocReviewRequired && !prescription.postHocReviewedAt) {
      return errorResponse(res, "Đơn thuốc này không thuộc diện yêu cầu hậu kiểm Dược.", 400);
    }

    // Kiểm tra Phân nhiệm độc lập (Separation of Duties): Dược sĩ phát thuốc không được tự mình hậu kiểm
    if (prescription.dispensedBy && prescription.dispensedBy.toString() === req.user.id && !["admin", "system_admin"].includes(req.user.role)) {
      return errorResponse(res, "Dược sĩ phát thuốc cấp cứu không được tự mình thực hiện hậu kiểm (Vi phạm nguyên tắc Separation of Duties). Cần Dược sĩ lâm sàng độc lập khác thẩm định.", 403);
    }

    prescription.postHocReviewedAt = new Date();
    prescription.postHocReviewedBy = req.user.id;
    prescription.postHocReviewNote = note || `Dược sĩ lâm sàng đã hậu kiểm đơn thuốc cấp cứu (Quyết định: ${decision || 'DUYỆT'}).`;
    prescription.postHocReviewRequired = false;

    prescription.dispenseHistory.push({
      fromStatus: prescription.dispenseStatus,
      toStatus: prescription.dispenseStatus,
      performedBy: req.user.id,
      performerName: req.user?.profile?.name || req.user?.email || "Dược sĩ lâm sàng",
      reason: `[Hậu kiểm Dược 24h - ${decision || 'APPROVED'}]: ${prescription.postHocReviewNote}`,
      timestamp: new Date()
    });

    await prescription.save();
    return successResponse(res, { prescription }, "Đã hoàn tất hậu kiểm dược cho đơn thuốc cấp cứu.");
  } catch (error) {
    console.error("Lỗi postHocReviewPrescription:", error);
    return errorResponse(res, "Lỗi hệ thống khi hậu kiểm đơn thuốc.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PH-06: Thống kê tần suất Override & Cấp cứu theo Bác sĩ (Audit & Governance)
// GET /api/drugs/audit/override-stats
// @access pharmacist, hospital_admin, admin
// ─────────────────────────────────────────────────────────────────────────────
export const getDoctorOverrideStats = async (req, res) => {
  try {
    const hospitalId = resolveHospitalId(req);
    if (!hospitalId) return errorResponse(res, "Không xác định được bệnh viện.", 400);

    const stats = await Prescription.aggregate([
      { 
        $match: { 
          hospitalId: { $eq: mongoose.Types.ObjectId.createFromHexString(hospitalId.toString()) },
          "clinicalSafety.isOverridden": true
        } 
      },
      {
        $group: {
          _id: "$doctorId",
          totalOverrides: { $sum: 1 },
          acuteEmergencyCount: {
            $sum: { $cond: [{ $eq: ["$clinicalSafety.overrideCategory", "ACUTE_EMERGENCY"] }, 1, 0] }
          },
          benefitExceedsRiskCount: {
            $sum: { $cond: [{ $eq: ["$clinicalSafety.overrideCategory", "BENEFIT_EXCEEDS_RISK"] }, 1, 0] }
          },
          toleratedPreviouslyCount: {
            $sum: { $cond: [{ $eq: ["$clinicalSafety.overrideCategory", "TOLERATED_PREVIOUSLY"] }, 1, 0] }
          },
          alternativeUnavailableCount: {
            $sum: { $cond: [{ $eq: ["$clinicalSafety.overrideCategory", "ALTERNATIVE_UNAVAILABLE"] }, 1, 0] }
          },
          pendingPostHocCount: {
            $sum: { $cond: [{ $eq: ["$postHocReviewRequired", true] }, 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "doctor"
        }
      },
      { $unwind: { path: "$doctor", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          doctorId: "$_id",
          doctorName: { $ifNull: ["$doctor.profile.name", "$doctor.email"] },
          totalOverrides: 1,
          acuteEmergencyCount: 1,
          acuteEmergencyRate: {
            $cond: [
              { $gt: ["$totalOverrides", 0] },
              { $multiply: [{ $divide: ["$acuteEmergencyCount", "$totalOverrides"] }, 100] },
              0
            ]
          },
          benefitExceedsRiskCount: 1,
          toleratedPreviouslyCount: 1,
          alternativeUnavailableCount: 1,
          pendingPostHocCount: 1,
          alertFlag: {
            $cond: [
              {
                $or: [
                  { $gte: ["$acuteEmergencyCount", 5] },
                  { $and: [{ $gte: ["$totalOverrides", 5] }, { $gte: ["$acuteEmergencyRate", 30] }] }
                ]
              },
              "HIGH_EMERGENCY_OVERRIDE_FREQUENCY",
              "NORMAL"
            ]
          }
        }
      },
      { $sort: { acuteEmergencyCount: -1, totalOverrides: -1 } }
    ]);

    return successResponse(res, { stats, totalDoctors: stats.length }, "Lấy thống kê ghi đè lâm sàng theo bác sĩ thành công.");
  } catch (error) {
    console.error("Lỗi getDoctorOverrideStats:", error);
    return errorResponse(res, "Lỗi hệ thống khi lấy thống kê ghi đè.", 500);
  }
};