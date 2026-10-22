import { getVisitProgress } from "../services/visitProgress.service.js";
import { getMriPrep, saveMriScreening } from "../services/mriPrep.service.js";
import { listPatientInvoices } from "../services/patientInvoice.service.js";
import { successResponse, errorResponse } from "../utils/response.util.js";

// Bệnh nhân theo dõi lượt khám (UC-PAT-05) và chuẩn bị chụp MRI. Phân quyền role ở routes.

const wrap = (fn) => async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    return await fn(req, res);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

// GET /api/v1/patient/visit-progress — lượt khám đang diễn ra (hoặc vừa xong hôm nay) của tôi, hoặc null
export const progressMine = wrap(async (req, res) => successResponse(res, await getVisitProgress(req.user.id)));

// GET /api/v1/patient/mri-prep — hướng dẫn chuẩn bị + phiếu sàng lọc của lượt đang chờ chụp MRI, hoặc null
export const mriPrepMine = wrap(async (req, res) => successResponse(res, await getMriPrep(req.user.id)));

// GET /api/v1/patient/invoices[?limit=] — hóa đơn viện phí của tôi (chỉ xem; thanh toán tại quầy)
export const invoicesMine = wrap(async (req, res) => successResponse(res, await listPatientInvoices(req.user.id, { limit: req.query.limit })));

// PUT /api/v1/patient/mri-prep/:visitId/screening { answers, details } — bệnh nhân tự khai sàng lọc an toàn MRI
export const saveScreeningMine = wrap(async (req, res) =>
  successResponse(res, await saveMriScreening(req.user.id, req.params.visitId, req.body), "Đã lưu phiếu sàng lọc. Kỹ thuật viên sẽ xem lại cùng bạn trước khi chụp."));
