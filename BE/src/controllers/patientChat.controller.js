import { askHealthQuestion, getChatConsent, grantChatConsent, revokeChatConsent } from "../services/patientChat.service.js";
import { successResponse, errorResponse } from "../utils/response.util.js";

const wrap = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res);
  } catch (err) {
    // mã lỗi đồng ý gửi kèm để giao diện hiện lại khung xin đồng ý, không phải đoán theo câu chữ
    if (err.status) return errorResponse(res, err.message, err.status, ["CONSENT_REQUIRED", "CONSENT_OUTDATED"].includes(err.code) ? { code: err.code } : null);
    return next(err);
  }
};

// POST /api/v1/patient/chat { message } — hỏi đáp sức khỏe (chỉ bệnh nhân; phân quyền ở routes)
export const askMine = wrap(async (req, res) => successResponse(res, await askHealthQuestion(req.user.id, req.body?.message)));

// GET / PUT { version } / DELETE /api/v1/patient/chat/consent — đồng ý gửi câu hỏi tới dịch vụ AI (xem / đồng ý / rút lại)
export const consentMine = wrap(async (req, res) => successResponse(res, await getChatConsent(req.user.id)));
export const grantConsentMine = wrap(async (req, res) =>
  successResponse(res, await grantChatConsent(req.user.id, req.body?.version), "Đã ghi nhận bạn đồng ý. Bạn có thể đặt câu hỏi."));
export const revokeConsentMine = wrap(async (req, res) =>
  successResponse(res, await revokeChatConsent(req.user.id), "Đã rút lại đồng ý. Câu hỏi mới sẽ không được gửi đi."));
