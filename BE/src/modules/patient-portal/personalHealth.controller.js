import { VitalSign } from "../emr/models/vitalSign.model.js";
import { MedicineReminder } from "../pharmacy/models/medicineReminder.model.js";
import { LabOrder } from "../laboratory/models/labOrder.model.js";
import { MedicalRecord } from "../emr/models/medicalRecord.model.js";
import { Prescription } from "../pharmacy/models/prescription.model.js";
import { successResponse, errorResponse } from "../../utils/response.util.js";
import { checkPatientTenancy } from "../../utils/tenancy.util.js";

// ─── V.1 — Theo dõi sinh hiệu theo thời gian (Vitals Trend Chart) ────────────
// @route GET /api/v1/personal-health/vitals-trend
// @access Private (Patient, Doctor, Nurse)
export const getVitalsTrend = async (req, res) => {
  try {
    const targetPatientId = req.user.role === 'patient' ? (req.user.id || req.user._id) : req.query.patientId;
    if (!targetPatientId) {
      return errorResponse(res, "Thiếu ID người bệnh (patientId).", 400);
    }

    // [SECURITY FIX BOLA/IDOR]: Xác thực phân quyền truy cập đa cơ sở
    const patient = await checkPatientTenancy(targetPatientId, req.user);
    if (!patient) {
      return errorResponse(res, "Không tìm thấy người bệnh hoặc bạn không có quyền truy cập hồ sơ sức khỏe này.", 403);
    }

    const { timeframe = '30d' } = req.query;
    const days = timeframe === '7d' ? 7 : timeframe === '90d' ? 90 : 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const vitals = await VitalSign.find({
      patient_id: targetPatientId,
      recorded_at: { $gte: startDate }
    }).sort({ recorded_at: 1 }).lean();

    // Phân tích chỉ số bất thường
    const analyzedVitals = vitals.map(v => {
      const isPulseAbnormal = v.pulse && (v.pulse < 60 || v.pulse > 100);
      const isSpo2Abnormal = v.spo2 && v.spo2 < 95;
      const bp = v.blood_pressure || {};
      const isBpAbnormal = (bp.systolic && (bp.systolic > 140 || bp.systolic < 90)) ||
                           (bp.diastolic && (bp.diastolic > 90 || bp.diastolic < 60));

      return {
        ...v,
        recordedAt: v.recorded_at,
        alerts: {
          pulse: isPulseAbnormal ? "Mạch bất thường (bình thường: 60-100 nhịp/phút)" : null,
          spo2: isSpo2Abnormal ? "SpO2 thấp (<95%)" : null,
          blood_pressure: isBpAbnormal ? `Huyết áp bất thường: ${bp.systolic}/${bp.diastolic} mmHg` : null,
        }
      };
    });

    return successResponse(res, {
      patientId: targetPatientId,
      timeframe,
      totalRecords: vitals.length,
      vitals: analyzedVitals,
    }, "Lấy dữ liệu xu hướng sinh hiệu thành công.");
  } catch (err) {
    console.error("Lỗi getVitalsTrend:", err);
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── V.2 — Đơn thuốc & Nhắc nhở uống thuốc (Medicine Reminders) ─────────────
// @route GET /api/v1/personal-health/medicine-reminders
// @access Private (Patient, Doctor)
export const getMedicineReminders = async (req, res) => {
  try {
    const targetPatientId = req.user.role === 'patient' ? (req.user.id || req.user._id) : req.query.patientId;
    if (!targetPatientId) {
      return errorResponse(res, "Thiếu ID người bệnh (patientId).", 400);
    }

    // [SECURITY FIX BOLA/IDOR]: Xác thực phân quyền truy cập đa cơ sở
    const patient = await checkPatientTenancy(targetPatientId, req.user);
    if (!patient) {
      return errorResponse(res, "Không tìm thấy người bệnh hoặc bạn không có quyền truy cập hồ sơ thuốc này.", 403);
    }

    // Lấy danh sách nhắc nhở uống thuốc (cả pending và done)
    const reminders = await MedicineReminder.find({
      patientId: targetPatientId,
    }).sort({ date: -1, time: 1 }).limit(30).lean();

    // Lấy các đơn thuốc gần nhất
    const prescriptions = await Prescription.find({ patient_id: targetPatientId })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    return successResponse(res, {
      reminders,
      prescriptions,
    }, "Lấy danh sách nhắc nhở uống thuốc thành công.");
  } catch (err) {
    console.error("Lỗi getMedicineReminders:", err);
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── V.3 — Kết quả xét nghiệm cận lâm sàng với giải thích đời thường ──────────
// @route GET /api/v1/personal-health/lab-results
// @access Private (Patient, Doctor)
export const getLabResultsWithExplanation = async (req, res) => {
  try {
    const targetPatientId = req.user.role === 'patient' ? (req.user.id || req.user._id) : req.query.patientId;
    if (!targetPatientId) {
      return errorResponse(res, "Thiếu ID người bệnh (patientId).", 400);
    }

    // [SECURITY FIX BOLA/IDOR]: Xác thực phân quyền truy cập đa cơ sở
    const patient = await checkPatientTenancy(targetPatientId, req.user);
    if (!patient) {
      return errorResponse(res, "Không tìm thấy người bệnh hoặc bạn không có quyền truy cập kết quả xét nghiệm này.", 403);
    }

    const labOrders = await LabOrder.find({ patient_id: targetPatientId })
      .sort({ ordered_at: -1 })
      .limit(10)
      .lean();

    // V.3 — Tự động thêm giải thích ngôn ngữ đời thường
    const resultsWithExplanation = labOrders.map(order => {
      const itemsWithNotes = (order.results || []).map(item => {
        let plainExplanation = "Chỉ số trong ngưỡng bình thường.";
        if (item.is_abnormal) {
          if (item.abnormal_direction === 'HIGH') {
            plainExplanation = `${item.biomarker_name || item.biomarker_code} cao hơn ngưỡng tham chiếu (${item.reference_range_display || 'bình thường'}). Cần theo dõi hoặc tham khảo bác sĩ điều trị.`;
          } else if (item.abnormal_direction === 'LOW') {
            plainExplanation = `${item.biomarker_name || item.biomarker_code} thấp hơn ngưỡng tham chiếu (${item.reference_range_display || 'bình thường'}). Cần theo dõi hoặc tham khảo bác sĩ điều trị.`;
          } else {
            plainExplanation = `${item.biomarker_name || item.biomarker_code} có giá trị bất thường so với tham chiếu.`;
          }
        }

        // Trường hợp đặc biệt: Chức năng thận liên quan cản quang MRI
        if ((item.biomarker_code === 'CREA' || item.biomarker_name?.toLowerCase().includes('creatinine')) && item.is_abnormal) {
          plainExplanation = "Creatinine tăng cao — cảnh báo suy giảm chức năng thận, cần bác sĩ CĐHA hội chẩn trước khi tiêm thuốc đối quang từ MRI.";
        }

        return { ...item, plainExplanation };
      });

      return {
        ...order,
        orderDate: order.ordered_at,
        results: itemsWithNotes,
        testItems: itemsWithNotes // Hỗ trợ tương thích ngược
      };
    });

    return successResponse(res, resultsWithExplanation, "Lấy kết quả xét nghiệm kèm giải thích thành công.");
  } catch (err) {
    console.error("Lỗi getLabResultsWithExplanation:", err);
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── V.4 — Hồ sơ bệnh án tóm tắt dành cho người bệnh (EMR Summary) ─────────
// @route GET /api/v1/personal-health/emr-summary
// @access Private (Patient, Doctor)
export const getEmrSummaryForPatient = async (req, res) => {
  try {
    const targetPatientId = req.user.role === 'patient' ? (req.user.id || req.user._id) : req.query.patientId;
    if (!targetPatientId) {
      return errorResponse(res, "Thiếu ID người bệnh (patientId).", 400);
    }

    // [SECURITY FIX BOLA/IDOR]: Xác thực phân quyền truy cập đa cơ sở
    const patient = await checkPatientTenancy(targetPatientId, req.user);
    if (!patient) {
      return errorResponse(res, "Không tìm thấy người bệnh hoặc bạn không có quyền truy cập hồ sơ bệnh án này.", 403);
    }

    const records = await MedicalRecord.find({
      $or: [
        { patientId: targetPatientId.toString() },
        { patient_id: targetPatientId }
      ]
    })
      .sort({ createdAt: -1 })
      .lean();

    // Lọc bỏ thông tin nội bộ phức tạp, chỉ giữ tóm tắt
    const summary = records.map(rec => ({
      recordId: rec._id,
      admissionDate: rec.admissionDate || rec.createdAt,
      dischargeDate: rec.dischargeDate || null,
      admissionType: rec.admissionType || "Ngoại trú",
      department: rec.department || rec.departmentName || "Khoa Ngoại thần kinh",
      mainDiagnosis: rec.diagnosis || "Chưa có chẩn đoán chính",
      treatmentPlanSummary: rec.treatmentPlan || "Theo dõi điều trị ngoại trú",
      status: rec.status,
    }));

    return successResponse(res, summary, "Lấy tóm tắt hồ sơ bệnh án thành công.");
  } catch (err) {
    console.error("Lỗi getEmrSummaryForPatient:", err);
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};
