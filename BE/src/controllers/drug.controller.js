import mongoose, { isValidObjectId } from "mongoose";
import { Drug } from "../models/drug.model.js";
import { User } from "../models/user.model.js";
import { VitalSign } from "../models/vitalSign.model.js";
import { successResponse, errorResponse } from "../utils/response.util.js";
import { createNotificationInternal } from "./notification.controller.js";

// ── Helper: Lấy hospitalId từ user (Admin dùng query, hospital_admin dùng JWT) ─
function resolveHospitalId(req) {
  if (req.user.role === "admin" && req.query.hospitalId) {
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
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { activeIngredient: { $regex: search, $options: "i" } },
        { manufacturer: { $regex: search, $options: "i" } },
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
    if (req.user.role !== "admin" && drug.hospitalId.toString() !== req.user.hospitalId?.toString()) {
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
    if (drug.hospitalId.toString() !== req.user.hospitalId?.toString()) {
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
    if (drug.hospitalId.toString() !== req.user.hospitalId?.toString()) {
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
    if (drug.hospitalId.toString() !== req.user.hospitalId?.toString()) {
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

// Danh mục thuốc mặc định phục vụ kiểm tra lâm sàng thần kinh
const defaultDrugs = [
  { name: "Keppra", category: "anticonvulsant", dosageInstructions: "500mg - 1500mg mỗi ngày, chia 2 lần", interactions: ["Depakine", "Tegretol"] },
  { name: "Depakine", category: "anticonvulsant", dosageInstructions: "20mg - 30mg/kg/ngày", interactions: ["Keppra", "Phenobarbital", "Diazepam"] },
  { name: "Tegretol", category: "anticonvulsant", dosageInstructions: "200mg - 1200mg mỗi ngày", interactions: ["Keppra"] },
  { name: "Phenobarbital", category: "psychotropic", dosageInstructions: "50mg - 200mg uống trước khi đi ngủ", interactions: ["Depakine", "Diazepam", "Donepezil"] },
  { name: "Diazepam", category: "psychotropic", dosageInstructions: "2mg - 10mg mỗi ngày", interactions: ["Phenobarbital", "Depakine"] },
  { name: "Dexamethasone", category: "corticosteroid", dosageInstructions: "4mg - 16mg mỗi ngày uống sáng sau ăn", interactions: [] },
  { name: "Donepezil", category: "other", dosageInstructions: "5mg - 10mg uống tối trước ngủ", interactions: ["Phenobarbital"] },
];

export const checkPrescription = async (req, res) => {
  try {
    const { patientId, medications, orders } = req.body;

    if (!patientId) {
      return errorResponse(res, "Thiếu thông tin bệnh nhân.", 400);
    }

    let patient = null;
    try {
      patient = await User.findById(patientId);
    } catch (e) {
      // Ignore CastError
    }
    let allergies = ["Gadolinium"];
    if (patient && patient.profile && Array.isArray(patient.profile.allergies)) {
      allergies = patient.profile.allergies;
    }

    const latestVital = await VitalSign.findOne({ patient_id: patientId }).sort({ recorded_at: -1 }).lean();
    const warnings = [];
    const classifications = [];
    const medNames = (medications || []).map((m) => (typeof m === "string" ? m : m.name));

    // Ưu tiên tra DB bệnh viện, fallback về defaultDrugs
    const dbDrugs = await Drug.find({ name: { $in: medNames } }).lean();
    const activeDrugs = medNames.map((name) => {
      const dbDrug = dbDrugs.find((d) => d.name.toLowerCase() === name.toLowerCase());
      if (dbDrug) return dbDrug;
      const defDrug = defaultDrugs.find((d) => d.name.toLowerCase() === name.toLowerCase());
      return defDrug || { name, category: "other", interactions: [] };
    });

    // 1. Phân loại thuốc hướng tâm thần
    activeDrugs.forEach((drug) => {
      if (drug.category === "psychotropic") {
        classifications.push({ name: drug.name, type: "Hướng tâm thần", warning: "Thuốc hướng tâm thần (Cần lập đơn thuốc kiểm soát đặc biệt theo quy chế)." });
      }
    });

    // 2. Kiểm tra tương tác thuốc chéo
    for (let i = 0; i < activeDrugs.length; i++) {
      for (let j = i + 1; j < activeDrugs.length; j++) {
        const drugA = activeDrugs[i];
        const drugB = activeDrugs[j];
        const interactsA = (drugA.interactions || []).some((n) => n.toLowerCase() === drugB.name.toLowerCase());
        const interactsB = (drugB.interactions || []).some((n) => n.toLowerCase() === drugA.name.toLowerCase());
        if (interactsA || interactsB) {
          warnings.push({ type: "INTERACTION", severity: "HIGH", message: `Tương tác thuốc nguy hại giữa ${drugA.name} và ${drugB.name}.` });
        }
      }
    }

    // 3. Cảnh báo liều lượng Corticosteroid theo BMI
    let bmi = null;
    if (latestVital && latestVital.weight && latestVital.height) {
      bmi = Number((latestVital.weight / Math.pow(latestVital.height / 100, 2)).toFixed(2));
    }
    if (bmi) {
      const hasCorticosteroid = activeDrugs.some((d) => d.category === "corticosteroid");
      if (hasCorticosteroid && (bmi < 18.5 || bmi > 25.0)) {
        warnings.push({ type: "BMI_DOSAGE", severity: "MEDIUM", message: `BMI bệnh nhân là ${bmi} (ngoài dải 18.5-25.0). Cân nhắc điều chỉnh liều Corticosteroid.` });
      }
    }

    // 4. Cảnh báo dị ứng thuốc cản từ
    const hasGadoliniumOrder = (orders || []).some((o) => {
      const oName = typeof o === "string" ? o.toLowerCase() : o.name.toLowerCase();
      return oName.includes("cản từ") || oName.includes("gadolinium") || oName.includes("tương phản") || oName.includes("mri");
    });
    if (hasGadoliniumOrder && allergies.includes("Gadolinium")) {
      warnings.push({ type: "ALLERGY_ADR", severity: "CRITICAL", message: "Cảnh báo dị ứng nghiêm trọng (ADR): Bệnh nhân có tiền sử dị ứng Gadolinium." });
    }

    return successResponse(res, { warnings, classifications, bmi, allergies }, "Kiểm tra dược lâm sàng thành công.");
  } catch (error) {
    console.error("Lỗi checkPrescription:", error);
    return errorResponse(res, "Lỗi kiểm tra dược lâm sàng hệ thống.", 500);
  }
};