import { User } from "../models/user.model.js";
import { PatientProfile } from "../models/patientProfile.model.js";
import { Visit } from "../models/visit.model.js";
import { VitalSign } from "../models/vitalSign.model.js";
import { LabOrder } from "../models/labOrder.model.js";
import { Prescription } from "../models/prescription.model.js";
import { DischargePaper } from "../models/dischargePaper.model.js";
import { TransferForm } from "../models/transferForm.model.js";
import { ImagingResult } from "../models/imagingResult.model.js";
import { MedicalRecord } from "../modules/emr/models/medicalRecord.model.js";
import { CareSheet } from "../modules/emr/models/careSheet.model.js";
import { Consultation } from "../modules/emr/models/consultation.model.js";
import { listSharedDocuments, toPublicDoc } from "./scannedDocument.service.js";

/**
 * UC-PAT-09 — Gom bệnh án hoàn chỉnh của 1 bệnh nhân để người quét QR xem (chỉ đọc).
 * Gồm: lượt khám, phim đã ký, đơn thuốc, xét nghiệm, sinh hiệu, dị ứng & liên hệ khẩn cấp, bệnh án nội trú.
 * KHÔNG gồm: CCCD, thẻ BHYT, ghi chú tâm thần/HIV/di truyền, dữ liệu kỹ thuật nội bộ.
 * Mọi truy vấn bỏ qua tenancy (trang công khai không có phiên đăng nhập) nhưng luôn lọc theo đúng bệnh nhân.
 */

const BYPASS = { bypassTenancy: true };

/** Nhóm bệnh nhân chọn để chia sẻ (thông tin cơ bản: tên, tuổi, giới, mã BN luôn có). */
export const SHARE_SECTIONS = ["visits", "imaging", "prescriptions", "labs", "vitals", "safety", "inpatient", "papers", "documents"];
/** Lượt chia sẻ tạo trước khi có chọn nhóm: đúng 8 nhóm lúc đó — không tự thêm "documents" (bệnh nhân chưa từng đồng ý). */
export const LEGACY_SHARE_SECTIONS = SHARE_SECTIONS.filter((s) => s !== "documents");
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj?.[k] !== undefined).map((k) => [k, obj[k]]));

const EMR_FIELDS = ["_id", "admissionType", "department", "diagnosis", "treatmentPlan", "status", "dischargeDate", "doctorInCharge",
  "signStatus", "allergies", "tumorType", "whoGrade", "molecularMarkers", "createdAt", "updatedAt"];
const IMAGING_FIELDS = ["_id", "procedure", "imagingType", "technique", "diagnosis", "findings", "conclusion", "radiologist",
  "orderingDoctor", "orderDate", "reportDate", "signedAt", "images", "representativeSliceUrl"];

/** Bệnh án nội trú: chỉ trường lâm sàng cần thiết, kèm phiếu chăm sóc và hội chẩn. */
export const toSharedEmr = (record, { careSheets = [], consultations = [] } = {}) => ({
  ...pick(record, EMR_FIELDS),
  careSheets: careSheets.map((c) => pick(c, ["careLevel", "pulse", "bloodPressure", "temperature", "respiratoryRate", "progressNotes", "careActions", "nurse", "createdAt"])),
  consultations: consultations.map((c) => pick(c, ["meetingDate", "consultationType", "clinicalSummary", "diagnosis", "treatmentConclusion", "participants"])),
});

/** Phim chụp: chỉ phim bác sĩ đã ký. */
export const toSharedImaging = (img) => (img?.isSigned ? pick(img, IMAGING_FIELDS) : null);

/** Thông tin an toàn: dị ứng thuốc + người liên hệ khẩn cấp (không lấy CCCD/BHYT). */
export const toSharedSafety = (profile) => ({
  drugAllergies: Array.isArray(profile?.drugAllergies) ? profile.drugAllergies : [],
  emergencyContact: pick(profile?.emergencyContact || {}, ["name", "relation", "phone"]),
});

export const buildSharedRecord = async (patientId, sections = SHARE_SECTIONS, { shareId = null, documentIds } = {}) => {
  const user = await User.findById(patientId).select("profile").setOptions(BYPASS).lean();
  if (!user) throw Object.assign(new Error("Không tìm thấy bệnh nhân."), { status: 404 });
  const medicalId = user.profile?.medicalId || null;
  const has = (s) => sections.includes(s);
  const only = (s, query) => (has(s) ? query() : []); // nhóm không chọn: không truy vấn, không gửi

  const [profile, visits, vitals, labs, prescriptions, discharges, transfers, imaging, emrRecords] = await Promise.all([
    PatientProfile.findOne({ userId: patientId }).setOptions(BYPASS).lean(),
    only("visits", () => Visit.find({ patientId }).sort({ createdAt: -1 }).populate("doctorId", "profile.name").select("createdAt date reason visitType status priority vitals mriOrder.region doctorId").setOptions(BYPASS).lean()),
    only("vitals", () => VitalSign.find({ patient_id: patientId }).sort({ recorded_at: 1 }).setOptions(BYPASS).lean()),
    only("labs", () => LabOrder.find({ patient_id: patientId }).sort({ ordered_at: -1 }).setOptions(BYPASS).lean()),
    only("prescriptions", () => Prescription.find({ patient_id: patientId }).sort({ recorded_at: -1 }).setOptions(BYPASS).lean()),
    only("papers", () => DischargePaper.find({ patient_id: patientId }).sort({ recorded_at: -1 }).setOptions(BYPASS).lean()),
    only("papers", () => TransferForm.find({ patient_id: patientId }).sort({ recorded_at: -1 }).setOptions(BYPASS).lean()),
    only("imaging", () => (medicalId ? ImagingResult.find({ medicalId, isSigned: true }).sort({ reportDate: -1 }).setOptions(BYPASS).lean() : [])),
    only("inpatient", () => MedicalRecord.find({ patientId: { $in: [String(patientId), medicalId].filter(Boolean) } }).sort({ createdAt: -1 }).setOptions(BYPASS).lean()),
  ]);

  const emrIds = emrRecords.map((r) => r._id);
  const [careSheets, consultations] = emrIds.length
    ? await Promise.all([
      CareSheet.find({ medicalRecordId: { $in: emrIds } }).sort({ createdAt: -1 }).setOptions(BYPASS).lean(),
      Consultation.find({ medicalRecordId: { $in: emrIds } }).sort({ meetingDate: -1 }).setOptions(BYPASS).lean(),
    ])
    : [[], []];
  const byRecord = (list, id) => list.filter((x) => String(x.medicalRecordId) === String(id));

  const out = {
    sections,
    patient: {
      name: user.profile?.name || user.profile?.fullName || "Bệnh nhân",
      gender: profile?.gender || user.profile?.gender || "",
      dateOfBirth: profile?.dateOfBirth || user.profile?.dateOfBirth || null,
      medicalId,
    },
    generatedAt: new Date(),
  };
  if (has("safety")) out.safety = toSharedSafety(profile);
  if (has("visits")) {
    out.visits = visits.map((v) => ({
      date: v.date || v.createdAt, reason: v.reason, visitType: v.visitType, status: v.status, priority: v.priority,
      doctor: v.doctorId?.profile?.name || "", vitals: v.vitals || null, mriRegion: v.mriOrder?.region || "",
    }));
  }
  if (has("imaging")) out.imaging = imaging.map(toSharedImaging).filter(Boolean);
  if (has("vitals")) out.vitals = vitals.map((v) => pick(v, ["recorded_at", "pulse", "blood_pressure", "spo2", "temperature", "weight", "height", "bmi"]));
  if (has("labs")) out.labs = labs.map((l) => pick(l, ["category", "status", "ordered_at", "resulted_at", "results"]));
  if (has("prescriptions")) out.prescriptions = prescriptions.map((p) => pick(p, ["recorded_at", "doctor_name", "diagnosis", "drugs", "status", "note"]));
  if (has("papers")) {
    out.dischargePapers = discharges.map((d) => pick(d, ["recorded_at", "dischargeNo", "doctor_name", "diagnosis", "dateIn", "dateOut", "treatment", "note"]));
    out.transferForms = transfers.map((t) => pick(t, ["recorded_at", "transferNo", "doctor_name", "diagnosis", "dateIn", "dateOut", "transferTo", "reason", "reasonDetail", "clinicalSummary", "labSummary", "drugsUsed", "patientStatus", "treatment", "treatmentDirection", "status"]));
  }
  if (has("inpatient")) out.inpatientRecords = emrRecords.map((r) => toSharedEmr(r, { careSheets: byRecord(careSheets, r._id), consultations: byRecord(consultations, r._id) }));
  // Giấy tờ bệnh nhân tự chụp: chỉ bản đã kiểm tra; link ảnh ngắn hạn, gắn với lượt chia sẻ (dừng chia sẻ là hết xem)
  if (has("documents")) out.scannedDocuments = (await listSharedDocuments(patientId, documentIds)).map((d) => toPublicDoc(d, { shareId }));
  return out;
};
