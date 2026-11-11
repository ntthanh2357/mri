import { ConsentForm } from "../models/consentForm.model.js";
import { Visit } from "../models/visit.model.js";
import { User } from "../models/user.model.js";
import { successResponse, errorResponse } from "../utils/response.util.js";
import { recordAuditLog, AUDIT_ACTIONS } from "../services/auditLog.service.js";
import { createNotificationInternal } from "./notification.controller.js";

const CONTRAST_OVERRIDE_ROLES = ["doctor", "radiologist", "department_head"];
const logContrast = async (action, req, entityId, details, payload) => {
  try {
    await recordAuditLog({ action, entity: "ConsentForm", entityId: String(entityId), performedBy: String(req.user.id || req.user._id), hospitalId: req.user.hospitalId, details, payload });
  } catch (err) {
    console.warn("Không ghi được nhật ký cản quang:", err.message);
  }
};

// ─── S.1 — Sàng lọc nguy cơ dị ứng trước khi tiêm thuốc cản quang Gadolinium ─
// @route POST /api/v1/contrast-consents/screening
// @access Private (Technician, Doctor, Nurse)
export const submitScreeningChecklist = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    const {
      visitId,
      contrastAllergy = 'no',    // yes/no/unknown
      gfrLevel,                 // eGFR (mL/min/1.73m²)
      isPregnant = false,
      isBreastfeeding = false,
      kidneyDisease = false,
      severeAsthma = false,
    } = req.body;

    if (!visitId) return errorResponse(res, "Thiếu ID lượt khám (visitId).", 400);

    const visit = await Visit.findOne({ _id: visitId, hospitalId });
    if (!visit) return errorResponse(res, "Không tìm thấy lượt khám.", 404);

    // Tính mức độ nguy cơ (Risk Level)
    let riskLevel = 'low';
    const riskFactors = [];

    if (contrastAllergy === 'yes') {
      riskLevel = 'high';
      riskFactors.push("Có tiền sử dị ứng thuốc cản quang");
    }
    if (gfrLevel !== undefined && gfrLevel !== null && gfrLevel < 30) {
      riskLevel = 'high';
      riskFactors.push(`Chức năng thận suy giảm nặng (eGFR = ${gfrLevel} mL/min/1.73m²)`);
    } else if (gfrLevel !== undefined && gfrLevel !== null && gfrLevel < 60) {
      if (riskLevel !== 'high') riskLevel = 'moderate';
      riskFactors.push(`Chức năng thận suy giảm nhẹ/trung bình (eGFR = ${gfrLevel} mL/min/1.73m²)`);
    }
    if (isPregnant) {
      if (riskLevel !== 'high') riskLevel = 'moderate';
      riskFactors.push("Đang mang thai hoặc nghi ngờ mang thai");
    }
    if (kidneyDisease) {
      if (riskLevel !== 'high') riskLevel = 'moderate';
      riskFactors.push("Tiền sử bệnh thận mạn");
    }
    if (severeAsthma) {
      if (riskLevel !== 'high') riskLevel = 'moderate';
      riskFactors.push("Hen phế quản nặng");
    }

    const isBlocked = riskLevel === 'high';

    // Tạo hoặc cập nhật ConsentForm
    let consentForm = await ConsentForm.findOne({ visitId, hospitalId, procedureName: "Tiêm thuốc cản quang Gadolinium" });
    if (!consentForm) {
      consentForm = new ConsentForm({
        hospitalId,
        visitId,
        medicalRecordId: visit._id, // Tạm gắn với visitId
        patientId: visit.patientId, // phiếu luôn thuộc bệnh nhân của lượt khám, không lấy từ client
        procedureName: "Tiêm thuốc cản quang Gadolinium",
        risks: "Phản ứng dị ứng, mẩn ngứa, buồn nôn, nguy cơ xơ hóa hệ thống do thận (NSF) nếu suy thận nặng.",
        doctorExplanation: "Thuốc cản quang Gadolinium giúp làm rõ hình ảnh u và mạch máu não.",
      });
    }

    // Chụp giá trị cũ: đối tượng lồng của Mongoose sẽ đọc ra giá trị mới sau khi gán lại
    const prev = consentForm.toObject().allergyChecklist || {};
    consentForm.allergyChecklist = {
      contrastAllergy,
      gfrLevel: gfrLevel !== undefined ? Number(gfrLevel) : null,
      isPregnant: Boolean(isPregnant),
      isBreastfeeding: Boolean(isBreastfeeding),
      kidneyDisease: Boolean(kidneyDisease),
      severeAsthma: Boolean(severeAsthma),
    };
    consentForm.riskLevel = riskLevel;
    // Như luồng bệnh nhân tự khai: câu trả lời đổi mà vẫn nguy cơ cao thì bác sĩ phải xác nhận lại
    const changed = ["contrastAllergy", "gfrLevel", "isPregnant", "isBreastfeeding", "kidneyDisease", "severeAsthma"]
      .some((k) => String(prev[k] ?? "") !== String(consentForm.allergyChecklist[k] ?? ""));
    if (changed && isBlocked) consentForm.isDoctorOverridden = false;
    consentForm.isBlockedByChecklist = isBlocked && !consentForm.isDoctorOverridden;
    await consentForm.save();

    await logContrast(AUDIT_ACTIONS.CONTRAST_SCREENING_SUBMITTED, req, consentForm._id,
      `Sàng lọc cản quang cho lượt khám ${visit._id}: nguy cơ ${riskLevel}${riskFactors.length ? ` (${riskFactors.join(", ")})` : ""}.`,
      { visitId: String(visit._id), riskLevel, isBlocked: consentForm.isBlockedByChecklist, allergyChecklist: consentForm.allergyChecklist });
    // Spec S.1: có yếu tố nguy cơ thì cảnh báo bác sĩ chỉ định
    if (consentForm.isBlockedByChecklist && visit.doctorId) {
      await createNotificationInternal({
        hospitalId: visit.hospitalId,
        recipientId: visit.doctorId,
        senderId: req.user.id,
        type: "other",
        title: "Sàng lọc cản quang có nguy cơ cao",
        message: `Sàng lọc trước tiêm Gadolinium phát hiện: ${riskFactors.join(", ")}. Bác sĩ cần xem xét và xác nhận lý do trước khi tiếp tục.`,
        relatedId: visit._id,
      });
    }

    return successResponse(res, {
      consentForm,
      riskLevel,
      isBlocked: consentForm.isBlockedByChecklist,
      riskFactors,
      message: isBlocked && !consentForm.isBlockedByChecklist
        ? `⚠️ NGUY CƠ CAO: ${riskFactors.join(', ')}. Bác sĩ đã xác nhận cho tiêm với đúng các câu trả lời này.`
        : isBlocked
        ? `⚠️ NGUY CƠ CAO: Phát hiện ${riskFactors.join(', ')}. Đã CHẶN tiến trình. Bác sĩ cần xác nhận override lý do mới được phép chụp.`
        : riskLevel === 'moderate'
        ? `⚡ NGUY CƠ TRUNG BÌNH: Có yếu tố nghi vấn (${riskFactors.join(', ')}). Khuyến cáo theo dõi sát.`
        : "✅ AN TOÀN: Đạt tiêu chuẩn tiêm thuốc cản quang."
    }, "Sàng lọc dị ứng cản quang hoàn tất.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── S.1 — Bác sĩ xác nhận Override nguy cơ ─────────────────────────────────
// @route POST /api/v1/contrast-consents/:id/override
// @access Private (Doctor)
export const overrideChecklistRisk = async (req, res) => {
  try {
    if (!CONTRAST_OVERRIDE_ROLES.includes(req.user.role)) {
      return errorResponse(res, "Chỉ bác sĩ mới có quyền override cảnh báo nguy cơ cản quang.", 403);
    }

    const consentForm = await ConsentForm.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    });
    if (!consentForm) return errorResponse(res, "Không tìm thấy phiếu đồng thuận.", 404);

    const overrideReason = typeof req.body?.overrideReason === "string" ? req.body.overrideReason.trim() : "";
    if (!overrideReason) return errorResponse(res, "Bắt buộc nhập lý do xác nhận override.", 400);

    consentForm.isDoctorOverridden = true;
    consentForm.doctorOverrideReason = overrideReason;
    consentForm.doctorOverrideByUserId = req.user.id;
    consentForm.doctorSigned = true;
    consentForm.doctorSignature = req.user.name || "Bác sĩ chỉ định";
    consentForm.isBlockedByChecklist = false; // Mở chặn
    await consentForm.save();
    await logContrast(AUDIT_ACTIONS.CONTRAST_RISK_OVERRIDDEN, req, consentForm._id,
      `Bác sĩ xác nhận tiêm cản quang dù có nguy cơ, lý do: ${overrideReason}`,
      { visitId: String(consentForm.visitId), riskLevel: consentForm.riskLevel });

    return successResponse(res, { consentForm }, "Bác sĩ đã xác nhận override. Đã mở chặn tiến trình chụp.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── S.2 — Bệnh nhân ký đồng thuận điện tử ─────────────────────────────────
// @route POST /api/v1/contrast-consents/:id/sign-patient
// @access Private
export const signPatientConsent = async (req, res) => {
  try {
    const consentForm = await ConsentForm.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    });
    if (!consentForm) return errorResponse(res, "Không tìm thấy phiếu đồng thuận.", 404);
    // Tài khoản bệnh nhân chỉ ký phiếu của chính mình (cùng viện không có nghĩa là cùng người)
    if (req.user.role === "patient" && String(consentForm.patientId || "") !== String(req.user.id)) {
      return errorResponse(res, "Không tìm thấy phiếu đồng thuận.", 404);
    }
    // Đã ký thì không ghi đè chữ ký cũ (kể cả chữ ký tay bệnh nhân tự ký trên app)
    if (consentForm.patientSigned) {
      return errorResponse(res, "Phiếu đồng thuận này đã được ký.", 409);
    }

    if (consentForm.isBlockedByChecklist && !consentForm.isDoctorOverridden) {
      return errorResponse(res, "Phiếu này đang bị CHẶN do nguy cơ dị ứng chưa được bác sĩ duyệt override.", 400);
    }

    const { patientName } = req.body;
    if (!patientName) return errorResponse(res, "Thiếu họ tên người ký xác nhận.", 400);

    // Ghi nguyên tử: hai lần ký đồng thời thì chỉ một lần được ghi
    const signed = await ConsentForm.findOneAndUpdate(
      { _id: consentForm._id, hospitalId: consentForm.hospitalId, patientSigned: { $ne: true } },
      { $set: { patientSigned: true, patientSignature: patientName, signedAt: new Date() } },
      { new: true }
    );
    if (!signed) return errorResponse(res, "Phiếu đồng thuận này đã được ký.", 409);

    return successResponse(res, { consentForm: signed }, "Bệnh nhân đã ký đồng thuận điện tử thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── Lấy phiếu đồng thuận theo visitId ───────────────────────────────────────
// @route GET /api/v1/contrast-consents/visit/:visitId
// @access Private
export const getConsentByVisit = async (req, res) => {
  try {
    const consent = await ConsentForm.findOne({
      visitId: req.params.visitId,
      hospitalId: req.user.hospitalId,
      procedureName: "Tiêm thuốc cản quang Gadolinium"
    }).populate("doctorOverrideByUserId", "profile.name profile.fullName");

    // Bệnh nhân chỉ xem được phiếu của chính mình
    if (req.user.role === "patient" && consent && String(consent.patientId) !== String(req.user.id)) {
      return errorResponse(res, "Bạn không có quyền xem phiếu đồng thuận này.", 403);
    }

    return successResponse(res, consent, "Lấy thông tin phiếu đồng thuận thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};
