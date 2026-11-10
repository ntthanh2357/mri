import mongoose from "mongoose";
import { MedicalRecord } from "./models/medicalRecord.model.js";
import { Visit } from "../../models/visit.model.js";
import { CareSheet } from "./models/careSheet.model.js";
import { Consultation } from "./models/consultation.model.js";
import { ConsentForm } from "./models/consentForm.model.js";
import { EMRVersion } from "./models/emrVersion.model.js";
import { checkPatientTenancy } from "../../utils/tenancy.util.js";
import { normalizeTemperature } from "../../services/vitalSign.service.js";
import crypto from "crypto";
import { FEATURES } from "../../config/features.config.js";
import { recordAuditLog } from "../../services/auditLog.service.js";
import { calculateRetentionExpiry } from "../../utils/retention.util.js";
import { segregateMedicalRecord } from "../../utils/dataSegregation.util.js";
import { encryptField } from "../../services/fieldCrypto.service.js";
import { evaluateVitalSigns } from "../../services/vitalsSafety.service.js";

import { inputErrorStatus } from "../../utils/inputError.util.js";
import { normalizeCareAssessment } from "../../utils/careSheetAssessment.util.js";
// --- Medical Record (HSBA) Controllers ---

export const getRecords = async (req, res) => {
  try {
    const { search, patientId, status } = req.query;
    const hospitalId = req.user?.hospitalId;
    if (!hospitalId) {
      return res.status(403).json({ message: "Không thể xác định bệnh viện của người dùng." });
    }

    let query = { hospitalId };

    if (patientId && patientId.trim()) {
      const pidTrim = patientId.trim();
      const pidEscaped = pidTrim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const orPatientConditions = [
        { patientId: pidTrim },
        { patientId: { $regex: `^${pidEscaped}$`, $options: "i" } }
      ];
      if (mongoose.Types.ObjectId.isValid(pidTrim)) {
        orPatientConditions.push({ _id: pidTrim });
      }
      query.$or = orPatientConditions;
    }

    if (status && status.trim()) {
      query.status = status.trim();
    }

    if (search && search.trim()) {
      // [BUG-09 FIX]: Chống tấn công ReDoS bằng cách giới hạn độ dài và escape ký tự đặc biệt Regex
      const safeSearch = search.trim().substring(0, 100);
      const escaped = safeSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const orConditions = [
        { patientName: { $regex: escaped, $options: "i" } },
        { patientId: { $regex: escaped, $options: "i" } },
        { diagnosis: { $regex: escaped, $options: "i" } },
      ];
      if (mongoose.Types.ObjectId.isValid(safeSearch)) {
        orConditions.push({ _id: safeSearch });
      }
      if (query.$or) {
        query.$and = [
          { hospitalId },
          { $or: query.$or },
          { $or: orConditions }
        ];
        delete query.$or;
      } else {
        query.$and = [
          { hospitalId },
          { $or: orConditions }
        ];
      }
    }

    const records = await MedicalRecord.find(query).sort({ createdAt: -1 }).lean();
    const safeRecords = records.map((r) => segregateMedicalRecord(r, req.user?.role));
    res.status(200).json({ status: "success", data: safeRecords });
  } catch (error) {
    console.error("Lỗi lấy danh sách bệnh án:", error);
    res.status(inputErrorStatus(res, error)).json({ message: "Không thể lấy danh sách bệnh án." });
  }
};

export const createRecord = async (req, res) => {
  try {
    const hospitalId = req.user?.hospitalId;
    if (!hospitalId) {
      return res.status(403).json({ message: "Không thể xác định bệnh viện của người dùng." });
    }

    const {
      patientId,
      patientName,
      gender,
      age,
      admissionType,
      department,
      paymentMethod,
      diagnosis,
      treatmentPlan,
      doctorInCharge,
      retentionCategory: userRetentionCat,
      psychiatricNotes,
      hivStatusNotes,
    } = req.body;

    // Chỉ bắt buộc định danh bệnh nhân. Tuổi, chẩn đoán, bác sĩ phụ trách để trống khi chưa có
    // (điều dưỡng mở hồ sơ lúc đo sinh hiệu) — không điền giá trị giả. Ký số bắt buộc có chẩn đoán.
    if (!patientId || !String(patientName || "").trim()) {
      return res.status(400).json({ message: "Vui lòng điền mã và họ tên bệnh nhân." });
    }
    const hasAge = age !== undefined && age !== null && String(age).trim() !== "";
    const ageValue = hasAge ? Number(age) : null;
    if (hasAge && !(Number.isFinite(ageValue) && ageValue >= 0 && ageValue <= 150)) {
      return res.status(400).json({ message: "Tuổi không hợp lệ." });
    }

    // [TT 13/2025/TT-BYT]: Động cơ tự động xác lập thời hạn lưu trữ bệnh án (10/15/20 năm)
    // Không gửi loại nhập viện → model lưu "Ngoại trú" (mặc định), thời hạn lưu trữ phải tính theo đúng giá trị đó
    const effectiveAdmission = admissionType || "Ngoại trú";
    const categoryToUse = userRetentionCat || (effectiveAdmission === "Ngoại trú" ? "ngoai_tru" : "noi_tru");
    const { retentionCategory, retentionYears, retentionExpiresAt } = calculateRetentionExpiry(categoryToUse, new Date());

    const newRecord = new MedicalRecord({
      hospitalId,
      patientId,
      patientName,
      gender,
      age: ageValue,
      admissionType,
      department,
      paymentMethod,
      diagnosis: diagnosis || "",
      treatmentPlan,
      doctorInCharge: doctorInCharge || "",
      status: "Đang điều trị",
      signStatus: "Chưa duyệt",
      retentionCategory,
      retentionYears,
      retentionExpiresAt,
      psychiatricNotes: psychiatricNotes || "",
      hivStatusNotes: hivStatusNotes || "",
    });

    await newRecord.save();

    // Ghi vết kiểm toán với chuỗi băm mật mã
    try {
      await recordAuditLog({
        action: "CREATE_EMR_RECORD",
        entity: "MedicalRecord",
        entityId: newRecord._id.toString(),
        performedBy: (req.user?.id || req.user?._id || "system").toString(),
        hospitalId,
        details: `Tạo mới hồ sơ bệnh án EMR cho ${patientName} (${patientId}). Lưu trữ: ${retentionCategory} (${retentionYears} năm).`,
        payload: { patientId, patientName, diagnosis, retentionCategory },
      });
    } catch (auditErr) {
      console.warn("Lỗi ghi audit log tạo bệnh án:", auditErr.message);
    }

    res.status(201).json({ status: "success", data: newRecord });
  } catch (error) {
    console.error("Lỗi tạo bệnh án:", error);
    res.status(inputErrorStatus(res, error)).json({ message: "Không thể tạo bệnh án mới." });
  }
};

// Rate Limiter cho Break-Glass: Tối đa 3 lần/ngày/bác sĩ để ngăn ngừa lạm dụng (HIPAA §164.312(a)(2)(ii))
const breakGlassTracker = new Map(); // key: userId_YYYY-MM-DD -> count

export const checkBreakGlassRateLimit = (userId) => {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${userId}_${today}`;
  const count = breakGlassTracker.get(key) || 0;
  if (count >= 3) {
    return { allowed: false, count, max: 3 };
  }
  breakGlassTracker.set(key, count + 1);
  return { allowed: true, count: count + 1, max: 3 };
};

// Helper thẩm định quyền truy cập hồ sơ bệnh án EMR/EHR đa cơ sở (Kèm cơ chế Break-Glass Cấp cứu)
const canAccessMedicalRecord = async (record, user, breakGlassReason = "") => {
  if (!record || !user) return false;
  // Tài khoản nền tảng (admin, system_admin) không có quyền mặc định với bệnh án (RELEASE_v3.4).

  // Nếu là bệnh nhân: Bắt buộc phải là chính bệnh nhân của hồ sơ đó
  if (user.role === "patient") {
    const isDirectOwner = user.id && record.patientId && (record.patientId.toString() === user.id.toString());
    if (isDirectOwner) return true;
    const patientObj = await checkPatientTenancy(record.patientId, user);
    return !!patientObj;
  }

  // Nếu là nhân viên y tế:
  // 1. Kiểm tra tenancy bệnh nhân (cùng viện, có phiếu chuyển viện hợp lệ, hoặc có ca khám B2C tại viện)
  const hasPatientAccess = await checkPatientTenancy(record.patientId, user);
  if (hasPatientAccess) return true;

  // 2. Fallback: Nếu không tìm thấy đối tượng User bệnh nhân (bệnh nhân vãng lai)
  // nhưng hồ sơ bệnh án thuộc cơ sở y tế của nhân viên y tế
  if (record.hospitalId && user.hospitalId && record.hospitalId.toString() === user.hospitalId.toString()) {
    return true;
  }

  // 3. [HIPAA §164.312(a)(2)(ii)]: Cơ chế truy cập khẩn cấp Cấp cứu (Emergency Break-Glass Protocol)
  // Chỉ cấp cho Bác sĩ điều trị có chứng chỉ hành nghề, áp dụng Rate Limiting (3 lần/ngày) và giới hạn 24h
  if (["doctor", "department_head", "hospital_admin"].includes(user.role) && breakGlassReason && breakGlassReason.trim().length >= 10) {
    const rateCheck = checkBreakGlassRateLimit((user.id || user._id || "doctor").toString());
    if (!rateCheck.allowed) {
      console.warn(`[BREAK-GLASS CHẶN LẠM DỤNG] Bác sĩ ${user.id} đã vượt quá giới hạn 3 lần Break-Glass/ngày.`);
      return false;
    }

    const breakGlassExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    try {
      await recordAuditLog({
        action: "BREAK_GLASS_EMERGENCY_ACCESSED",
        entity: "MedicalRecord",
        entityId: record._id.toString(),
        performedBy: (user.id || user._id || "doctor").toString(),
        hospitalId: user.hospitalId || null,
        details: `[CẤP CỨU KHẨN CẤP] Bác sĩ kích hoạt Break-Glass xem bệnh án liên viện (Lần ${rateCheck.count}/3 trong ngày). Bệnh nhân: ${record.patientName}. Lý do lâm sàng: "${breakGlassReason.trim()}". Quyền truy cập mở trong 24h (hết hạn: ${breakGlassExpiresAt.toISOString()}). Cần Giám đốc chuyên môn & Compliance Officer hậu kiểm trong 72h.`,
        payload: {
          patientId: record.patientId,
          patientName: record.patientName,
          breakGlassReason: breakGlassReason.trim(),
          breakGlassExpiresAt,
          requiresPostHocReview: true,
          reviewedAt: null,
        },
      });
    } catch (bgErr) {
      console.warn("Lỗi ghi nhận audit break-glass:", bgErr.message);
    }
    return true;
  }

  return false;
};

export const getRecordById = async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ bệnh án." });
    }

    // [BUG-02 FIX]: BẢO MẬT ĐA CƠ SỞ - Chặn rò rỉ bệnh án EMR liên viện (Hỗ trợ Break-Glass Header)
    const breakGlassReason = req.headers["x-break-glass-reason"] || req.query.breakGlassReason || "";
    const hasAccess = await canAccessMedicalRecord(record, req.user, breakGlassReason);
    if (!hasAccess) {
      return res.status(403).json({ 
        message: "Bạn không có quyền xem bệnh án của bệnh nhân thuộc cơ sở y tế khác khi chưa có phiếu chuyển viện hợp lệ hoặc lý do cấp cứu (Break-Glass)." 
      });
    }

    // [HIPAA §164.312(b)]: Ghi vết truy cập cấp bản ghi (Record-Level Read Audit)
    try {
      await recordAuditLog({
        action: "RECORD_VIEWED",
        entity: "MedicalRecord",
        entityId: record._id.toString(),
        performedBy: (req.user?.id || req.user?._id || "system").toString(),
        hospitalId: record.hospitalId || req.user?.hospitalId,
        details: `Người dùng ${req.user?.profile?.name || req.user?.id} (${req.user?.role}) truy xuất chi tiết hồ sơ bệnh án của ${record.patientName} (${record.patientId}).`,
      });
    } catch (auditErr) {
      console.warn("Lỗi ghi audit log RECORD_VIEWED:", auditErr.message);
    }

    // [HIPAA §164.502(b) & Luật 15/2023/QH15]: Bóc tách dữ liệu theo nguyên tắc tối thiểu (Data Segregation)
    const segregatedData = segregateMedicalRecord(record, req.user?.role);
    res.status(200).json({ status: "success", data: segregatedData });
  } catch (error) {
    console.error("Lỗi chi tiết bệnh án:", error);
    res.status(inputErrorStatus(res, error)).json({ message: "Lỗi hệ thống khi lấy chi tiết bệnh án." });
  }
};

export const updateRecord = async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ bệnh án." });
    }

    // Tenancy Check
    const hasAccess = await canAccessMedicalRecord(record, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: "Bạn không có quyền cập nhật hồ sơ bệnh án này." });
    }

    // [TT 13/2025/TT-BYT & LUẬT 15/2023/QH15]: KHÓA BẤT BIẾN HỒ SƠ BỆNH ÁN ĐÃ KÝ SỐ HOẶC ĐÃ XUẤT VIỆN
    if (FEATURES.ENABLE_EMR_IMMUTABLE_LOCK && (record.signStatus === "Đã ký số" || record.status === "Xuất viện")) {
      return res.status(400).json({
        status: "fail",
        code: "EMR_IMMUTABLE_RECORD_LOCKED",
        message: "Hồ sơ bệnh án đã được ký số hoặc bệnh nhân đã xuất viện. Theo quy định Thông tư 13/2025/TT-BYT và Luật Khám bệnh, chữa bệnh số 15/2023/QH15, không được phép chỉnh sửa trực tiếp nội dung bệnh án. Vui lòng sử dụng tính năng 'Tạo phụ lục bổ sung' (Addendum).",
      });
    }

    // Chỉ nhận trường nội dung lâm sàng. Trường do hệ thống quản lý (viện, bệnh nhân, trạng thái ký, chữ ký,
    // phiên bản, hạn lưu trữ, phong tỏa pháp lý, phụ lục, y lệnh miệng, ngày ra viện) không nhận từ client.
    const EDITABLE_FIELDS = ["patientName", "gender", "age", "admissionType", "department", "paymentMethod", "diagnosis",
      "treatmentPlan", "status", "doctorInCharge", "allergies", "wardId", "whoGrade", "tumorType", "molecularMarkers",
      "isClinicalTrial", "clinicalTrialProtocolId", "psychiatricNotes", "hivStatusNotes", "geneticNotes"];
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const updates = Object.fromEntries(EDITABLE_FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));
    
    // So sánh sự khác biệt để ghi nhận phiên bản EMR
    const changes = {};
    let hasChanges = false;
    
    // Các trường quan trọng cần lưu vết
    const trackedFields = ["diagnosis", "treatmentPlan", "status", "admissionType", "paymentMethod", "doctorInCharge", "department"];
    
    trackedFields.forEach(field => {
      if (updates[field] !== undefined && updates[field] !== record[field]) {
        changes[field] = {
          old: record[field] || "",
          new: updates[field] || ""
        };
        hasChanges = true;
      }
    });

    // Chuẩn bị bản ghi phiên bản nếu có thay đổi — chỉ lưu SAU KHI cập nhật bệnh án thành công
    let emrVersion = null;
    if (hasChanges) {
      const nextVersion = (record.currentVersion || 1) + 1;
      emrVersion = new EMRVersion({
        medicalRecordId: record._id,
        version: record.currentVersion || 1, // Lưu trạng thái hiện tại trước khi lên ver mới
        modifiedBy: req.user?.profile?.name || req.user?.profile?.fullName || req.user?.email || "",
        changes,
      });
      updates.currentVersion = nextVersion;
    }

    // If setting to discharge, record discharge date and recalculate retention
    if (updates.status === "Xuất viện" && record.status !== "Xuất viện") {
      updates.dischargeDate = new Date();
      const { retentionExpiresAt } = calculateRetentionExpiry(record.retentionCategory || "ngoai_tru", updates.dischargeDate);
      updates.retentionExpiresAt = retentionExpiresAt;
    }

    // [TT 13/2025/TT-BYT & LUẬT 15/2023/QH15]: CẬP NHẬT NGUYÊN TỬ (ATOMIC CONDITIONAL UPDATE) CHỐNG RACE CONDITION
    const lockFilter = {
      _id: req.params.id,
      ...(FEATURES.ENABLE_EMR_IMMUTABLE_LOCK
        ? {
            signStatus: { $nin: ["Đã ký số", "Đã khóa"] },
            status: { $nin: ["Xuất viện", "Đã đóng", "Hoàn tất"] },
          }
        : {}),
    };

    const updatedRecord = await MedicalRecord.findOneAndUpdate(lockFilter, updates, { new: true, runValidators: true });

    if (!updatedRecord) {
      const current = await MedicalRecord.findById(req.params.id).lean();
      if (!current) {
        return res.status(404).json({ message: "Không tìm thấy hồ sơ bệnh án." });
      }
      return res.status(400).json({
        status: "fail",
        code: "EMR_IMMUTABLE_RECORD_LOCKED",
        message: "Hồ sơ bệnh án đã được ký số hoặc bệnh nhân đã xuất viện. Theo quy định Thông tư 13/2025/TT-BYT và Luật Khám bệnh, chữa bệnh số 15/2023/QH15, không được phép chỉnh sửa trực tiếp nội dung bệnh án. Vui lòng sử dụng tính năng 'Tạo phụ lục bổ sung' (Addendum).",
      });
    }

    if (emrVersion) await emrVersion.save();

    // Ghi nhận chuỗi băm nhật ký kiểm toán
    try {
      await recordAuditLog({
        action: "UPDATE_EMR_RECORD",
        entity: "MedicalRecord",
        entityId: record._id.toString(),
        performedBy: (req.user?.id || req.user?._id || "system").toString(),
        hospitalId: record.hospitalId || req.user?.hospitalId,
        details: `Cập nhật hồ sơ bệnh án EMR (phiên bản v${updatedRecord.currentVersion || 1}).`,
        payload: changes,
      });
    } catch (auditErr) {
      console.warn("Lỗi ghi audit log cập nhật bệnh án:", auditErr.message);
    }

    res.status(200).json({ status: "success", data: updatedRecord });
  } catch (error) {
    // Dữ liệu không hợp lệ (thiếu trường bắt buộc...) → báo rõ trường nào thay vì lỗi 500 chung chung
    if (error.name === "ValidationError") {
      const fields = Object.values(error.errors || {}).map((e) => e.path === "diagnosis" ? "chẩn đoán" : e.path);
      return res.status(400).json({ message: `Thiếu hoặc sai thông tin bắt buộc của bệnh án: ${fields.join(", ")}.` });
    }
    console.error("Lỗi cập nhật bệnh án:", error);
    res.status(inputErrorStatus(res, error)).json({ message: "Không thể cập nhật bệnh án." });
  }
};

export const getRecordVersions = async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ bệnh án." });
    }
    // [BUG-02 FIX]: BẢO MẬT ĐA CƠ SỞ - Chặn rò rỉ lịch sử sửa đổi bệnh án liên viện
    const hasAccess = await canAccessMedicalRecord(record, req.user);
    if (!hasAccess) {
      return res.status(403).json({ 
        message: "Bạn không có quyền xem lịch sử sửa đổi bệnh án của cơ sở y tế khác khi chưa có phiếu chuyển viện hợp lệ." 
      });
    }

    const versions = await EMRVersion.find({ medicalRecordId: req.params.id }).sort({ version: -1 }).lean();
    res.status(200).json({ status: "success", data: versions });
  } catch (error) {
    console.error("Lỗi lấy danh sách lịch sử sửa đổi bệnh án:", error);
    res.status(inputErrorStatus(res, error)).json({ message: "Không thể lấy lịch sử sửa đổi bệnh án." });
  }
};

// --- Care Sheet (Phiếu chăm sóc) Controllers ---

export const getCareSheets = async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ bệnh án." });
    }
    
    // [BUG-02 FIX]: BẢO MẬT ĐA CƠ SỞ - Chặn rò rỉ phiếu chăm sóc liên viện
    const hasAccess = await canAccessMedicalRecord(record, req.user);
    if (!hasAccess) {
      return res.status(403).json({ 
        message: "Bạn không có quyền truy cập phiếu chăm sóc của bệnh nhân thuộc cơ sở y tế khác." 
      });
    }

    const careSheets = await CareSheet.find({ medicalRecordId: req.params.id }).sort({ createdAt: -1 }).lean();
    res.status(200).json({ status: "success", data: careSheets });
  } catch (error) {
    console.error("Lỗi lấy danh sách phiếu chăm sóc:", error);
    res.status(inputErrorStatus(res, error)).json({ message: "Không thể lấy danh sách phiếu chăm sóc." });
  }
};

export const createCareSheet = async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ bệnh án." });
    }
    const hasAccess = await canAccessMedicalRecord(record, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập hồ sơ bệnh án này." });
    }

    const {
      careLevel,
      pulse,
      bloodPressure,
      temperature,
      respiratoryRate,
      spo2,
      glasgow,
      pupils,
      surgicalDrainage,
      fluidInfusions,
      progressNotes,
      careActions,
      nurse
    } = req.body;

    if (!pulse || !bloodPressure || !temperature || !respiratoryRate || !spo2 || !progressNotes || !nurse) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ các chỉ số sinh hiệu và diễn biến bệnh." });
    }

    // Glasgow, đồng tử, dẫn lưu, truyền dịch (UC-NUR-04): chỉ lưu phần điều dưỡng thật sự đánh giá,
    // không tự điền mức "bình thường" cho thành phần còn thiếu.
    const assessment = normalizeCareAssessment({ careLevel, glasgow, pupils, surgicalDrainage, fluidInfusions });
    if (assessment.error) return res.status(400).json({ message: assessment.error });
    const care = assessment.value;

    // Đánh giá ngưỡng an toàn sinh hiệu theo phân tầng tuổi & giới tính của hồ sơ bệnh án
    const vitalsEvaluation = evaluateVitalSigns(
      {
        pulse,
        bloodPressure,
        temperature,
        spo2,
        respiratoryRate
      },
      {
        age: record.age,
        gender: record.gender
      }
    );

    const newCareSheet = new CareSheet({
      hospitalId: record.hospitalId || req.user?.hospitalId,
      medicalRecordId: req.params.id,
      careLevel: care.careLevel,
      pulse: Number(pulse),
      bloodPressure: String(bloodPressure).trim(),
      temperature: Number(temperature),
      respiratoryRate: Number(respiratoryRate),
      spo2: Number(spo2),
      ...(care.glasgow ? { glasgow: care.glasgow } : {}),
      ...(care.pupils ? { pupils: care.pupils } : {}),
      ...(care.surgicalDrainage ? { surgicalDrainage: care.surgicalDrainage } : {}),
      ...(care.fluidInfusions ? { fluidInfusions: care.fluidInfusions } : {}),
      vitalsEvaluation,
      progressNotes,
      careActions,
      nurse,
    });

    await newCareSheet.save();

    // Đồng bộ sinh hiệu sang VitalSign
    try {
      if (record) {
        let query = {};
        if (/^[0-9a-fA-F]{24}$/.test(record.patientId)) {
          query = { $or: [{ _id: record.patientId }, { "profile.medicalId": record.patientId }] };
        } else {
          query = { "profile.medicalId": record.patientId };
        }

        const { User } = await import("../../models/user.model.js");
        const { VitalSign } = await import("./models/vitalSign.model.js");

        const patientUser = await User.findOne(query);
        if (patientUser) {
          const bpStr = bloodPressure || "";
          const bpParts = bpStr.split("/");
          const systolic = bpParts[0] ? Number(bpParts[0].trim()) : null;
          const diastolic = bpParts[1] ? Number(bpParts[1].trim()) : null;

          if (systolic && diastolic && !isNaN(systolic) && !isNaN(diastolic)) {
            const latestVital = await VitalSign.findOne({ patient_id: patientUser._id }).sort({ recorded_at: -1 });
            const height = latestVital?.height || null;
            const weight = latestVital?.weight || null;
            let bmi = null;
            if (weight && height) {
              bmi = Number((weight / Math.pow(height / 100, 2)).toFixed(2));
            }

            const newVital = new VitalSign({
              hospitalId: record.hospitalId || req.user?.hospitalId,
              patient_id: patientUser._id,
              pulse: Number(pulse),
              blood_pressure: { systolic, diastolic },
              spo2: Number(spo2),
              temperature: normalizeTemperature(temperature),
              weight: weight || undefined,
              height: height || undefined,
              bmi: bmi || undefined,
              recorded_at: new Date(),
            });
            await newVital.save();
            console.log("Automatically synced VitalSign from EMR CareSheet.");
          }
        }
      }
    } catch (err) {
      console.warn("Lỗi đồng bộ sinh hiệu từ CareSheet:", err);
    }

    res.status(201).json({ status: "success", data: newCareSheet });
  } catch (error) {
    console.error("Lỗi tạo phiếu chăm sóc:", error);
    res.status(inputErrorStatus(res, error)).json({ message: "Không thể lưu phiếu chăm sóc." });
  }
};

// --- Consultation (Hội chẩn) Controllers ---

export const getConsultations = async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ bệnh án." });
    }
    
    // [BUG-02 FIX]: BẢO MẬT ĐA CƠ SỞ - Chặn rò rỉ biên bản hội chẩn liên viện
    const hasAccess = await canAccessMedicalRecord(record, req.user);
    if (!hasAccess) {
      return res.status(403).json({ 
        message: "Bạn không có quyền truy cập biên bản hội chẩn của bệnh nhân thuộc cơ sở y tế khác." 
      });
    }

    const consultations = await Consultation.find({ medicalRecordId: req.params.id }).sort({ meetingDate: -1 }).lean();
    res.status(200).json({ status: "success", data: consultations });
  } catch (error) {
    console.error("Lỗi lấy danh sách hội chẩn:", error);
    res.status(inputErrorStatus(res, error)).json({ message: "Không thể lấy danh sách biên bản hội chẩn." });
  }
};

export const createConsultation = async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ bệnh án." });
    }
    const hasAccess = await canAccessMedicalRecord(record, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập hồ sơ bệnh án này." });
    }

    const {
      meetingDate,
      participants,
      clinicalSummary,
      diagnosis,
      treatmentConclusion,
      consultationType,
      tumorBoardDetails
    } = req.body;

    if (!participants || participants.length === 0 || !clinicalSummary || !diagnosis || !treatmentConclusion) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin hội chẩn." });
    }

    const newConsultation = new Consultation({
      hospitalId: record.hospitalId || req.user?.hospitalId,
      medicalRecordId: req.params.id,
      meetingDate: meetingDate || new Date(),
      participants,
      clinicalSummary,
      diagnosis,
      treatmentConclusion,
      consultationType: consultationType === "tumor_board" ? "tumor_board" : "ordinary",
      tumorBoardDetails: tumorBoardDetails && typeof tumorBoardDetails === "object" ? tumorBoardDetails : undefined,
    });

    await newConsultation.save();
    res.status(201).json({ status: "success", data: newConsultation });
  } catch (error) {
    console.error("Lỗi tạo biên bản hội chẩn:", error);
    res.status(inputErrorStatus(res, error)).json({ message: "Không thể lưu biên bản hội chẩn." });
  }
};

// --- Consent Form (Cam đoan) Controllers ---

export const getConsents = async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ bệnh án." });
    }
    
    // [BUG-02 FIX]: BẢO MẬT ĐA CƠ SỞ - Chặn rò rỉ danh sách giấy cam đoan liên viện
    const hasAccess = await canAccessMedicalRecord(record, req.user);
    if (!hasAccess) {
      return res.status(403).json({ 
        message: "Bạn không có quyền truy cập danh sách giấy cam đoan của cơ sở y tế khác." 
      });
    }

    const consents = await ConsentForm.find({ medicalRecordId: req.params.id }).sort({ createdAt: -1 }).lean();
    res.status(200).json({ status: "success", data: consents });
  } catch (error) {
    console.error("Lỗi lấy giấy cam đoan:", error);
    res.status(inputErrorStatus(res, error)).json({ message: "Không thể lấy danh sách giấy cam đoan." });
  }
};

export const createConsent = async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ bệnh án." });
    }
    const hasAccess = await canAccessMedicalRecord(record, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập hồ sơ bệnh án này." });
    }

    const { procedureName, risks, doctorExplanation } = req.body;

    if (!procedureName || !risks || !doctorExplanation) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ tên thủ thuật, nguy cơ và giải thích của bác sĩ." });
    }

    const newConsent = new ConsentForm({
      hospitalId: record.hospitalId || req.user?.hospitalId,
      medicalRecordId: req.params.id,
      procedureName,
      risks,
      doctorExplanation,
      doctorSigned: false,
      patientSigned: false,
    });

    await newConsent.save();
    res.status(201).json({ status: "success", data: newConsent });
  } catch (error) {
    console.error("Lỗi tạo giấy cam đoan:", error);
    res.status(inputErrorStatus(res, error)).json({ message: "Không thể tạo giấy cam đoan." });
  }
};

export const signConsent = async (req, res) => {
  try {
    const { signature, digitalSignature } = req.body;
    const userRole = req.user?.role;
    const consent = await ConsentForm.findById(req.params.consentId);
    if (!consent) {
      return res.status(404).json({ message: "Không tìm thấy giấy cam đoan." });
    }

    const record = await MedicalRecord.findById(consent.medicalRecordId);
    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ bệnh án liên kết." });
    }

    const hasAccess = await canAccessMedicalRecord(record, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: "Bạn không có quyền thao tác trên giấy cam đoan này." });
    }

    const signerName = req.user?.profile?.name || req.user?.name;

    // [SECURITY FIX]: Xác thực vai trò ký từ req.user.role đã được định danh, ngăn chặn mạo danh
    if (["doctor", "department_head", "hospital_admin"].includes(userRole)) {
      consent.doctorSigned = true;
      consent.doctorSignature = signature || signerName || "";
      consent.signedAt = new Date();
      // Chưa tích hợp CA: không ghi thông tin chứng thư số (client tự khai không kiểm chứng được).
    } else if (userRole === "patient") {
      // Bệnh nhân chỉ được ký cam đoan cho chính mình
      const isOwnConsent = (record.patientId && record.patientId.toString() === req.user.id.toString()) ||
                           (consent.patientId && consent.patientId.toString() === req.user.id.toString());
      if (!isOwnConsent) {
        return res.status(403).json({ message: "Bạn không thể ký cam đoan thay cho bệnh nhân khác." });
      }
      consent.patientSigned = true;
      consent.patientSignature = signature || signerName || "Người bệnh/Đại diện";
      consent.signedAt = new Date();
    } else {
      return res.status(403).json({ message: "Vai trò người dùng hiện tại không có thẩm quyền ký giấy cam đoan." });
    }

    await consent.save();
    res.status(200).json({ status: "success", data: consent });
  } catch (error) {
    console.error("Lỗi ký giấy cam đoan:", error);
    res.status(inputErrorStatus(res, error)).json({ message: "Không thể thực hiện ký duyệt." });
  }
};

// --- [TT 13/2025/TT-BYT & LUẬT 15/2023/QH15]: BỔ SUNG PHỤ LỤC BỆNH ÁN (EMR ADDENDUM) ---
export const createRecordAddendum = async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ bệnh án." });
    }

    const hasAccess = await canAccessMedicalRecord(record, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: "Bạn không có quyền thêm phụ lục cho hồ sơ bệnh án này." });
    }

    const { content, reason } = req.body;
    if (!content || !reason) {
      return res.status(400).json({ message: "Vui lòng cung cấp nội dung phụ lục và lý do bổ sung." });
    }

    const authorName = req.user?.profile?.name || req.user?.name || "Bác sĩ điều trị";
    const signedHash = crypto
      .createHash("sha256")
      .update(`${record._id}|${content}|${reason}|${req.user?.id}`)
      .digest("hex");

    const newAddendum = {
      content,
      reason,
      author: authorName,
      authorId: req.user?.id || req.user?._id,
      createdAt: new Date(),
      signedHash,
      signedAt: new Date(),
    };

    record.addendums.push(newAddendum);
    await record.save();

    // Ghi nhận nhật ký kiểm toán với chuỗi băm mật mã
    try {
      await recordAuditLog({
        action: "CREATE_EMR_ADDENDUM",
        entity: "MedicalRecord",
        entityId: record._id.toString(),
        performedBy: (req.user?.id || req.user?._id || "system").toString(),
        hospitalId: record.hospitalId || req.user?.hospitalId,
        details: `Thêm phụ lục bệnh án (lý do: ${reason}) theo TT 13/2025/TT-BYT.`,
        payload: { addendumHash: signedHash, reason },
      });
    } catch (auditErr) {
      console.warn("Lỗi ghi audit log phụ lục:", auditErr.message);
    }

    res.status(201).json({ status: "success", data: record });
  } catch (error) {
    console.error("Lỗi tạo phụ lục bệnh án:", error);
    res.status(inputErrorStatus(res, error)).json({ message: "Không thể tạo phụ lục bệnh án." });
  }
};

// --- [LUẬT GDĐT 20/2023 & TT 13/2025]: KÝ SỐ BỆNH ÁN ĐIỆN TỬ VÀ KÍCH HOẠT KHÓA BẤT BIẾN ---
export const signMedicalRecord = async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ bệnh án." });
    }

    const hasAccess = await canAccessMedicalRecord(record, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: "Bạn không có quyền ký số bệnh án này." });
    }

    const userRole = req.user?.role;
    if (!["doctor", "department_head", "hospital_admin"].includes(userRole)) {
      return res.status(403).json({ message: "Chỉ bác sĩ điều trị, trưởng khoa hoặc quản lý bệnh viện mới có thẩm quyền ký bệnh án." });
    }
    if (!String(record.diagnosis || "").trim()) {
      return res.status(400).json({ message: "Bệnh án chưa có chẩn đoán. Bác sĩ cần ghi chẩn đoán trước khi ký số." });
    }

    // Tính toán mã băm toàn vẹn nội dung bệnh án lâm sàng
    const clinicalDigest = `${record._id}|${record.patientId}|${record.diagnosis}|${record.treatmentPlan}|${record.department}|${record.hospitalId}`;
    const signedHash = crypto.createHash("sha256").update(clinicalDigest).digest("hex");

    // Hệ thống chưa tích hợp tổ chức chứng thực (CA): chỉ ghi mã băm toàn vẹn SHA-256 và tài khoản đã đăng nhập,
    // không ghi số chứng thư, nhà cung cấp CA hay dấu thời gian (giống ký báo cáo CĐHA, P0-2).
    // Thông tin chứng thư do client tự gửi không kiểm chứng được nên bị bỏ qua.
    record.signStatus = "Đã ký số";
    record.digitalSignatureMetadata = {
      signatureType: "internal_hash",
      certificateSerial: "",
      signingAlgorithm: "SHA-256",
      timestampToken: "",
      caProvider: "",
      signedHash,
      signedBy: req.user?.profile?.name || req.user?.profile?.fullName || req.user?.name || req.user?.email || String(req.user?.id || ""),
      signedAt: new Date(),
    };

    await record.save();

    // Ghi vết kiểm toán với chuỗi băm
    try {
      await recordAuditLog({
        action: "SIGN_EMR_RECORD",
        entity: "MedicalRecord",
        entityId: record._id.toString(),
        performedBy: (req.user?.id || req.user?._id || "system").toString(),
        hospitalId: record.hospitalId || req.user?.hospitalId,
        details: `Ký số thành công hồ sơ bệnh án EMR (Chuẩn Luật GDĐT 20/2023 & TT 13/2025/TT-BYT). Kích hoạt Khóa Bất Biến.`,
        payload: { signedHash, certificateSerial: record.digitalSignatureMetadata.certificateSerial },
      });
    } catch (auditErr) {
      console.warn("Lỗi ghi audit log ký số EMR:", auditErr.message);
    }

    res.status(200).json({ status: "success", data: record });
  } catch (error) {
    console.error("Lỗi ký số bệnh án:", error);
    res.status(inputErrorStatus(res, error)).json({ message: "Không thể thực hiện ký số bệnh án." });
  }
};

// --- [LUẬT BVDLCN 91/2025/QH15 & NĐ 13/2023]: QUẢN LÝ ĐỒNG THUẬN DỮ LIỆU CÁ NHÂN (DATA PRIVACY CONSENT) ---

// @desc    Lấy danh sách bản cam kết bảo vệ dữ liệu cá nhân của bệnh nhân
// @route   GET /api/v1/emr/privacy-consents
export const getPrivacyConsents = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'patient') {
      filter.patientId = req.user.id || req.user._id;
    } else if (req.query.patientId) {
      filter.patientId = req.query.patientId;
    }
    if (req.user.role !== 'patient' && !req.user.hospitalId) {
      // Không trả cam kết của mọi viện cho tài khoản chưa gán viện
      return res.status(403).json({ message: "Tài khoản chưa được gán vào bệnh viện nào." });
    }
    if (req.user.hospitalId) {
      filter.hospitalId = req.user.hospitalId;
    }

    const { DataPrivacyConsent } = await import("./models/dataPrivacyConsent.model.js");
    const consents = await DataPrivacyConsent.find(filter).sort({ createdAt: -1 }).lean();
    // [P1-9] Không trả bản mã CCCD người ký ra API — chỉ 4 số cuối
    const safeConsents = consents.map(({ signerNationalId, signerNationalIdLast4, ...rest }) => ({
      ...rest,
      signerNationalIdMasked: signerNationalIdLast4 ? `****${signerNationalIdLast4}` : "",
    }));
    res.status(200).json({ status: "success", data: safeConsents });
  } catch (error) {
    console.error("Lỗi lấy danh sách cam kết bảo vệ dữ liệu:", error);
    res.status(inputErrorStatus(res, error)).json({ message: "Không thể lấy danh sách cam kết bảo vệ dữ liệu." });
  }
};

// @desc    Ký bản cam kết bảo vệ dữ liệu cá nhân (Điều 9 & 11 Luật 91/2025/QH15)
// @route   POST /api/v1/emr/privacy-consents
export const createPrivacyConsent = async (req, res) => {
  try {
    const { purposes, signerName, signerNationalId, signerRelationship, medicalId } = req.body;
    const patientId = req.user.role === 'patient' ? (req.user.id || req.user._id) : req.body.patientId;
    if (req.user.role !== "patient" && !req.user.hospitalId) {
      return res.status(403).json({ message: "Tài khoản chưa được gán vào bệnh viện nào." });
    }
    // Nhân viên chỉ lập cam kết trong viện của mình (không nhận hospitalId từ body)
    let hospitalId = req.user.role === "patient" ? (req.user.hospitalId || req.body.hospitalId) : req.user.hospitalId;
    // Tài khoản bệnh nhân không gắn viện: lấy viện từ lượt khám gần nhất của chính họ
    if (!hospitalId && req.user.role === "patient") {
      const latestVisit = await Visit.findOne({ patientId }).sort({ createdAt: -1 }).select("hospitalId").lean();
      hospitalId = latestVisit?.hospitalId;
    }
    if (!hospitalId) {
      return res.status(400).json({ message: "Bạn chưa có lượt khám tại bệnh viện nào nên chưa thể lập cam kết." });
    }

    if (!patientId || !signerName) {
      return res.status(400).json({ message: "Thiếu thông tin người bệnh hoặc người ký cam kết." });
    }

    // Nhân viên chỉ được lập cam kết cho bệnh nhân thuộc phạm vi được phép truy cập
    if (req.user.role !== "patient") {
      const patient = await checkPatientTenancy(patientId, req.user);
      if (!patient) {
        return res.status(403).json({ message: "Bạn không có quyền lập cam kết cho bệnh nhân này." });
      }
    }

    const { DataPrivacyConsent } = await import("./models/dataPrivacyConsent.model.js");
    const nationalId = String(signerNationalId || "").trim();
    const consent = await DataPrivacyConsent.create({
      hospitalId,
      patientId,
      medicalId: medicalId || req.user.profile?.medicalId || "",
      purposes: purposes || {
        medicalCareAndEmr: true,
        aiAssistedAnalysis: true,
        scientificResearchAnonymized: false,
        cloudStorageBackup: true,
      },
      consentStatus: "granted",
      signerName,
      signerNationalId: nationalId ? encryptField(nationalId) : "",
      signerNationalIdLast4: nationalId ? nationalId.slice(-4) : "",
      signerRelationship: signerRelationship || "Bản thân",
      signedAt: new Date(),
      ipAddress: req.ip || "",
    });

    try {
      await recordAuditLog({
        action: "GRANT_DATA_PRIVACY_CONSENT",
        entity: "DataPrivacyConsent",
        entityId: consent._id.toString(),
        performedBy: (req.user.id || req.user._id).toString(),
        hospitalId,
        details: `Cấp quyền xử lý dữ liệu cá nhân y tế theo Luật 91/2025/QH15 cho bệnh nhân: ${signerName}.`,
      });
    } catch (auditErr) {
      console.warn("Lỗi ghi audit log DataPrivacyConsent:", auditErr.message);
    }

    res.status(201).json({ status: "success", data: consent });
  } catch (error) {
    console.error("Lỗi tạo cam kết bảo vệ dữ liệu:", error);
    res.status(inputErrorStatus(res, error)).json({ message: "Không thể tạo bản cam kết bảo vệ dữ liệu cá nhân." });
  }
};

// @desc    Thu hồi quyền xử lý dữ liệu cá nhân (Điều 9 Luật 91/2025/QH15)
// @route   POST /api/v1/emr/privacy-consents/:id/revoke
export const revokePrivacyConsent = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, revokeType } = req.body;

    const { DataPrivacyConsent } = await import("./models/dataPrivacyConsent.model.js");
    const consent = await DataPrivacyConsent.findById(id);

    if (!consent) {
      return res.status(404).json({ message: "Không tìm thấy bản cam kết bảo vệ dữ liệu." });
    }

    // Kiểm tra quyền: chỉ chính bệnh nhân hoặc nhân sự cùng bệnh viện mới được thu hồi
    if (req.user.role === 'patient' && consent.patientId.toString() !== (req.user.id || req.user._id).toString()) {
      return res.status(403).json({ message: "Bạn không có quyền thu hồi cam kết này." });
    }
    if (req.user.role !== "patient"
      && (!req.user.hospitalId || String(consent.hospitalId) !== String(req.user.hospitalId))) {
      return res.status(403).json({ message: "Bạn không có quyền thu hồi cam kết của bệnh viện khác." });
    }

    consent.consentStatus = revokeType === 'partially' ? 'partially_revoked' : 'fully_revoked';
    consent.revokedAt = new Date();
    consent.revocationReason = reason || "Chủ thể dữ liệu yêu cầu thu hồi theo quyền Điều 9 Luật 91/2025/QH15";
    await consent.save();

    try {
      await recordAuditLog({
        action: "REVOKE_DATA_PRIVACY_CONSENT",
        entity: "DataPrivacyConsent",
        entityId: consent._id.toString(),
        performedBy: (req.user.id || req.user._id).toString(),
        hospitalId: consent.hospitalId,
        details: `Thu hồi quyền xử lý dữ liệu cá nhân (${consent.consentStatus}) theo Điều 9 Luật 91/2025/QH15. Lý do: ${consent.revocationReason}.`,
      });
    } catch (auditErr) {
      console.warn("Lỗi ghi audit log thu hồi consent:", auditErr.message);
    }

    res.status(200).json({
      status: "success",
      message: "Đã thu hồi quyền xử lý dữ liệu thành công.",
      data: {
        ...consent.toObject(),
        signerNationalId: undefined,
        signerNationalIdMasked: consent.signerNationalIdLast4 ? `****${consent.signerNationalIdLast4}` : "",
      },
    });
  } catch (error) {
    console.error("Lỗi thu hồi cam kết bảo vệ dữ liệu:", error);
    res.status(inputErrorStatus(res, error)).json({ message: "Không thể thu hồi bản cam kết bảo vệ dữ liệu." });
  }
};

// @desc    Trưởng khoa (Chủ tọa Hội đồng U não - MTB Chair) ký duyệt kết luận Tumor Board & tự động lên lịch MRI hậu phẫu <= 72h
// @route   POST /api/v1/emr/consultations/:id/approve-tumor-board
// @access  Private (Department Head, Hospital Admin, Admin)
export const approveTumorBoard = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      consensusDecision,
      surgicalPlan,
      radiotherapyPlan,
      chemotherapyPlan,
      scheduledSurgeryDate,
      radiotherapyEndDate,
      nextSurveillanceDate,
      visitId
    } = req.body || {};

    const consultation = await Consultation.findById(id);
    if (!consultation) {
      return res.status(404).json({ message: "Không tìm thấy biên bản hội chẩn." });
    }

    if (!req.user.hospitalId || String(consultation.hospitalId) !== String(req.user.hospitalId)) {
      return res.status(403).json({ message: "Không có quyền phê duyệt hội chẩn của bệnh viện khác." });
    }

    if (consultation.tumorBoardDetails?.isLocked) {
      return res.status(409).json({ message: "Biên bản Hội đồng U não (Tumor Board) này đã được Chủ tọa phê duyệt và khóa." });
    }

    const chairName = req.user.profile?.fullName || req.user.profile?.name || req.user.email || "Trưởng khoa Ung thư Não";
    const tb = consultation.tumorBoardDetails || {};

    const effectiveSurgeryDate = scheduledSurgeryDate ? new Date(scheduledSurgeryDate) : (tb.scheduledSurgeryDate || null);
    const postOpMriDueAt = effectiveSurgeryDate && !isNaN(new Date(effectiveSurgeryDate).getTime())
      ? new Date(new Date(effectiveSurgeryDate).getTime() + 72 * 60 * 60 * 1000)
      : null;

    // Tự động chuyển hoặc khởi tạo chỉ định chụp MRI hậu phẫu 72h trên lượt khám liên kết
    let linkedVisitId = visitId || tb.postOpMriVisitId || null;
    if (effectiveSurgeryDate) {
      try {
        
        let targetVisit = linkedVisitId ? await Visit.findById(linkedVisitId) : null;
        if (!targetVisit) {
          const record = await MedicalRecord.findById(consultation.medicalRecordId).lean();
          if (record?.patientId) {
            targetVisit = await Visit.findOne({
              hospitalId: consultation.hospitalId,
              patientId: record.patientId,
              status: { $nin: ["đã đóng", "đã hủy", "no_show"] }
            }).sort({ createdAt: -1 });
          }
        }
        if (targetVisit) {
          targetVisit.status = "chờ chụp sau phẫu thuật";
          targetVisit.mriOrder = {
            ...(targetVisit.mriOrder?.toObject ? targetVisit.mriOrder.toObject() : (targetVisit.mriOrder || {})),
            region: targetVisit.mriOrder?.region || "Sọ não (Đánh giá tồn dư u hậu phẫu <= 72h)",
            clinicalScenario: "post_op_72h",
            protocolCode: "POST_OP_72H",
            withContrast: true,
            mriStatus: "ordered",
            instructions: `Chụp MRI đánh giá mức độ lấy u (EOR) trong cửa sổ vàng <= 72h sau mổ (Hạn chót: ${postOpMriDueAt ? postOpMriDueAt.toISOString() : "72h"}).`,
            orderedAt: new Date()
          };
          await targetVisit.save();
          linkedVisitId = targetVisit._id;
        }
      } catch (visitErr) {
        console.warn("⚠️ Không thể tự động cập nhật y lệnh MRI hậu phẫu 72h:", visitErr.message);
      }
    }

    consultation.consultationType = "tumor_board";
    consultation.tumorBoardDetails = {
      ...(tb.toObject ? tb.toObject() : tb),
      surgicalPlan: surgicalPlan !== undefined ? surgicalPlan : (tb.surgicalPlan || ""),
      radiotherapyPlan: radiotherapyPlan !== undefined ? radiotherapyPlan : (tb.radiotherapyPlan || ""),
      chemotherapyPlan: chemotherapyPlan !== undefined ? chemotherapyPlan : (tb.chemotherapyPlan || ""),
      consensusDecision: consensusDecision !== undefined ? consensusDecision : (tb.consensusDecision || consultation.treatmentConclusion || ""),
      chairApprovedBy: req.user.id,
      chairApprovedByName: chairName,
      chairApprovedAt: new Date(),
      isLocked: true,
      scheduledSurgeryDate: effectiveSurgeryDate,
      radiotherapyEndDate: radiotherapyEndDate ? new Date(radiotherapyEndDate) : (tb.radiotherapyEndDate || null),
      postOpMriDueAt,
      postOpMriVisitId: linkedVisitId,
      nextSurveillanceDate: nextSurveillanceDate ? new Date(nextSurveillanceDate) : (tb.nextSurveillanceDate || null),
    };

    await consultation.save();

    return res.status(200).json({
      status: "success",
      message: "Trưởng khoa đã phê duyệt phác đồ Hội đồng U não (Tumor Board)." + (postOpMriDueAt ? " Đã tự động kích hoạt lịch chụp MRI hậu phẫu <= 72h." : ""),
      data: consultation
    });
  } catch (error) {
    console.error("Lỗi phê duyệt Tumor Board:", error);
    return res.status(inputErrorStatus(res, error)).json({ message: "Không thể phê duyệt biên bản Tumor Board.", error: error.message });
  }
};
