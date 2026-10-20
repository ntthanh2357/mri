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
import { deductDrugStockFEFO, importDrugBatch, sortBatchesFEFO, sumBatches } from "./services/batchStock.service.js";
import { recordAuditLog, AUDIT_ACTIONS } from "../../services/auditLog.service.js";

// ── Helper: Ghi nhật ký kiểm toán trung tâm cho thao tác Dược (chuỗi băm chống giả mạo
// theo HIPAA §164.312(b) & TT 13/2025/TT-BYT). Bọc try/catch: audit lỗi KHÔNG được phép
// làm hỏng nghiệp vụ chính — cùng pattern đã dùng ở invoice/bhyt/hospitalBed service.
// Tên người thao tác cho chuỗi audit — req.user có thể thiếu profile/email (authCache đôi khi
// cache bản select ngắn không có profile) nên fallback về vai trò + ID để log tự định danh.
function performerLabel(req) {
  return req.user?.profile?.name || req.user?.email || `${req.user?.role || "hệ thống"} (ID ${req.user?.id || "?"})`;
}

async function auditPharmacy({ action, entity, entityId, req, hospitalId, details, payload }) {
  try {
    await recordAuditLog({
      action,
      entity,
      entityId: entityId ? entityId.toString() : "",
      performedBy: req.user?.id || "system",
      hospitalId: hospitalId || req.user?.hospitalId || null,
      details: details || "",
      payload: payload || null,
    });
  } catch (err) {
    console.warn(`[Pharmacy AuditLog Warn] ${action}:`, err.message);
  }
}

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
// ── Helper: dựng mảng lô ban đầu cho thuốc mới (UC-PHA-07) ──
// Caller truyền body.batches → chuẩn hoá; không truyền → tự sinh 1 lô ban đầu
// từ expiryDate + stock.quantity để thuốc vào kho đã có sổ lô ngay từ đầu.
function buildInitialBatches(body, { stockQuantity, expiryDate, manufacturer, performedBy }) {
  const bodyBatches = Array.isArray(body?.batches) ? body.batches : null;
  if (bodyBatches) {
    return bodyBatches
      .map((b, i) => ({
        batchNumber: (b.batchNumber || `LO-${i + 1}`).trim(),
        quantity: Number(b.quantity) || 0,
        expiryDate: b.expiryDate ? new Date(b.expiryDate) : null,
        supplier: (b.supplier || "").trim(),
        receivedAt: new Date(),
        receivedBy: performedBy || null,
      }))
      .filter((b) => b.quantity > 0);
  }
  if (Number(stockQuantity) > 0) {
    return [{
      batchNumber: "LO-INITIAL",
      quantity: Number(stockQuantity),
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      supplier: (manufacturer || "").trim(),
      receivedAt: new Date(),
      receivedBy: performedBy || null,
    }];
  }
  return [];
}

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

    // Tồn kho theo lô (UC-PHA-07): body.batches → chuẩn hoá; không có → tự sinh
    // lô ban đầu từ expiryDate + stock.quantity để thuốc mới vào kho đã có sổ lô.
    const initialBatches = buildInitialBatches(req.body, {
      stockQuantity: Number(stock?.quantity) || 0,
      expiryDate,
      manufacturer,
      performedBy: req.user.id,
    });

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
      batches: initialBatches,
      isActive: true,
    });

    // Bất biến sổ sách: đã theo lô thì tổng kho = Σ lô (body.batches được ưu tiên)
    if (initialBatches.length > 0 && Array.isArray(req.body.batches)) {
      drug.stock.quantity = sumBatches(initialBatches);
    }

    // Nhật ký nhập kho ban đầu (TT46/2018 — mọi biến động kho phải có movement)
    if (initialBatches.length > 0) {
      drug.stockMovements.push({
        type: "import",
        quantity: sumBatches(initialBatches),
        performedBy: req.user.id,
        reason: "Nhập kho ban đầu khi tạo thuốc mới",
        batchNumber: initialBatches.length === 1 ? initialBatches[0].batchNumber : null,
        balanceAfter: sumBatches(initialBatches),
        timestamp: new Date(),
      });
    }

    await drug.save();

    // Nhật ký kiểm toán trung tâm (tạo danh mục thuốc là quyết định quản trị — TT46/2018)
    await auditPharmacy({
      action: AUDIT_ACTIONS.DRUG_CATALOG_CREATED,
      entity: "Drug",
      entityId: drug._id,
      req,
      hospitalId,
      details: `Thêm thuốc "${drug.name}" vào danh mục (nhóm: ${drug.category}, giá: ${drug.price}đ, tồn ban đầu: ${drug.stock.quantity} ${drug.stock.unit}).`,
      payload: { name: drug.name, category: drug.category, price: drug.price, initialStock: drug.stock.quantity, unit: drug.stock.unit, batchCount: initialBatches.length },
    });

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

    const changedFields = (drug.modifiedPaths && drug.modifiedPaths()) || [];
    await drug.save();

    // Nhật ký kiểm toán trung tâm (sửa danh mục ảnh hưởng kê đơn & tính phí)
    await auditPharmacy({
      action: AUDIT_ACTIONS.DRUG_CATALOG_UPDATED,
      entity: "Drug",
      entityId: drug._id,
      req,
      hospitalId: drug.hospitalId,
      details: `Cập nhật thuốc "${drug.name}"${changedFields.length ? ` (các trường: ${changedFields.join(", ")})` : ""}.`,
      payload: { name: drug.name, changedFields, price: drug.price, category: drug.category, isActive: drug.isActive },
    });

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

    // Nhật ký kiểm toán trung tâm (xóa danh mục — thao tác không thể hoàn tác)
    await auditPharmacy({
      action: AUDIT_ACTIONS.DRUG_CATALOG_DELETED,
      entity: "Drug",
      entityId: id,
      req,
      hospitalId: drug.hospitalId,
      details: `Xóa thuốc "${drug.name}" khỏi danh mục (tồn cuối: ${drug.stock?.quantity ?? 0} ${drug.stock?.unit ?? ""}).`,
      payload: { name: drug.name, category: drug.category, price: drug.price, lastStock: drug.stock?.quantity ?? 0, unit: drug.stock?.unit ?? "" },
    });

    return successResponse(res, { deletedId: id }, `Đã xóa thuốc "${drug.name}" khỏi danh mục.`);
  } catch (error) {
    console.error("Lỗi deleteDrug:", error);
    return errorResponse(res, "Lỗi hệ thống khi xóa thuốc.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DR-06: Cập nhật tồn kho — nhập lô mới / xuất FEFO / kiểm kê (UC-PHA-07)
// POST /api/drugs/:id/stock
// @access hospital_admin, pharmacist, admin
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

    const { action, quantity, unit, minStock, batchNumber, expiryDate, supplier, reason: stockReason } = req.body;

    if (!["set", "add", "subtract", "import"].includes(action)) {
      return errorResponse(res, "action phải là 'set', 'add', 'subtract' hoặc 'import'.", 400);
    }

    const qty = Number(quantity);
    if (isNaN(qty) || qty < 0) {
      return errorResponse(res, "Số lượng phải là số không âm.", 400);
    }
    if (qty === 0 && action !== "set") {
      return errorResponse(res, "Số lượng phải lớn hơn 0.", 400);
    }

    const hasBatches = Array.isArray(drug.batches) && drug.batches.length > 0;
    const now = new Date();

    if (action === "add" || action === "import") {
      // ── NHẬP KHO THEO LÔ (UC-PHA-07): 'import' luôn tạo/gộp lô; 'add' khai báo
      // số lô thì tạo/gộp lô; thuốc chưa theo lô và không khai báo lô → cộng tổng
      // truyền thống (tương thích ngược).
      if (action === "import" || batchNumber || hasBatches) {
        const resImport = await importDrugBatch({
          drugId: drug._id,
          qty,
          batchNumber: batchNumber || "",
          expiryDate: expiryDate || null,
          supplier: supplier || "",
          performedBy: req.user.id,
          reason: stockReason || (action === "import" ? "Nhập lô mới vào kho" : "Nhập thêm tồn kho"),
          now,
        });
        if (!resImport.ok) {
          return errorResponse(res, resImport.error, 400);
        }
      } else {
        // Legacy: thuốc chưa chuyển sang quản lý theo lô
        drug.stock.quantity += qty;
        drug.stockMovements.push({
          type: "import",
          quantity: qty,
          performedBy: req.user.id,
          reason: stockReason || "Nhập thêm tồn kho",
          batchNumber: null,
          balanceAfter: drug.stock.quantity,
          timestamp: now,
        });
      }
    } else if (action === "subtract") {
      // ── XUẤT KHO THEO FEFO: lô hết hạn sớm xuất trước; lô đã hết hạn bị loại
      // khỏi mọi phép xuất (dead stock chờ tiêu hủy theo quy chế GPP).
      const resDeduct = await deductDrugStockFEFO({
        drugId: drug._id,
        qty,
        performedBy: req.user.id,
        reason: stockReason || "Xuất kho / điều chỉnh giảm tồn kho (FEFO)",
        type: "export",
        now,
      });
      if (!resDeduct.ok) {
        return errorResponse(res, resDeduct.error, 400);
      }
    } else if (action === "set") {
      // ── KIỂM KÊ: đặt lại tổng. Thuốc đã theo lô → phân bổ lại giữ thứ tự FEFO
      // (lột/bơm từ lô hết hạn sớm trước) để bất biến Σ lô = tổng luôn đúng.
      const total = Number(drug.stock?.quantity) || 0;
      if (hasBatches) {
        const plain = drug.batches.map((b) => (b.toObject ? b.toObject() : { ...b }));
        const sorted = sortBatchesFEFO(plain);
        let remaining = qty;
        drug.batches = sorted.map((b) => {
          const orig = Number(b.quantity) || 0;
          const take = Math.min(orig, remaining);
          remaining -= take;
          return { ...b, quantity: take };
        });
        drug.stock.quantity = sumBatches(drug.batches);
      } else {
        drug.stock.quantity = qty;
      }
      if (qty !== total) {
        drug.stockMovements.push({
          type: "adjustment",
          quantity: Math.abs(qty - total),
          performedBy: req.user.id,
          reason: stockReason || `Kiểm kê điều chỉnh tồn kho ${total} -> ${qty}`,
          batchNumber: hasBatches ? (drug.batches[0]?.batchNumber || null) : null,
          balanceAfter: qty,
          timestamp: now,
        });
      }
    }

    // Nạp lại bản mới nhất (service cập nhật nguyên tử thẳng DB), áp đơn vị/ngưỡng
    const finalDrug = (await Drug.findById(drug._id)) || drug;
    if (unit) finalDrug.stock.unit = unit;
    if (minStock !== undefined) finalDrug.stock.minStock = Number(minStock);
    finalDrug.stock.lastUpdated = new Date();
    await finalDrug.save();

    // Kiểm tra ngưỡng cảnh báo sau khi cập nhật
    const isLowStock = finalDrug.stock.quantity < finalDrug.stock.minStock;

    // ── Gửi thông báo tới Hospital Admin khi hết thuốc / sắp hết thuốc ────────
    if (isLowStock) {
      try {
        const admins = await User.find({ hospitalId: finalDrug.hospitalId, role: "hospital_admin" }).lean();
        for (const admin of admins) {
          await createNotificationInternal({
            hospitalId: finalDrug.hospitalId,
            recipientId: admin._id,
            type: "low_stock",
            title: "⚠️ Cảnh báo tồn kho dược phẩm",
            message: `Thuốc "${finalDrug.name}" trong kho chỉ còn ${finalDrug.stock.quantity} ${finalDrug.stock.unit} (dưới ngưỡng an toàn ${finalDrug.stock.minStock}). Vui lòng lập kế hoạch nhập thêm.`,
            relatedId: finalDrug._id,
          });
        }
      } catch (notifErr) {
        console.warn("⚠️ Không thể gửi thông báo cảnh báo kho cho Admin:", notifErr.message);
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Nhật ký kiểm toán trung tâm — mọi biến động kho (nhập lô / xuất FEFO / kiểm kê)
    // phải đi qua chuỗi băm kiểm toán theo GPP & TT46/2018 (UC-PHA-07)
    await auditPharmacy({
      action: AUDIT_ACTIONS.DRUG_STOCK_ADJUSTED,
      entity: "Drug",
      entityId: finalDrug._id,
      req,
      hospitalId: finalDrug.hospitalId,
      details: `${{ set: "Kiểm kê", add: "Nhập thêm", subtract: "Xuất kho (FEFO)", import: "Nhập lô" }[action] || action} ${qty} ${finalDrug.stock.unit} — thuốc "${finalDrug.name}"${batchNumber ? ` (lô ${batchNumber})` : ""}; lý do: ${stockReason || "(không ghi rõ)"}; tồn sau: ${finalDrug.stock.quantity} ${finalDrug.stock.unit}.`,
      payload: { drugName: finalDrug.name, action, quantity: qty, unit: finalDrug.stock.unit, batchNumber: batchNumber || null, balanceAfter: finalDrug.stock.quantity, reason: stockReason || "" },
    });

    return successResponse(res, {
      drug: finalDrug,
      isLowStock,
      stockStatus: isLowStock ? "LOW" : "OK",
      message: isLowStock
        ? `⚠️ Cảnh báo: Tồn kho "${finalDrug.name}" chỉ còn ${finalDrug.stock.quantity} ${finalDrug.stock.unit} (dưới ngưỡng ${finalDrug.stock.minStock}).`
        : `✅ Cập nhật tồn kho thành công. Còn ${finalDrug.stock.quantity} ${finalDrug.stock.unit}.`,
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
// DR-08: Cảnh báo thuốc sắp hết hạn THEO LÔ (UC-PHA-07)
// GET /api/drugs/alerts/expiring?days=30
// Liệt kê từng lô còn hàng có hạn dùng ≤ hôm nay + days, KỂ CẢ lô đã hết hạn
// (để dược sĩ lập thủ tục kiểm định / tiêu hủy) — sắp xếp gấp nhất lên đầu.
// @access pharmacist, hospital_admin, admin
// ─────────────────────────────────────────────────────────────────────────────
export const getExpiryAlerts = async (req, res) => {
  try {
    const hospitalId = resolveHospitalId(req);
    if (!hospitalId) return errorResponse(res, "Không xác định được bệnh viện.", 400);

    const days = Math.max(1, Math.min(365, parseInt(req.query.days, 10) || 30));
    const now = new Date();
    const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const hospOid = mongoose.Types.ObjectId.createFromHexString(hospitalId.toString());

    // 1) Các lô đã quy đổi sang quản lý theo lô
    const batched = await Drug.aggregate([
      { $match: { hospitalId: { $eq: hospOid }, isActive: true } },
      { $unwind: "$batches" },
      { $match: { "batches.quantity": { $gt: 0 } } },
      { $match: { "batches.expiryDate": { $ne: null, $lte: horizon } } },
      {
        $project: {
          _id: 0,
          drugId: "$_id",
          name: 1,
          category: 1,
          unit: "$stock.unit",
          totalStock: "$stock.quantity",
          batchNumber: "$batches.batchNumber",
          quantity: "$batches.quantity",
          expiryDate: "$batches.expiryDate",
          supplier: "$batches.supplier",
        },
      },
    ]);

    // 2) Thuốc chưa theo lô (legacy) — dùng hạn dùng danh mục cũ
    const legacy = await Drug.find({
      hospitalId: { $eq: hospOid },
      isActive: true,
      expiryDate: { $ne: null, $lte: horizon },
      $or: [{ batches: { $exists: false } }, { batches: { $size: 0 } }],
    })
      .select("name category expiryDate stock.quantity stock.unit")
      .lean();

    const rows = [
      ...batched,
      ...legacy.map((d) => ({
        drugId: d._id,
        name: d.name,
        category: d.category,
        unit: d.stock?.unit,
        totalStock: d.stock?.quantity,
        batchNumber: null,
        quantity: d.stock?.quantity,
        expiryDate: d.expiryDate,
        supplier: "",
        legacy: true,
      })),
    ].map((r) => {
      const daysLeft = Math.ceil((new Date(r.expiryDate).getTime() - now.getTime()) / 86400000);
      return { ...r, daysLeft, isExpired: daysLeft < 0 };
    }).sort((a, b) => a.daysLeft - b.daysLeft);

    const summary = {
      expired: rows.filter((r) => r.isExpired).length,
      within7days: rows.filter((r) => !r.isExpired && r.daysLeft <= 7).length,
      withinDays: rows.filter((r) => !r.isExpired).length,
    };

    return successResponse(
      res,
      { alerts: rows, total: rows.length, days, summary },
      `Lấy danh sách lô thuốc sắp hết hạn (${days} ngày) thành công.`
    );
  } catch (error) {
    console.error("Lỗi getExpiryAlerts:", error);
    return errorResponse(res, "Lỗi hệ thống khi lấy cảnh báo hết hạn.", 500);
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

    // Nhật ký kiểm toán trung tâm — xác nhận kép Dual-Sign là thao tác nhạy cảm an toàn thuốc
    await auditPharmacy({
      action: AUDIT_ACTIONS.PRESCRIPTION_VERIFIED,
      entity: "Prescription",
      entityId: prescription._id,
      req,
      hospitalId: prescription.hospitalId,
      details: `Dược sĩ ${performerLabel(req)} ký duyệt Dual-Sign đơn thuốc (chẩn đoán: ${prescription.diagnosis || "—"}); trạng thái ${prevStatus} → READY.`,
      payload: { fromStatus: prevStatus, toStatus: "READY", note: note || "", diagnosis: prescription.diagnosis || "" },
    });

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

    // Nhật ký kiểm toán trung tâm — từ chối đơn thuốc là can thiệp chuyên môn ảnh hưởng phác đồ
    await auditPharmacy({
      action: AUDIT_ACTIONS.PRESCRIPTION_REJECTED,
      entity: "Prescription",
      entityId: prescription._id,
      req,
      hospitalId: prescription.hospitalId,
      details: `Dược sĩ ${performerLabel(req)} TỪ CHỐI đơn thuốc (chẩn đoán: ${prescription.diagnosis || "—"}); lý do: ${reason.trim()}`,
      payload: { fromStatus: prevStatus, toStatus: "REJECTED_BY_PHARMACY", reason: reason.trim(), diagnosis: prescription.diagnosis || "" },
    });

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
      if (!drugDoc) continue;
      const itemBatches = Array.isArray(drugDoc.batches) ? drugDoc.batches : [];
      if (itemBatches.length > 0) {
        // Thuốc đã theo lô: FEFO tự loại lô hết hạn khỏi mọi phép xuất; chỉ chặn
        // khi TOÀN BỘ tồn kho usable đã hết hạn (dead stock chờ tiêu hủy).
        const usableQty = itemBatches.reduce((s, b) => {
          const q = Number(b.quantity) || 0;
          return s + (!b.expiryDate || new Date(b.expiryDate) >= now ? q : 0);
        }, 0);
        if (usableQty === 0) {
          return errorResponse(
            res,
            `[CẢNH BÁO AN TOÀN DƯỢC] Thuốc '${item.name}' đã hết hạn sử dụng toàn bộ các lô còn tồn kho. Tuyệt đối cấm cấp phát cho người bệnh — đề nghị lập thủ tục tiêu hủy theo quy chế GPP!`,
            400
          );
        }
      } else if (drugDoc.expiryDate && new Date(drugDoc.expiryDate) < now) {
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
          // Xuất kho THEO LÔ FEFO (lô hết hạn sớm trước, bỏ qua lô hết hạn).
          // Thiếu kho cấp cứu: không chặn cứu người — xuất hết số usable đang có
          // và bắn cảnh báo khẩn yêu cầu kiểm kê nhập bù (Emergency Variance).
          const resDeduct = await deductDrugStockFEFO({
            drugId: drugDoc._id,
            qty,
            performedBy: req.user.id,
            reason: `[Cấp cứu khẩn cấp - Luật KCB] Xuất thuốc cấp cứu đơn ${prescription._id}`,
            invoiceId: linkedInvoice?._id || null,
            allowShortage: true,
            now,
          });

          if (!resDeduct.ok) {
            console.error(`⚠️ [EMERGENCY_DISPENSE_VARIANCE] Không trừ được kho cho thuốc '${pDrug.name}': ${resDeduct.error}`);
          } else if (resDeduct.shortage > 0) {
            console.error(`🚨 [CẤP CỨU THIẾU KHO SỔ SÁCH] Thuốc '${pDrug.name}' cần ${qty} nhưng chỉ xuất được ${resDeduct.dispensed}${resDeduct.expiredQty ? ` (${resDeduct.expiredQty} đơn vị kẹt trong lô hết hạn)` : ""}.`);
            try {
              const chiefs = await User.find({ hospitalId: prescription.hospitalId, role: { $in: ["hospital_admin", "admin", "pharmacist"] } });
              for (const chief of chiefs) {
                await createNotificationInternal({
                  hospitalId: prescription.hospitalId,
                  recipientId: chief._id,
                  type: "stock_shortage",
                  title: "🚨 Báo động lệch kho cấp cứu (Emergency Variance Alert)",
                  message: `Thuốc cấp cứu '${pDrug.name}' (Đơn ${prescription._id}) đã được xuất phát cứu người bệnh nhưng sổ sách thiếu tồn kho (Yêu cầu: ${qty}, Thực tế xuất: ${resDeduct.dispensed}). Đề nghị Dược sĩ kiểm kê và nhập bù tồn kho gấp!`,
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

    // 5b. Nhật ký kiểm toán trung tâm — phát thuốc là thao tác nhạy cảm nhất của Khoa Dược
    // (chạm thuốc vật lý + tiền + kho); ghi đủ bối cảnh cấp cứu / phát từng phần.
    await auditPharmacy({
      action: AUDIT_ACTIONS.PRESCRIPTION_DISPENSED,
      entity: "Prescription",
      entityId: prescription._id,
      req,
      hospitalId: prescription.hospitalId,
      details: `Dược sĩ ${performerLabel(req)} xuất phát thuốc (${targetStatus})${isAcuteEmergency ? " — CẤP CỨU (phát trước, hậu kiểm 24h)" : ""}${partiallyDispensed ? " — phát từng phần" : ""}: ${(prescription.drugs || []).map(d => `${d.name} x${d.quantity || 1}`).join(", ") || "—"}. Hóa đơn: ${linkedInvoice?._id || "không liên kết"}.`,
      payload: {
        fromStatus: prevStatus,
        toStatus: targetStatus,
        isEmergency: Boolean(isAcuteEmergency),
        partial: Boolean(partiallyDispensed),
        drugs: (prescription.drugs || []).map(d => ({ name: d.name, quantity: d.quantity || 1 })),
        invoiceId: linkedInvoice?._id?.toString() || null,
        postHocReviewRequired: Boolean(prescription.postHocReviewRequired),
      },
    });

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

    // Nhật ký kiểm toán trung tâm — hậu kiểm 24h cho đơn cấp cứu (governance bắt buộc)
    await auditPharmacy({
      action: AUDIT_ACTIONS.PRESCRIPTION_POST_HOC_REVIEWED,
      entity: "Prescription",
      entityId: prescription._id,
      req,
      hospitalId: prescription.hospitalId,
      details: `Dược sĩ ${performerLabel(req)} hậu kiểm 24h đơn thuốc cấp cứu — quyết định: ${decision || "APPROVED"}; ghi chú: ${prescription.postHocReviewNote}`,
      payload: { decision: decision || "APPROVED", note: note || "" },
    });

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