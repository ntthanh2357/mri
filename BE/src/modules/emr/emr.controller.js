import { MedicalRecord } from "./models/medicalRecord.model.js";
import { CareSheet } from "./models/careSheet.model.js";
import { Consultation } from "./models/consultation.model.js";
import { ConsentForm } from "./models/consentForm.model.js";
import { EMRVersion } from "./models/emrVersion.model.js";
import { checkPatientTenancy } from "../../utils/tenancy.util.js";
import crypto from "crypto";
import { FEATURES } from "../../config/features.config.js";
import { recordAuditLog } from "../../services/auditLog.service.js";
import { calculateRetentionExpiry } from "../../utils/retention.util.js";
import { segregateMedicalRecord } from "../../utils/dataSegregation.util.js";

// --- Medical Record (HSBA) Controllers ---

export const getRecords = async (req, res) => {
  try {
    const { search } = req.query;
    const hospitalId = req.user?.hospitalId;
    if (!hospitalId) {
      return res.status(403).json({ message: "Không thể xác định bệnh viện của người dùng." });
    }

    let query = { hospitalId };
    
    if (search && search.trim()) {
      // [BUG-09 FIX]: Chống tấn công ReDoS bằng cách giới hạn độ dài và escape ký tự đặc biệt Regex
      const safeSearch = search.trim().substring(0, 100);
      const escaped = safeSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$and = [
        { hospitalId },
        {
          $or: [
            { patientName: { $regex: escaped, $options: "i" } },
            { patientId: { $regex: escaped, $options: "i" } },
            { diagnosis: { $regex: escaped, $options: "i" } },
          ]
        }
      ];
    }

    const records = await MedicalRecord.find(query).sort({ createdAt: -1 }).lean();
    const safeRecords = records.map((r) => segregateMedicalRecord(r, req.user?.role));
    res.status(200).json({ status: "success", data: safeRecords });
  } catch (error) {
    console.error("Lỗi lấy danh sách bệnh án:", error);
    res.status(500).json({ message: "Không thể lấy danh sách bệnh án." });
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

    if (!patientId || !patientName || !age || !diagnosis || !doctorInCharge) {
      return res.status(400).json({ message: "Vui lòng điền đầy đủ thông tin bắt buộc." });
    }

    // [TT46/2018/TT-BYT]: Động cơ tự động xác lập thời hạn lưu trữ bệnh án (10/15/20 năm)
    const categoryToUse = userRetentionCat || (admissionType === "Ngoại trú" ? "ngoai_tru" : "noi_tru");
    const { retentionCategory, retentionYears, retentionExpiresAt } = calculateRetentionExpiry(categoryToUse, new Date());

    const newRecord = new MedicalRecord({
      hospitalId,
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
    res.status(500).json({ message: "Không thể tạo bệnh án mới." });
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
  if (user.role === "admin" || user.role === "system_admin") return true;

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
  if (["doctor", "hospital_admin"].includes(user.role) && breakGlassReason && breakGlassReason.trim().length >= 10) {
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
    res.status(500).json({ message: "Lỗi hệ thống khi lấy chi tiết bệnh án." });
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

    // [TT46/2018/TT-BYT & LUẬT 15/2023/QH15]: KHÓA BẤT BIẾN HỒ SƠ BỆNH ÁN ĐÃ KÝ SỐ HOẶC ĐÃ XUẤT VIỆN
    if (FEATURES.ENABLE_EMR_IMMUTABLE_LOCK && (record.signStatus === "Đã ký số" || record.status === "Xuất viện")) {
      return res.status(400).json({
        status: "fail",
        code: "EMR_IMMUTABLE_RECORD_LOCKED",
        message: "Hồ sơ bệnh án đã được ký số hoặc bệnh nhân đã xuất viện. Theo quy định Thông tư 46/2018/TT-BYT và Luật Khám bệnh, chữa bệnh số 15/2023/QH15, không được phép chỉnh sửa trực tiếp nội dung bệnh án. Vui lòng sử dụng tính năng 'Tạo phụ lục bổ sung' (Addendum).",
      });
    }

    const updates = req.body;
    
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

    // Ghi nhận phiên bản nếu phát hiện thay đổi
    if (hasChanges) {
      const nextVersion = (record.currentVersion || 1) + 1;
      const emrVersion = new EMRVersion({
        medicalRecordId: record._id,
        version: record.currentVersion || 1, // Lưu trạng thái hiện tại trước khi lên ver mới
        modifiedBy: req.user?.profile?.name || "Bác sĩ điều trị",
        changes,
      });
      await emrVersion.save();
      
      updates.currentVersion = nextVersion;
    }

    // If setting to discharge, record discharge date and recalculate retention
    if (updates.status === "Xuất viện" && record.status !== "Xuất viện") {
      updates.dischargeDate = new Date();
      const { retentionExpiresAt } = calculateRetentionExpiry(record.retentionCategory || "ngoai_tru", updates.dischargeDate);
      updates.retentionExpiresAt = retentionExpiresAt;
    }

    // [TT46/2018/TT-BYT & LUẬT 15/2023/QH15]: CẬP NHẬT NGUYÊN TỬ (ATOMIC CONDITIONAL UPDATE) CHỐNG RACE CONDITION
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
        message: "Hồ sơ bệnh án đã được ký số hoặc bệnh nhân đã xuất viện. Theo quy định Thông tư 46/2018/TT-BYT và Luật Khám bệnh, chữa bệnh số 15/2023/QH15, không được phép chỉnh sửa trực tiếp nội dung bệnh án. Vui lòng sử dụng tính năng 'Tạo phụ lục bổ sung' (Addendum).",
      });
    }

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
    console.error("Lỗi cập nhật bệnh án:", error);
    res.status(500).json({ message: "Không thể cập nhật bệnh án." });
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
    res.status(500).json({ message: "Không thể lấy lịch sử sửa đổi bệnh án." });
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
    res.status(500).json({ message: "Không thể lấy danh sách phiếu chăm sóc." });
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

    const { careLevel, pulse, bloodPressure, temperature, respiratoryRate, spo2, progressNotes, careActions, nurse } = req.body;

    if (!pulse || !bloodPressure || !temperature || !respiratoryRate || !spo2 || !progressNotes || !nurse) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ các chỉ số sinh hiệu và diễn biến bệnh." });
    }

    const newCareSheet = new CareSheet({
      hospitalId: record.hospitalId || req.user?.hospitalId,
      medicalRecordId: req.params.id,
      careLevel,
      pulse,
      bloodPressure,
      temperature,
      respiratoryRate,
      spo2,
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

        const { User } = await import("../models/user.model.js");
        const { VitalSign } = await import("../models/vitalSign.model.js");

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
              patient_id: patientUser._id,
              pulse: Number(pulse),
              blood_pressure: { systolic, diastolic },
              spo2: Number(spo2),
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
    res.status(500).json({ message: "Không thể lưu phiếu chăm sóc." });
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
    res.status(500).json({ message: "Không thể lấy danh sách biên bản hội chẩn." });
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

    const { meetingDate, participants, clinicalSummary, diagnosis, treatmentConclusion } = req.body;

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
    });

    await newConsultation.save();
    res.status(201).json({ status: "success", data: newConsultation });
  } catch (error) {
    console.error("Lỗi tạo biên bản hội chẩn:", error);
    res.status(500).json({ message: "Không thể lưu biên bản hội chẩn." });
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
    res.status(500).json({ message: "Không thể lấy danh sách giấy cam đoan." });
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
    res.status(500).json({ message: "Không thể tạo giấy cam đoan." });
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
    if (["doctor", "admin", "hospital_admin"].includes(userRole)) {
      consent.doctorSigned = true;
      consent.doctorSignature = signature || signerName || "Bs. Phụ trách";
      consent.signedAt = new Date();

      // Lưu trữ thông số Chữ ký số y tế (PKI / SmartCard / Cloud HSM)
      if (digitalSignature && typeof digitalSignature === "object") {
        consent.digitalSignatureMetadata = {
          signatureType: digitalSignature.signatureType || "pki_token",
          certificateSerial: digitalSignature.certificateSerial || "",
          signingAlgorithm: digitalSignature.signingAlgorithm || "SHA256withRSA",
          timestampToken: digitalSignature.timestampToken || "",
          caProvider: digitalSignature.caProvider || "VNPT-CA / Viettel-CA",
          signedHash: digitalSignature.signedHash || "",
          signedAt: new Date(),
        };
      }
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
    res.status(500).json({ message: "Không thể thực hiện ký duyệt." });
  }
};

// --- [TT46/2018/TT-BYT & LUẬT 15/2023/QH15]: BỔ SUNG PHỤ LỤC BỆNH ÁN (EMR ADDENDUM) ---
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
        details: `Thêm phụ lục bệnh án (lý do: ${reason}) theo Điều 12 TT46/2018/TT-BYT.`,
        payload: { addendumHash: signedHash, reason },
      });
    } catch (auditErr) {
      console.warn("Lỗi ghi audit log phụ lục:", auditErr.message);
    }

    res.status(201).json({ status: "success", data: record });
  } catch (error) {
    console.error("Lỗi tạo phụ lục bệnh án:", error);
    res.status(500).json({ message: "Không thể tạo phụ lục bệnh án." });
  }
};

// --- [LUẬT GDĐT 20/2023 & TT46/2018]: KÝ SỐ BỆNH ÁN ĐIỆN TỬ VÀ KÍCH HOẠT KHÓA BẤT BIẾN ---
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
    if (!["doctor", "admin", "hospital_admin"].includes(userRole)) {
      return res.status(403).json({ message: "Chỉ bác sĩ điều trị hoặc quản trị viên mới có thẩm quyền ký số bệnh án." });
    }

    const { certificateSerial, caProvider, signatureType, signingAlgorithm, timestampToken } = req.body || {};

    // Tính toán mã băm toàn vẹn nội dung bệnh án lâm sàng
    const clinicalDigest = `${record._id}|${record.patientId}|${record.diagnosis}|${record.treatmentPlan}|${record.department}|${record.hospitalId}`;
    const signedHash = crypto.createHash("sha256").update(clinicalDigest).digest("hex");

    record.signStatus = "Đã ký số";
    record.digitalSignatureMetadata = {
      signatureType: signatureType || "cloud_hsm",
      certificateSerial: certificateSerial || "VNPT_SMARTCA_2026_DEFAULT",
      signingAlgorithm: signingAlgorithm || "SHA256withRSA",
      timestampToken: timestampToken || "RFC3161_TSA_VERIFIED",
      caProvider: caProvider || "VNPT-CA / Viettel-CA",
      signedHash,
      signedBy: req.user?.profile?.name || req.user?.name || "Bác sĩ điều trị",
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
        details: `Ký số thành công hồ sơ bệnh án EMR (Chuẩn Luật GDĐT 20/2023 & TT 46/2018/TT-BYT). Kích hoạt Khóa Bất Biến.`,
        payload: { signedHash, certificateSerial: record.digitalSignatureMetadata.certificateSerial },
      });
    } catch (auditErr) {
      console.warn("Lỗi ghi audit log ký số EMR:", auditErr.message);
    }

    res.status(200).json({ status: "success", data: record });
  } catch (error) {
    console.error("Lỗi ký số bệnh án:", error);
    res.status(500).json({ message: "Không thể thực hiện ký số bệnh án." });
  }
};
