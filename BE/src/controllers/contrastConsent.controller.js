import { ConsentForm } from "../models/consentForm.model.js";
import { Visit } from "../models/visit.model.js";
import { User } from "../models/user.model.js";
import { successResponse, errorResponse } from "../utils/response.util.js";

// ─── S.1 — Sàng lọc nguy cơ dị ứng trước khi tiêm thuốc cản quang Gadolinium ─
// @route POST /api/v1/contrast-consents/screening
// @access Private (Technician, Doctor, Nurse)
export const submitScreeningChecklist = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    const {
      visitId,
      patientId,
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
    let consentForm = await ConsentForm.findOne({ visitId, procedureName: "Tiêm thuốc cản quang Gadolinium" });
    if (!consentForm) {
      consentForm = new ConsentForm({
        hospitalId,
        visitId,
        medicalRecordId: visit._id, // Tạm gắn với visitId
        patientId: patientId || visit.patientId,
        procedureName: "Tiêm thuốc cản quang Gadolinium",
        risks: "Phản ứng dị ứng, mẩn ngứa, buồn nôn, nguy cơ xơ hóa hệ thống do thận (NSF) nếu suy thận nặng.",
        doctorExplanation: "Thuốc cản quang Gadolinium giúp làm rõ hình ảnh u và mạch máu não.",
      });
    }

    consentForm.allergyChecklist = {
      contrastAllergy,
      gfrLevel: gfrLevel !== undefined ? Number(gfrLevel) : null,
      isPregnant: Boolean(isPregnant),
      isBreastfeeding: Boolean(isBreastfeeding),
      kidneyDisease: Boolean(kidneyDisease),
      severeAsthma: Boolean(severeAsthma),
    };
    consentForm.riskLevel = riskLevel;
    consentForm.isBlockedByChecklist = isBlocked;
    await consentForm.save();

    return successResponse(res, {
      consentForm,
      riskLevel,
      isBlocked,
      riskFactors,
      message: isBlocked
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
    if (!["doctor", "admin"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ bác sĩ mới có quyền override cảnh báo nguy cơ cản quang.", 403);
    }

    const consentForm = await ConsentForm.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    });
    if (!consentForm) return errorResponse(res, "Không tìm thấy phiếu đồng thuận.", 404);

    const { overrideReason } = req.body;
    if (!overrideReason) return errorResponse(res, "Bắt buộc nhập lý do xác nhận override.", 400);

    consentForm.isDoctorOverridden = true;
    consentForm.doctorOverrideReason = overrideReason;
    consentForm.doctorOverrideByUserId = req.user.id;
    consentForm.doctorSigned = true;
    consentForm.doctorSignature = req.user.name || "Bác sĩ chỉ định";
    consentForm.isBlockedByChecklist = false; // Mở chặn
    await consentForm.save();

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

    if (consentForm.isBlockedByChecklist && !consentForm.isDoctorOverridden) {
      return errorResponse(res, "Phiếu này đang bị CHẶN do nguy cơ dị ứng chưa được bác sĩ duyệt override.", 400);
    }

    const { patientName } = req.body;
    if (!patientName) return errorResponse(res, "Thiếu họ tên người ký xác nhận.", 400);

    consentForm.patientSigned = true;
    consentForm.patientSignature = patientName;
    consentForm.signedAt = new Date();
    await consentForm.save();

    return successResponse(res, { consentForm }, "Bệnh nhân đã ký đồng thuận điện tử thành công.");
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

    return successResponse(res, consent, "Lấy thông tin phiếu đồng thuận thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};
