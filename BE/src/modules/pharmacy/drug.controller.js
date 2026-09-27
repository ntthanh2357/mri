import mongoose, { isValidObjectId } from "mongoose";
import { Drug } from "./models/drug.model.js";
import { User } from "../auth/models/user.model.js";
import { VitalSign } from "../emr/models/vitalSign.model.js";
import { successResponse, errorResponse } from "../../utils/response.util.js";
import { createNotificationInternal } from "../../controllers/notification.controller.js";
import { assessPrescriptionSafety } from "./services/drugSafety.service.js";

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