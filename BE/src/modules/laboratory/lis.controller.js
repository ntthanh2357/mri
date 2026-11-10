import { LabOrder } from "./models/labOrder.model.js";
import { Biomarker } from "./models/biomarker.model.js";
import { User } from "../auth/models/user.model.js";
import { createNotificationInternal } from "../../controllers/notification.controller.js";
import { recordAuditLog } from "../../services/auditLog.service.js";
import { successResponse, errorResponse } from "../../utils/response.util.js";
import { evaluateLabValue } from "./labResult.util.js";

import { inputErrorStatus } from "../../utils/inputError.util.js";
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

    const sent = await Promise.allSettled(
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

    // Chỉ coi là đã báo khi có ít nhất một thông báo lưu được; nếu không, lần duyệt sau sẽ báo lại.
    if (sent.some((r) => r.status === "fulfilled" && r.value)) {
      order.criticalNotifiedAt = new Date();
    } else {
      console.warn(`[LIS] Không lưu được cảnh báo critical value nào cho phiếu ${order.barcode}.`);
    }
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
    // Nạp danh mục chỉ số một lần cho cả phiếu (trước đây mỗi dòng một truy vấn: 5000 dòng ≈ 5000 lượt đọc DB)
    const codes = [...new Set(rawResults.map((r) => (typeof r?.code === "string" ? r.code.trim().toUpperCase() : null)).filter(Boolean))];
    const biomarkerByCode = new Map((await Biomarker.find({ code: { $in: codes } }).lean()).map((b) => [b.code, b]));

    for (const item of rawResults) {
      const { code, value } = item;
      if (!code || value === undefined || value === null) continue;
      // Giá trị phải là số thật: chuỗi rỗng, chữ, mảng hay object không được hiểu thành 0 hoặc lưu sai
      if (typeof code !== "string") return errorResponse(res, "Mã chỉ số xét nghiệm không hợp lệ.", 400);
      const num = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
      if (!Number.isFinite(num)) return errorResponse(res, `Giá trị xét nghiệm của ${code} phải là số.`, 400);

      const biomarker = biomarkerByCode.get(code.trim().toUpperCase()) || null;

      const evaluation = evaluateLabValue({ value: num, gender, biomarker });

      processedResults.push({
        biomarker_code: code.toUpperCase(),
        biomarker_name: biomarker?.name || code,
        value_result: num,
        unit: biomarker?.unit || "N/A",
        ...evaluation,
      });
    }

    if (processedResults.length === 0) {
      return errorResponse(res, "Không có kết quả hợp lệ nào để lưu.", 400);
    }

    // Gửi lại khi phiếu chưa duyệt: giữ kết quả cũ và cờ nguy kịch để bác sĩ vẫn thấy
    const previousCritical = order.hasCriticalValue ? [...(order.criticalValues || [])] : [];
    if (order.results?.length) {
      order.resultHistory = [...(order.resultHistory || []), {
        results: order.results.map((r) => (typeof r.toObject === "function" ? r.toObject() : r)),
        resulted_at: order.resulted_at || null,
        criticalValues: previousCritical,
        replacedAt: new Date(),
        replacedBy: String(req.user?.id || req.user?._id || "lis"),
      }];
    }
    order.results = processedResults;
    order.status = "RESULTED";
    order.specimenStatus = "RESULTED";
    order.resulted_at = new Date();
    const fromMachine = req.user?.role === "system";
    order.resulted_by = fromMachine ? null : (req.user.id || req.user._id);
    order.resulted_source = fromMachine ? "lis_machine" : "manual";
    if (!order.received_at) order.received_at = new Date();

    const criticalResults = processedResults.filter((r) => r.is_critical);
    order.hasCriticalValue = criticalResults.length > 0 || previousCritical.length > 0;
    order.criticalValues = [
      ...criticalResults.map((r) => `${r.biomarker_name}: ${r.value_result} ${r.unit} (${r.critical_note})`),
      ...previousCritical.map((v) => (v.startsWith("Lần gửi trước: ") ? v : `Lần gửi trước: ${v}`)),
    ];

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
    return errorResponse(res, "Đã xảy ra lỗi hệ thống khi tiếp nhận kết quả xét nghiệm.", inputErrorStatus(res, error));
  }
};

// ─── [P2-7] Ghi nhận lấy mẫu (specimen lifecycle) ───────────────────────────
// @route POST /api/lis/orders/:id/collect
export const collectLabSpecimen = async (req, res) => {
  try {
    if (!req.user?.hospitalId) return errorResponse(res, "Tài khoản chưa được gán vào bệnh viện nào.", 403);
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
    return errorResponse(res, "Không thể ghi nhận lấy mẫu xét nghiệm.", inputErrorStatus(res, error));
  }
};

// ─── [P2-7] Bác sĩ duyệt kết quả: RESULTED → VERIFIED ──────────────────────
// @route POST /api/lis/orders/:id/verify
export const verifyLisResults = async (req, res) => {
  try {
    if (!req.user?.hospitalId) return errorResponse(res, "Tài khoản chưa được gán vào bệnh viện nào.", 403);
    let order = await LabOrder.findOne({ _id: req.params.id, hospitalId: req.user.hospitalId });
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
    // Người nhập kết quả (nhập tay) không tự duyệt kết quả của mình
    const verifierId = String(req.user.id || req.user._id);
    if (order.resulted_by && String(order.resulted_by) === verifierId) {
      return errorResponse(res, "Bạn đã nhập kết quả phiếu này nên không tự duyệt được. Cần bác sĩ khác duyệt.", 403);
    }

    // Giành trạng thái nguyên tử: nhiều người duyệt cùng lúc chỉ một người thành công;
    // điều kiện resulted_by chặn cả trường hợp kết quả vừa được chính người duyệt nhập lại
    const claimed = await LabOrder.findOneAndUpdate(
      { _id: order._id, hospitalId: order.hospitalId, status: "RESULTED", ...(/^[a-f0-9]{24}$/i.test(verifierId) ? { resulted_by: { $ne: verifierId } } : {}) },
      { $set: { status: "VERIFIED", specimenStatus: "VERIFIED", verified_at: new Date(), verified_by: req.user.id || req.user._id } },
      { new: true }
    );
    if (!claimed) return errorResponse(res, "Phiếu xét nghiệm vừa được người khác duyệt hoặc thay đổi. Vui lòng tải lại.", 409);
    order = claimed;
    if (order.hasCriticalValue && !order.criticalNotifiedAt) {
      await notifyCriticalValue(order, order.results.filter((r) => r.is_critical));
      await order.save();
    }

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
    return errorResponse(res, "Không thể duyệt kết quả xét nghiệm.", inputErrorStatus(res, error));
  }
};
