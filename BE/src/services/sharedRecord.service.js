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
const httpError = (status, message) => Object.assign(new Error(message), { status });

/** Nhóm bệnh nhân chọn để chia sẻ (thông tin cơ bản: tên, tuổi, giới, mã BN luôn có). */
export const SHARE_SECTIONS = ["visits", "imaging", "prescriptions", "labs", "vitals", "safety", "inpatient", "papers", "documents"];
/** Lượt chia sẻ tạo trước khi có chọn nhóm: đúng 8 nhóm lúc đó — không tự thêm "documents" (bệnh nhân chưa từng đồng ý). */
export const LEGACY_SHARE_SECTIONS = SHARE_SECTIONS.filter((s) => s !== "documents");
/** Nhóm "safety" không phải danh sách bản ghi: 2 mục cố định, chọn riêng được. */
export const SAFETY_ITEMS = ["allergies", "emergencyContact"];
export const MAX_ITEMS_PER_SECTION = 500; // số mục tối đa bệnh nhân chọn trong 1 nhóm
export const CATALOG_LIMIT = 300; // số mục mới nhất của mỗi nhóm đưa vào danh mục để chọn
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

/**
 * Truy vấn của từng nhóm dạng danh sách — LUÔN lọc theo đúng bệnh nhân; `ids` (mảng mã) = chỉ các mục đó.
 * Dùng chung cho: gom bệnh án chia sẻ, danh mục để bệnh nhân chọn, và kiểm tra mục được chọn có thuộc bệnh nhân không.
 * Mỗi nhóm trả 1 mảng truy vấn (nhóm "papers" gồm 2 loại giấy).
 */
const sectionQueries = (patientId, medicalId) => {
  const only = (ids) => (ids ? { _id: { $in: ids } } : {});
  return {
    visits: (ids) => [Visit.find({ patientId, ...only(ids) }).sort({ createdAt: -1 })],
    vitals: (ids) => [VitalSign.find({ patient_id: patientId, ...only(ids) }).sort({ recorded_at: -1 })],
    labs: (ids) => [LabOrder.find({ patient_id: patientId, ...only(ids) }).sort({ ordered_at: -1 })],
    prescriptions: (ids) => [Prescription.find({ patient_id: patientId, ...only(ids) }).sort({ recorded_at: -1 })],
    papers: (ids) => [
      DischargePaper.find({ patient_id: patientId, ...only(ids) }).sort({ recorded_at: -1 }),
      TransferForm.find({ patient_id: patientId, ...only(ids) }).sort({ recorded_at: -1 }),
    ],
    // chưa có mã bệnh án thì không có phim nào để truy vấn
    imaging: (ids) => (medicalId ? [ImagingResult.find({ medicalId, isSigned: true, ...only(ids) }).sort({ reportDate: -1 })] : []),
    inpatient: (ids) => [MedicalRecord.find({ patientId: { $in: [String(patientId), medicalId].filter(Boolean) }, ...only(ids) }).sort({ createdAt: -1 })],
  };
};
const LIST_SECTIONS = ["visits", "vitals", "labs", "prescriptions", "papers", "imaging", "inpatient"];
const VISIT_FIELDS = "createdAt date reason visitType status priority vitals mriOrder.region doctorId";
// Trường mỗi nhóm cần cho danh mục (tên, ngày, từ khoá): không nạp phần còn lại, nhất là báo cáo AI của phim và ghi chú nhạy cảm của bệnh án nội trú
const CATALOG_FIELDS = {
  visits: VISIT_FIELDS,
  vitals: "recorded_at pulse blood_pressure spo2 temperature",
  labs: "category ordered_at resulted_at results.biomarker_name",
  prescriptions: "recorded_at doctor_name diagnosis drugs.name",
  papers: "recorded_at diagnosis doctor_name dateOut dischargeNo transferTo transferNo reason",
  imaging: "procedure imagingType technique diagnosis conclusion radiologist orderingDoctor reportDate orderDate",
  inpatient: "department diagnosis doctorInCharge tumorType status createdAt",
};

const patientOf = async (patientId) => {
  const user = await User.findById(patientId).select("profile").setOptions(BYPASS).lean();
  if (!user) throw httpError(404, "Không tìm thấy bệnh nhân.");
  return user;
};

/**
 * `itemIds` { nhóm: [mã mục] }: bệnh nhân chỉ chia sẻ một số mục trong nhóm đó (chốt lúc tạo mã).
 * Nhóm không có danh sách = cả nhóm, kể cả mục phát sinh sau khi tạo mã. Danh sách rỗng = không trả gì.
 */
export const buildSharedRecord = async (patientId, sections = SHARE_SECTIONS, { shareId = null, documentIds, itemIds } = {}) => {
  const user = await patientOf(patientId);
  const medicalId = user.profile?.medicalId || null;
  const has = (s) => sections.includes(s);
  // không có danh sách → cả nhóm; có mà không phải mảng (dữ liệu hỏng) → coi như rỗng, không trả gì
  const idsOf = (s) => {
    const list = itemIds?.[s];
    if (list === undefined) return null;
    return Array.isArray(list) ? list : [];
  };
  const q = sectionQueries(patientId, medicalId);
  // nhóm không chọn: không truy vấn, không gửi
  const load = (s, prepare = (query) => query) => (has(s) ? Promise.all(q[s](idsOf(s)).map((query) => prepare(query).setOptions(BYPASS).lean())) : Promise.resolve([[], []]));

  const [profile, [visits = []], [vitals = []], [labs = []], [prescriptions = []], [discharges = [], transfers = []], [imaging = []], [emrRecords = []]] = await Promise.all([
    PatientProfile.findOne({ userId: patientId }).setOptions(BYPASS).lean(),
    load("visits", (query) => query.populate("doctorId", "profile.name").select(VISIT_FIELDS)),
    load("vitals", (query) => query.sort({ recorded_at: 1 })), // biểu đồ cần thứ tự cũ → mới
    load("labs"),
    load("prescriptions"),
    load("papers"),
    load("imaging"),
    load("inpatient"),
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
    // nhóm bệnh nhân chỉ chia sẻ một số mục: người xem cần biết là danh sách KHÔNG đầy đủ
    partial: sections.filter((s) => s !== "documents" && idsOf(s)),
    patient: {
      name: user.profile?.name || user.profile?.fullName || "Bệnh nhân",
      gender: profile?.gender || user.profile?.gender || "",
      dateOfBirth: profile?.dateOfBirth || user.profile?.dateOfBirth || null,
      medicalId,
    },
    generatedAt: new Date(),
  };
  if (has("safety")) {
    // `shared` cho người xem biết phần nào bệnh nhân KHÔNG chia sẻ (khác với "chưa khai báo")
    const parts = SAFETY_ITEMS.filter((k) => (idsOf("safety") || SAFETY_ITEMS).includes(k));
    const full = toSharedSafety(profile);
    out.safety = {
      shared: parts,
      ...(parts.includes("allergies") ? { drugAllergies: full.drugAllergies } : {}),
      ...(parts.includes("emergencyContact") ? { emergencyContact: full.emergencyContact } : {}),
    };
  }
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

// ── Chọn từng mục ───────────────────────────────────────────────────────────

const isObjectIdText = (v) => typeof v === "string" && /^[a-f0-9]{24}$/i.test(v);
const invalidItems = () => httpError(400, "Mục được chọn để chia sẻ không hợp lệ.");

/**
 * Danh sách mục bệnh nhân chọn { nhóm: [mã] } → bản đã kiểm tra, hoặc undefined nếu không chọn riêng nhóm nào.
 * Mỗi mã phải là mục của CHÍNH bệnh nhân trong ĐÚNG nhóm đó (mã của người khác, phim chưa ký, mã bịa → 400).
 * Không nhận nhóm "documents" ở đây: giấy tờ tự quét kiểm ở scannedDocument.service (resolveShareDocumentIds).
 */
export const resolveShareItems = async (patientId, sections, input) => {
  if (input === undefined || input === null) return undefined;
  if (typeof input !== "object" || Array.isArray(input)) throw invalidItems();
  const keys = Object.keys(input);
  if (!keys.length) return undefined;
  if (keys.length > SHARE_SECTIONS.length || keys.some((k) => !sections.includes(k) || !(k === "safety" || LIST_SECTIONS.includes(k)))) throw invalidItems();

  const chosen = {};
  for (const key of keys) {
    const list = input[key];
    if (!Array.isArray(list) || !list.length || list.length > MAX_ITEMS_PER_SECTION) throw invalidItems();
    if (list.some((v) => (key === "safety" ? !SAFETY_ITEMS.includes(v) : !isObjectIdText(v)))) throw invalidItems();
    chosen[key] = [...new Set(key === "safety" ? list : list.map((v) => v.toLowerCase()))]; // bỏ trùng
  }

  const listKeys = keys.filter((k) => k !== "safety");
  if (listKeys.length) {
    const user = await patientOf(patientId);
    const q = sectionQueries(patientId, user.profile?.medicalId || null);
    await Promise.all(listKeys.map(async (key) => {
      const found = await Promise.all(q[key](chosen[key]).map((query) => query.select("_id").setOptions(BYPASS).lean()));
      if (found.flat().length !== chosen[key].length) throw invalidItems();
    }));
  }
  if (chosen.safety) chosen.safety = SAFETY_ITEMS.filter((k) => chosen.safety.includes(k));
  return chosen;
};

const clip = (v, max = 160) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
/** Chữ để tìm kiếm ở phía giao diện (thường, gọn, có giới hạn). */
const keywordsOf = (...parts) => clip(parts.flat(3).filter(Boolean).join(" "), 600).toLowerCase();
const entry = (section, doc, { title, sub = "", date = null, source = "hospital", keywords = [] }) => ({
  section, id: String(doc._id ?? doc), title: clip(title, 120), sub: clip(sub), date, source, keywords: keywordsOf(title, sub, keywords),
});

/**
 * Danh mục các mục bệnh nhân có thể chọn chia sẻ, cho màn "Chia sẻ bệnh án": mỗi mục có nhóm, mã, tên, ngày,
 * nguồn ("hospital" = bệnh viện ghi, "self" = bệnh nhân tự khai / tự quét) và từ khoá tìm kiếm.
 * Mỗi nhóm lấy tối đa CATALOG_LIMIT mục mới nhất; nhóm bị cắt nằm trong `truncated`.
 */
export const buildShareCatalog = async (patientId) => {
  const user = await patientOf(patientId);
  const q = sectionQueries(patientId, user.profile?.medicalId || null);
  const load = (s, prepare = (query) => query) => Promise.all(q[s]().map((query) => prepare(query).select(CATALOG_FIELDS[s]).limit(CATALOG_LIMIT + 1).setOptions(BYPASS).lean()));
  const [profile, [visits = []], [vitals = []], [labs = []], [prescriptions = []], [discharges = [], transfers = []], [imaging = []], [emr = []], documents] = await Promise.all([
    PatientProfile.findOne({ userId: patientId }).setOptions(BYPASS).lean(),
    load("visits", (query) => query.populate("doctorId", "profile.name")),
    load("vitals"), load("labs"), load("prescriptions"), load("papers"), load("imaging"), load("inpatient"),
    listSharedDocuments(patientId),
  ]);

  const truncated = [];
  const cap = (section, list) => {
    if (list.length > CATALOG_LIMIT && !truncated.includes(section)) truncated.push(section);
    return list.slice(0, CATALOG_LIMIT);
  };
  const safety = toSharedSafety(profile);
  const contact = safety.emergencyContact;

  const items = [
    ...cap("visits", visits).map((v) => entry("visits", v, {
      title: v.reason ? `Lượt khám: ${v.reason}` : "Lượt khám", sub: [v.visitType, v.doctorId?.profile?.name ? `bác sĩ ${v.doctorId.profile.name}` : ""].filter(Boolean).join(", "),
      date: v.date || v.createdAt, keywords: [v.status, v.mriOrder?.region],
    })),
    ...cap("imaging", imaging).map((f) => entry("imaging", f, {
      title: f.procedure || f.imagingType || "Phim chụp", sub: f.conclusion || f.diagnosis, date: f.reportDate || f.orderDate,
      keywords: [f.imagingType, f.technique, f.diagnosis, f.radiologist, f.orderingDoctor],
    })),
    ...cap("prescriptions", prescriptions).map((p) => entry("prescriptions", p, {
      title: "Đơn thuốc", sub: [p.diagnosis, (p.drugs || []).length ? `${p.drugs.length} thuốc` : ""].filter(Boolean).join(", "), date: p.recorded_at,
      keywords: [p.doctor_name, (p.drugs || []).slice(0, 30).map((d) => d?.name)],
    })),
    ...cap("labs", labs).map((l) => entry("labs", l, {
      title: l.category || "Xét nghiệm", sub: (l.results || []).length ? `${l.results.length} chỉ số` : "", date: l.resulted_at || l.ordered_at,
      keywords: [(l.results || []).slice(0, 40).map((r) => r?.biomarker_name)],
    })),
    ...cap("vitals", vitals).map((v) => entry("vitals", v, {
      title: "Sinh hiệu",
      sub: [v.blood_pressure ? `huyết áp ${v.blood_pressure}` : "", v.pulse ? `mạch ${v.pulse}` : "", v.spo2 ? `SpO₂ ${v.spo2}%` : "", v.temperature ? `nhiệt độ ${v.temperature} °C` : ""].filter(Boolean).join(", "),
      date: v.recorded_at,
    })),
    entry("safety", "allergies", { title: "Dị ứng thuốc", sub: safety.drugAllergies.length ? safety.drugAllergies.join(", ") : "Chưa khai báo", source: "self" }),
    entry("safety", "emergencyContact", { title: "Người liên hệ khẩn cấp", sub: [contact.name, contact.relation ? `(${contact.relation})` : ""].filter(Boolean).join(" ") || "Chưa khai báo", source: "self" }),
    ...cap("inpatient", emr).map((r) => entry("inpatient", r, {
      title: r.department ? `Bệnh án nội trú: ${r.department}` : "Bệnh án nội trú", sub: r.diagnosis, date: r.createdAt, keywords: [r.doctorInCharge, r.tumorType, r.status],
    })),
    ...cap("papers", discharges).map((d) => entry("papers", d, { title: "Giấy ra viện", sub: d.diagnosis, date: d.dateOut || d.recorded_at, keywords: [d.doctor_name, d.dischargeNo] })),
    ...cap("papers", transfers).map((t) => entry("papers", t, {
      title: t.transferTo ? `Giấy chuyển viện đến ${t.transferTo}` : "Giấy chuyển viện", sub: t.diagnosis, date: t.recorded_at, keywords: [t.doctor_name, t.transferNo, t.reason],
    })),
    ...documents.map((d) => entry("documents", d, {
      title: d.title, sub: [d.fields?.facility, d.fields?.diagnosis].filter(Boolean).join(", "), date: d.createdAt, source: "self",
      keywords: [d.fields?.doctor, d.fields?.date, (d.fields?.medications || []).map((m) => m?.name), clip(d.text, 300)],
    })),
  ];
  return { items, truncated, limit: CATALOG_LIMIT };
};
