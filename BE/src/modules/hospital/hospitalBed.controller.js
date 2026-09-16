import mongoose from "mongoose";
import { HospitalBed } from "./models/hospitalBed.model.js";
import { MedicalRecord } from "../emr/models/medicalRecord.model.js";
import { successResponse, errorResponse } from "../../utils/response.util.js";
import {
  reserveBedAtomicService,
  occupyBedAtomicService,
  releaseBedService,
  completeCleaningService,
  transferBedWithinHospitalService,
  checkNeuroIcuCapacityAlertService
} from "../../services/hospitalBed.service.js";

// ─── Q.1 — Lấy danh sách giường bệnh theo khoa ──────────────────────────────
// @route GET /api/v1/hospital-beds
// @access Private
export const getBeds = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    if (!hospitalId) return errorResponse(res, "Bạn chưa được gán vào bệnh viện nào.", 403);

    const { departmentId, status, type } = req.query;
    const filter = { hospitalId };
    if (departmentId) filter.departmentId = departmentId;
    if (status) filter.status = status;
    if (type) filter.type = type;

    const beds = await HospitalBed.find(filter)
      .populate("reservedForPatientId", "profile.name profile.fullName email")
      .populate("currentPatientId", "profile.name profile.fullName email")
      .sort({ departmentId: 1, roomNumber: 1, bedNumber: 1 });

    return successResponse(res, beds, "Lấy danh sách giường bệnh thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── Q.1 — Thêm giường bệnh mới ──────────────────────────────────────────────
// @route POST /api/v1/hospital-beds
// @access Private (Admin, Hospital_admin)
export const createBed = async (req, res) => {
  try {
    if (!["admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ admin mới có thể thêm giường bệnh.", 403);
    }
    const hospitalId = req.user.hospitalId;

    const { departmentId, departmentName, bedNumber, roomNumber, floor, type, notes } = req.body;
    if (!departmentId || !bedNumber) {
      return errorResponse(res, "Mã khoa (departmentId) và số giường (bedNumber) là bắt buộc.", 400);
    }

    // Kiểm tra trùng số giường trong cùng khoa
    const existing = await HospitalBed.findOne({ hospitalId, departmentId, bedNumber });
    if (existing) {
      return errorResponse(res, `Giường số ${bedNumber} đã tồn tại trong khoa ${departmentId}.`, 409);
    }

    const bed = new HospitalBed({
      hospitalId,
      departmentId,
      departmentName: departmentName || departmentId,
      bedNumber,
      roomNumber: roomNumber || "",
      floor: floor || "",
      type: type || 'standard',
      status: 'available',
      notes: notes || "",
    });
    await bed.save();

    return successResponse(res, bed, "Tạo giường bệnh thành công.", 201);
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── Q.2 — Giữ chỗ giường tạm thời (4 giờ) khi nhập viện / nhận chuyển viện ─────
// @route POST /api/v1/hospital-beds/:id/reserve
// @access Private (Doctor, Nurse, Admin)
export const reserveBed = async (req, res) => {
  try {
    const { holdHours = 4 } = req.body;
    const bed = await reserveBedAtomicService({
      bedId: req.params.id,
      hospitalId: req.user.hospitalId,
      user: req.user,
      reserveData: req.body
    });

    const reservedUntil = bed.reservedUntil;
    return successResponse(res, {
      bed,
      reservedUntil,
      message: `Đã giữ chỗ giường ${bed.bedNumber} (phòng ${bed.roomNumber}) trong ${holdHours} giờ (đến ${reservedUntil.toLocaleTimeString('vi-VN')}).`
    }, "Giữ chỗ giường bệnh thành công.");
  } catch (err) {
    if (err.statusCode === 409) {
      return errorResponse(res, err.message, 409);
    }
    return errorResponse(res, err.message || "Lỗi máy chủ", err.statusCode || 500);
  }
};

// ─── Xóa giữ chỗ / Nhập viện vào giường ─────────────────────────────────────
// @route PUT /api/v1/hospital-beds/:id/occupy
// @access Private (Nurse, Doctor, Admin)
export const occupyBed = async (req, res) => {
  try {
    const bed = await occupyBedAtomicService({
      bedId: req.params.id,
      hospitalId: req.user.hospitalId,
      user: req.user,
      occupyData: req.body
    });

    return successResponse(res, bed, `Bệnh nhân đã nhập vào giường ${bed.bedNumber}.`);
  } catch (err) {
    if (err.statusCode === 409) {
      return errorResponse(res, err.message, 409);
    }
    return errorResponse(res, err.message || "Lỗi máy chủ", err.statusCode || 500);
  }
};

// ─── Q.3 — Giải phóng giường khi xuất viện ──────────────────────────────────
// @route PUT /api/v1/hospital-beds/:id/release
// @access Private (Nurse, Doctor, Admin)
export const releaseBed = async (req, res) => {
  try {
    const bed = await releaseBedService({
      bedId: req.params.id,
      hospitalId: req.user.hospitalId,
      user: req.user,
      releaseData: req.body
    });

    return successResponse(res, bed, `Đã giải phóng giường ${bed.bedNumber}. Trạng thái chuyển về trống.`);
  } catch (err) {
    return errorResponse(res, err.message || "Lỗi máy chủ", err.statusCode || 500);
  }
};


// ─── Q.4 — Bản đồ giường trực quan (Real-time Bed Map Summary) ──────────────
// @route GET /api/v1/hospital-beds/map-summary
// @access Private
export const getBedMapSummary = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    if (!hospitalId) return errorResponse(res, "Bạn chưa được gán vào bệnh viện nào.", 403);

    // Tự động giải phóng các giường giữ chỗ đã quá hạn
    await HospitalBed.updateMany(
      { hospitalId, status: 'reserved', reservedUntil: { $lt: new Date() } },
      { $set: { status: 'available', reservedUntil: null, reservedForPatientId: null, reservedForVisitId: null } }
    );

    const beds = await HospitalBed.find({ hospitalId })
      .populate("currentPatientId", "profile.name profile.fullName")
      .populate("reservedForPatientId", "profile.name profile.fullName")
      .lean();

    // Thống kê theo khoa
    const departmentMap = {};
    let totalBeds = 0;
    let availableCount = 0;
    let occupiedCount = 0;
    let reservedCount = 0;

    beds.forEach(bed => {
      totalBeds++;
      if (bed.status === 'available') availableCount++;
      if (bed.status === 'occupied') occupiedCount++;
      if (bed.status === 'reserved') reservedCount++;

      const deptKey = bed.departmentId;
      if (!departmentMap[deptKey]) {
        departmentMap[deptKey] = {
          departmentId: deptKey,
          departmentName: bed.departmentName || deptKey,
          total: 0,
          available: 0,
          occupied: 0,
          reserved: 0,
          rooms: {}
        };
      }

      departmentMap[deptKey].total++;
      departmentMap[deptKey][bed.status]++;

      const roomKey = bed.roomNumber || "Chưa xếp phòng";
      if (!departmentMap[deptKey].rooms[roomKey]) {
        departmentMap[deptKey].rooms[roomKey] = [];
      }
      departmentMap[deptKey].rooms[roomKey].push(bed);
    });

    return successResponse(res, {
      summary: { totalBeds, availableCount, occupiedCount, reservedCount },
      departments: Object.values(departmentMap),
    }, "Lấy bản đồ giường trực quan thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── Q.5 — Hoàn tất khử khuẩn buồng bệnh ────────────────────────────────────
// @route PUT /api/v1/hospital-beds/:id/cleaning-complete
// @access Private (Nurse, Doctor, Admin, Cleaner)
export const completeCleaning = async (req, res) => {
  try {
    const bed = await completeCleaningService({
      bedId: req.params.id,
      hospitalId: req.user.hospitalId,
      user: req.user,
      cleaningData: req.body
    });

    return successResponse(res, bed, `Đã hoàn tất khử khuẩn buồng bệnh. Giường ${bed.bedNumber} sẵn sàng đón bệnh nhân mới.`);
  } catch (err) {
    return errorResponse(res, err.message || "Lỗi máy chủ", err.statusCode || 500);
  }
};

// ─── Q.6 — Điều chuyển bệnh nhân giữa các giường nội viện ────────────────────
// @route POST /api/v1/hospital-beds/transfer-internal
// @access Private (Doctor, Nurse, Admin)
export const transferBedInternal = async (req, res) => {
  try {
    const { fromBedId, toBedId, patientId, reason, diagnosis } = req.body;
    if (!fromBedId || !toBedId || !patientId) {
      return errorResponse(res, "Thiếu thông tin bắt buộc: fromBedId, toBedId, patientId.", 400);
    }

    const result = await transferBedWithinHospitalService({
      fromBedId,
      toBedId,
      hospitalId: req.user.hospitalId,
      user: req.user,
      transferData: { patientId, reason, diagnosis }
    });

    return successResponse(res, result, "Điều chuyển bệnh nhân giữa các buồng giường nội viện thành công.");
  } catch (err) {
    if (err.statusCode === 409) {
      return errorResponse(res, err.message, 409);
    }
    return errorResponse(res, err.message || "Lỗi máy chủ", err.statusCode || 500);
  }
};

// ─── Q.7 — Kiểm tra và cảnh báo công suất giường ICU U não ───────────────────
// @route GET /api/v1/hospital-beds/neuro-icu-capacity
// @access Private (Doctor, Nurse, Admin)
export const getNeuroIcuCapacityAlert = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    if (!hospitalId) return errorResponse(res, "Bạn chưa được gán vào bệnh viện nào.", 403);

    const alertInfo = await checkNeuroIcuCapacityAlertService({ hospitalId });
    return successResponse(res, alertInfo, "Kiểm tra công suất giường Neuro-ICU thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

