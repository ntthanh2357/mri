import { ConsentForm } from "../models/consentForm.model.js";
import { PatientProfile } from "../models/patientProfile.model.js";
import { User } from "../models/user.model.js";
import "../models/visit.model.js"; // đăng ký model Visit cho populate

/**
 * UC-PAT-06 — Phiếu đồng thuận tiêm thuốc cản quang Gadolinium.
 * Bác sĩ chỉ định MRI có cản quang → phiếu tự tạo; bệnh nhân trả lời bảng sàng lọc rồi ký trên app.
 * Mọi truy vấn của bệnh nhân lọc thẳng theo patientId: tenancyPlugin chỉ lọc theo hospitalId
 * khi tài khoản bệnh nhân có hospitalId, không đủ để chặn xem phiếu của người khác.
 */

export const CONTRAST_PROCEDURE = "Tiêm thuốc cản quang Gadolinium";
export const CONTRAST_RISKS = "Phản ứng dị ứng, mẩn ngứa, buồn nôn, nguy cơ xơ hóa hệ thống do thận (NSF) nếu suy thận nặng.";
export const CONTRAST_EXPLANATION = "Thuốc cản quang Gadolinium giúp làm rõ hình ảnh u và mạch máu não.";

const ALLERGY_ANSWERS = ["yes", "no", "unknown"];
const BOOL_FIELDS = ["isPregnant", "isBreastfeeding", "kidneyDisease", "severeAsthma"];
const SVG_PATH = /^[ML0-9.\s-]+$/;
const MAX_SVG_PATH = 20000;

const httpError = (status, message) => Object.assign(new Error(message), { status });

/** Mức nguy cơ theo bảng sàng lọc (cùng ngưỡng với luồng sàng lọc của nhân viên). */
export const assessContrastRisk = (c = {}) => {
  let riskLevel = "low";
  const riskFactors = [];
  const raise = (level, reason) => {
    riskFactors.push(reason);
    if (level === "high" || riskLevel === "low") riskLevel = level;
  };
  if (c.contrastAllergy === "yes") raise("high", "Có tiền sử dị ứng thuốc cản quang");
  const gfr = c.gfrLevel === undefined || c.gfrLevel === null ? null : Number(c.gfrLevel);
  if (gfr !== null && gfr < 30) raise("high", `Chức năng thận suy giảm nặng (eGFR = ${gfr} mL/min/1.73m²)`);
  else if (gfr !== null && gfr < 60) raise("moderate", `Chức năng thận suy giảm nhẹ/trung bình (eGFR = ${gfr} mL/min/1.73m²)`);
  if (c.isPregnant) raise("moderate", "Đang mang thai hoặc nghi ngờ mang thai");
  if (c.kidneyDisease) raise("moderate", "Tiền sử bệnh thận mạn");
  if (c.severeAsthma) raise("moderate", "Hen phế quản nặng");
  return { riskLevel, isBlocked: riskLevel === "high", riskFactors };
};

/** Bảng sàng lọc do bệnh nhân tự trả lời; eGFR là chỉ số xét nghiệm nên không nhận từ bệnh nhân. */
export const normalizePatientChecklist = (body = {}) => {
  if (!ALLERGY_ANSWERS.includes(body.contrastAllergy)) {
    return { checklist: null, error: "Vui lòng cho biết bạn có từng dị ứng thuốc cản quang không." };
  }
  const checklist = { contrastAllergy: body.contrastAllergy };
  for (const k of BOOL_FIELDS) checklist[k] = body[k] === true || body[k] === "true";
  return { checklist, error: null };
};

/** Chữ ký vẽ (đường SVG) hoặc chữ ký gõ tên. Ném lỗi 400 nếu không hợp lệ. */
export const normalizeSignature = (sig = {}) => {
  if (sig.kind === "drawn") {
    const path = String(sig.svgPath || "").trim();
    if (!path || path.length > MAX_SVG_PATH || !SVG_PATH.test(path) || !path.includes("L")) {
      throw httpError(400, "Chữ ký vẽ không hợp lệ, vui lòng ký lại.");
    }
    return { kind: "drawn", svgPath: path, text: "" };
  }
  if (sig.kind === "typed") {
    const text = String(sig.text || "").replace(/\s+/g, " ").trim();
    if (text.length < 2 || text.length > 80) throw httpError(400, "Vui lòng gõ họ tên làm chữ ký (2–80 ký tự).");
    return { kind: "typed", svgPath: "", text };
  }
  throw httpError(400, "Kiểu chữ ký không hợp lệ.");
};

export const CONTRAST_UNSIGNED_MESSAGE = "Bệnh nhân chưa ký phiếu đồng thuận tiêm thuốc cản quang. Chưa thể bắt đầu chụp.";

/** Ca chụp có tiêm cản quang mà bệnh nhân chưa ký phiếu → chưa được bắt đầu chụp. */
export const contrastConsentPending = async (visit) => {
  if (!visit?.mriOrder?.withContrast) return false;
  const consent = await ConsentForm.findOne({ visitId: visit._id, hospitalId: visit.hospitalId, procedureName: CONTRAST_PROCEDURE })
    .select("patientSigned")
    .lean();
  return !consent?.patientSigned;
};

/** Tạo phiếu cho lượt khám nếu chưa có (bác sĩ chỉ định MRI có tiêm cản quang). */
export const ensureContrastConsentForVisit = async (visit) => {
  const existing = await ConsentForm.findOne({ visitId: visit._id, hospitalId: visit.hospitalId, procedureName: CONTRAST_PROCEDURE });
  if (existing) return existing;
  return ConsentForm.create({
    hospitalId: visit.hospitalId,
    visitId: visit._id,
    medicalRecordId: visit._id, // giống luồng sàng lọc cũ: phiếu gắn theo lượt khám
    patientId: visit.patientId,
    procedureName: CONTRAST_PROCEDURE,
    risks: CONTRAST_RISKS,
    doctorExplanation: CONTRAST_EXPLANATION,
  });
};

const findMine = async (patientId, consentId) => {
  const consent = await ConsentForm.findOne({ _id: consentId, patientId, procedureName: CONTRAST_PROCEDURE });
  if (!consent) throw httpError(404, "Không tìm thấy phiếu đồng thuận.");
  return consent;
};

export const listPatientConsents = async (patientId) =>
  await ConsentForm.find({ patientId, procedureName: CONTRAST_PROCEDURE })
    .populate("visitId", "date createdAt mriOrder.region")
    .sort({ createdAt: -1 })
    .lean();

export const submitPatientChecklist = async (patientId, consentId, body) => {
  const consent = await findMine(patientId, consentId);
  if (consent.patientSigned) throw httpError(409, "Phiếu đã ký, không sửa được bảng sàng lọc.");
  const { checklist, error } = normalizePatientChecklist(body);
  if (error) throw httpError(400, error);
  const prev = consent.allergyChecklist || {};
  const changed = !consent.patientChecklistAt
    || prev.contrastAllergy !== checklist.contrastAllergy
    || BOOL_FIELDS.some((k) => Boolean(prev[k]) !== checklist[k]);
  // Giữ eGFR do nhân viên nhập (nếu có)
  const gfrLevel = prev.gfrLevel ?? null;
  consent.allergyChecklist = { ...checklist, gfrLevel };
  const { riskLevel, isBlocked } = assessContrastRisk(consent.allergyChecklist);
  consent.riskLevel = riskLevel;
  // Bác sĩ đã duyệt đúng bộ câu trả lời này thì giữ; câu trả lời đổi mà vẫn nguy cơ cao thì phải duyệt lại
  if (changed && isBlocked) consent.isDoctorOverridden = false;
  consent.isBlockedByChecklist = isBlocked && !consent.isDoctorOverridden;
  consent.patientChecklistAt = new Date();
  await consent.save();
  return consent;
};

export const signConsentAsPatient = async (patientId, consentId, { agree, signature, saveSignature } = {}) => {
  const consent = await findMine(patientId, consentId);
  if (consent.patientSigned) throw httpError(409, "Phiếu này đã được ký.");
  if (!consent.patientChecklistAt) throw httpError(409, "Vui lòng trả lời bảng câu hỏi sàng lọc trước khi ký.");
  if (consent.isBlockedByChecklist && !consent.isDoctorOverridden) {
    throw httpError(409, "Phiếu đang chờ bác sĩ xem xét nguy cơ, bạn chưa ký được.");
  }
  if (agree !== true) throw httpError(400, "Vui lòng xác nhận bạn đã đọc và đồng ý với nội dung phiếu.");
  const sig = normalizeSignature(signature);

  const user = await User.findById(patientId).select("profile.name profile.fullName").lean();
  consent.patientSigned = true;
  consent.patientSignature = sig.text || user?.profile?.name || user?.profile?.fullName || "Bệnh nhân";
  consent.patientSignatureKind = sig.kind;
  consent.patientSignatureSvg = sig.svgPath;
  consent.patientSignedAt = new Date();
  await consent.save();

  if (saveSignature) {
    // Không upsert: tenancyPlugin chèn $or vào bộ lọc của phiên bệnh nhân, upsert sẽ lỗi
    const profile = (await PatientProfile.findOne({ userId: patientId })) || new PatientProfile({ userId: patientId, hospitalId: consent.hospitalId });
    profile.savedSignature = { kind: sig.kind, svgPath: sig.svgPath, text: sig.text, updatedAt: new Date() };
    await profile.save();
  }
  return consent;
};

export const getSavedSignature = async (patientId) => {
  const profile = await PatientProfile.findOne({ userId: patientId }).select("savedSignature").lean();
  return profile?.savedSignature?.kind ? profile.savedSignature : null;
};
