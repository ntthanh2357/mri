import { LabOrder } from "./models/labOrder.model.js";
import { Biomarker } from "./models/biomarker.model.js";
import { User } from "../auth/models/user.model.js";
import { createNotificationInternal } from "../../controllers/notification.controller.js";
import { recordAuditLog } from "../../services/auditLog.service.js";
import { successResponse, errorResponse } from "../../utils/response.util.js";
import { evaluateLabValue } from "./labResult.util.js";

/** [P2-7] Báo ngay cho bác sĩ + quản lý bệnh viện khi có giá trị nguy kịch. */
const notifyCriticalValue = async (order, criticalResults) => {
  try {
    const recipients = await User.find({
      hospitalId: order.hospitalId,
      role: { $in: ["doctor", "department_head", "hospital_admin"] },
      isLocked: false,
      isDeleted: { $ne: true },
    }).select("_id role").lean();

    const detail = criticalResults
      .map((r) => `${r.biomarker_name}: ${r.value_result} ${r.unit} (${r.critical_note})`)
      .join("; ");

    await Promise.allSettled(
      recipients.map((u) =>
        createNotificationInternal({
          hospitalId: order.hospitalId,
          recipientId: u._id,
          senderId: u._id,
          type: "critical_lab_value",
          title: "🚨 GIÁ TRỊ XÉT NGHIỆM NGUY KỊCH",
          message: `Phiếu ${order.barcode}: ${detail}. Cần xử lý lâm sàng ngay và ký duyệt kết quả.`,
          relatedId: order._id,
        })
      )
    );

    order.criticalNotifiedAt = new Date();
  } catch (err) {
    console.warn("[LIS] Không gửi được cảnh báo critical value:", err.message);
  }
};

/**
 * Tiếp nhận kết quả từ máy LIS.
 * Không đánh dấu hoàn tất ngay: kết quả ở trạng thái RESULTED, chờ bác sĩ duyệt (VERIFIED).
 */
export const receiveLisResults = async (req, res) => {
  try {
    const { barcode, results: rawResults } = req.body;
    const hospitalId = req.user?.hospitalId;

    if (!hospitalId) {
      return errorResponse(res, "Không xác định được bệnh viện của phiếu xét nghiệm.", 403);
    }
    if (!barcode || !Array.isArray(rawResults) || rawResults.length === 0) {
      return errorResponse(res, "Thiếu thông tin barcode hoặc danh sách kết quả xét nghiệm.", 400);
    }

    const order = await LabOrder.findOne({ barcode, hospitalId });
    if (!order) {
      return errorResponse(res, `Không tìm thấy phiếu xét nghiệm thuộc bệnh viện của bạn với barcode: ${barcode}`, 404);
    }
    if (order.status === "VERIFIED" || order.status === "COMPLETED") {
      return errorResponse(res, "Phiếu xét nghiệm này đã được bác sĩ duyệt, không thể ghi đè kết quả.", 409);
    }

    const gender = order.patient_gender; // 'Nam' hoặc 'Nữ'
    const processedResults = [];

    for (const item of rawResults) {
      const { code, value } = item;
      if (!code || value === undefined || value === null) continue;

      const biomarker = await Biomarker.findOne({ code: code.toUpperCase() });

      const evaluation = evaluateLabValue({ value, gender, biomarker });

      processedResults.push({
        biomarker_code: code.toUpperCase(),
        biomarker_name: biomarker?.name || code,
        value_result: Number(value),
        unit: biomarker?.unit || "N/A",
        ...evaluation,
      });
    }

    if (processedResults.length === 0) {
      return errorResponse(res, "Không có kết quả hợp lệ nào để lưu.", 400);
    }

    order.results = processedResults;
    order.status = "RESULTED";
    order.specimenStatus = "RESULTED";
    order.resulted_at = new Date();
    if (!order.received_at) order.received_at = new Date();

    const criticalResults = processedResults.filter((r) => r.is_critical);
    order.hasCriticalValue = criticalResults.length > 0;
    order.criticalValues = criticalResults.map(
      (r) => `${r.biomarker_name}: ${r.value_result} ${r.unit} (${r.critical_note})`
    );

    if (criticalResults.length > 0) {
      await notifyCriticalValue(order, criticalResults);
    }

    await order.save();

    try {
      await recordAuditLog({
        action: criticalResults.length > 0 ? "LIS_CRITICAL_RESULT_RECEIVED" : "LIS_RESULT_RECEIVED",
        entity: "LabOrder",
        entityId: order._id.toString(),
        performedBy: (req.user.id || req.user._id || "lis").toString(),
        hospitalId,
        details: `Nhận ${processedResults.length} kết quả xét nghiệm cho phiếu ${order.barcode}; trạng thái RESULTED, chờ bác sĩ duyệt.${
          criticalResults.length > 0 ? ` CẢNH BÁO NGUY KỊCH: ${order.criticalValues.join("; ")}.` : ""
        }`,
      });
    } catch (auditErr) {
      console.warn("[LIS] Không ghi được audit log:", auditErr.message);
    }

    return successResponse(
      res,
      {
        order,
        requiresVerification: true,
        hasCriticalValue: order.hasCriticalValue,
        criticalValues: order.criticalValues,
      },
      criticalResults.length > 0
        ? "Đã nhận kết quả và phát cảnh báo giá trị nguy kịch. Bác sĩ cần duyệt kết quả."
        : "Đã nhận kết quả xét nghiệm. Chờ bác sĩ duyệt trước khi hoàn tất."
    );
  } catch (error) {
    console.error("Lỗi tiếp nhận kết quả LIS:", error);
    return errorResponse(res, "Đã xảy ra lỗi hệ thống khi tiếp nhận kết quả xét nghiệm.", 500);
  }
};

// ─── [P2-7] Ghi nhận lấy mẫu (specimen lifecycle) ───────────────────────────
// @route POST /api/lis/orders/:id/collect
export const collectLabSpecimen = async (req, res) => {
  try {
    const order = await LabOrder.findOne({ _id: req.params.id, hospitalId: req.user.hospitalId });
    if (!order) return errorResponse(res, "Không tìm thấy phiếu xét nghiệm.", 404);
    if (order.status !== "PENDING") {
      return errorResponse(res, "Chỉ ghi nhận lấy mẫu cho phiếu đang chờ xử lý.", 409);
    }

    order.status = "COLLECTED";
    order.specimenStatus = "COLLECTED";
    order.collected_at = new Date();
    await order.save();

    try {
      await recordAuditLog({
        action: "LIS_SPECIMEN_COLLECTED",
        entity: "LabOrder",
        entityId: order._id.toString(),
        performedBy: (req.user.id || req.user._id || "system").toString(),
        hospitalId: order.hospitalId,
        details: `Đã lấy mẫu cho phiếu xét nghiệm ${order.barcode}.`,
      });
    } catch (auditErr) {
      console.warn("[LIS] Không ghi được audit log lấy mẫu:", auditErr.message);
    }

    return successResponse(res, order, "Đã ghi nhận lấy mẫu xét nghiệm.");
  } catch (error) {
    console.error("Lỗi ghi nhận lấy mẫu:", error);
    return errorResponse(res, "Không thể ghi nhận lấy mẫu xét nghiệm.", 500);
  }
};

// ─── [P2-7] Bác sĩ duyệt kết quả: RESULTED → VERIFIED ──────────────────────
// @route POST /api/lis/orders/:id/verify
export const verifyLisResults = async (req, res) => {
  try {
    const order = await LabOrder.findOne({ _id: req.params.id, hospitalId: req.user.hospitalId });
    if (!order) return errorResponse(res, "Không tìm thấy phiếu xét nghiệm.", 404);
    if (order.status === "VERIFIED" || order.status === "COMPLETED") {
      return successResponse(res, order, "Kết quả xét nghiệm đã được duyệt trước đó.");
    }
    if (order.status !== "RESULTED") {
      return errorResponse(res, "Chỉ duyệt được phiếu đã có kết quả từ LIS.", 409);
    }
    if (!order.results || order.results.length === 0) {
      return errorResponse(res, "Phiếu xét nghiệm chưa có kết quả để duyệt.", 400);
    }

    if (order.hasCriticalValue && !order.criticalNotifiedAt) {
      await notifyCriticalValue(order, order.results.filter((r) => r.is_critical));
    }

    order.status = "VERIFIED";
    order.specimenStatus = "VERIFIED";
    order.verified_at = new Date();
    order.verified_by = req.user.id || req.user._id;
    await order.save();

    try {
      await recordAuditLog({
        action: "LIS_RESULT_VERIFIED",
        entity: "LabOrder",
        entityId: order._id.toString(),
        performedBy: (req.user.id || req.user._id || "system").toString(),
        hospitalId: order.hospitalId,
        details: `Bác sĩ ${req.user.profile?.name || req.user.email} duyệt kết quả xét nghiệm ${order.barcode}${
          order.hasCriticalValue ? ` (đã cảnh báo critical value: ${order.criticalValues.join("; ")})` : ""
        }.`,
      });
    } catch (auditErr) {
      console.warn("[LIS] Không ghi được audit log duyệt kết quả:", auditErr.message);
    }

    return successResponse(res, order, "Đã duyệt và hoàn tất kết quả xét nghiệm.");
  } catch (error) {
    console.error("Lỗi duyệt kết quả LIS:", error);
    return errorResponse(res, "Không thể duyệt kết quả xét nghiệm.", 500);
  }
};
