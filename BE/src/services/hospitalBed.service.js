import mongoose from "mongoose";
import { HospitalBed } from "../models/hospitalBed.model.js";

/**
 * Service: Lấy danh sách giường bệnh theo khoa và điều kiện lọc
 */
export const getBedsService = async ({ hospitalId, filters = {} }) => {
  if (!hospitalId) {
    const err = new Error("Bạn chưa được gán vào bệnh viện nào.");
    err.statusCode = 403;
    throw err;
  }

  const { departmentId, status, type } = filters;
  const query = { hospitalId };
  if (departmentId) query.departmentId = departmentId;
  if (status) query.status = status;
  if (type) query.type = type;

  const beds = await HospitalBed.find(query)
    .populate("reservedForPatientId", "profile.name profile.fullName email")
    .populate("currentPatientId", "profile.name profile.fullName email")
    .sort({ departmentId: 1, roomNumber: 1, bedNumber: 1 });

  return beds;
};

/**
 * Service: Thêm mới giường bệnh
 */
export const createBedService = async ({ hospitalId, role, bedData }) => {
  if (!["admin", "hospital_admin"].includes(role)) {
    const err = new Error("Chỉ admin mới có thể thêm giường bệnh.");
    err.statusCode = 403;
    throw err;
  }

  const { departmentId, departmentName, bedNumber, roomNumber, floor, type, notes } = bedData;
  if (!departmentId || !bedNumber) {
    const err = new Error("Mã khoa (departmentId) và số giường (bedNumber) là bắt buộc.");
    err.statusCode = 400;
    throw err;
  }

  const existing = await HospitalBed.findOne({ hospitalId, departmentId, bedNumber });
  if (existing) {
    const err = new Error(`Giường số ${bedNumber} đã tồn tại trong khoa ${departmentId}.`);
    err.statusCode = 409;
    throw err;
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
  return bed;
};

/**
 * Service: Giữ chỗ giường nguyên tử chống Race Condition (Atomic Reserve)
 */
export const reserveBedAtomicService = async ({ bedId, hospitalId, user, reserveData }) => {
  if (!["doctor", "nurse", "admin", "hospital_admin", "receptionist"].includes(user.role)) {
    const err = new Error("Không có quyền giữ chỗ giường bệnh.");
    err.statusCode = 403;
    throw err;
  }

  const { visitId, patientId, holdHours = 4 } = reserveData;
  const reservedUntil = new Date(Date.now() + Number(holdHours) * 60 * 60 * 1000);

  const bed = await HospitalBed.findOneAndUpdate(
    {
      _id: bedId,
      hospitalId,
      status: 'available'
    },
    {
      $set: {
        status: 'reserved',
        reservedUntil,
        reservedForVisitId: visitId || null,
        reservedForPatientId: patientId || null,
        reservedByUserId: (user?.id && mongoose.isValidObjectId(user.id)) ? user.id : null,
        reservedAt: new Date()
      }
    },
    { new: true }
  );

  if (!bed) {
    const err = new Error("Không thể giữ chỗ: Giường này hiện không ở trạng thái sẵn sàng (available) hoặc vừa được giữ chỗ bởi nhân viên khác!");
    err.statusCode = 409;
    throw err;
  }

  return bed;
};

/**
 * Service: Bệnh nhân nhận giường (Atomic Occupy)
 */
export const occupyBedAtomicService = async ({ bedId, hospitalId, user, occupyData }) => {
  if (!["doctor", "nurse", "admin", "hospital_admin"].includes(user.role)) {
    const err = new Error("Không có quyền xếp bệnh nhân vào giường.");
    err.statusCode = 403;
    throw err;
  }

  const { visitId, patientId, diagnosis, medicalRecordId } = occupyData;
  if (!patientId) {
    const err = new Error("Thông tin bệnh nhân (patientId) là bắt buộc khi nhập viện.");
    err.statusCode = 400;
    throw err;
  }

  const bed = await HospitalBed.findOneAndUpdate(
    {
      _id: bedId,
      hospitalId,
      status: { $in: ['available', 'reserved'] }
    },
    {
      $set: {
        status: 'occupied',
        currentVisitId: visitId || null,
        currentPatientId: patientId,
        occupiedAt: new Date(),
        reservedUntil: null,
        reservedForVisitId: null,
        reservedForPatientId: null,
      }
    },
    { new: true }
  );

  if (!bed) {
    const err = new Error("Không thể xếp bệnh nhân: Giường này đang có người nằm hoặc đang khử khuẩn/bảo trì!");
    err.statusCode = 409;
    throw err;
  }

  return bed;
};

/**
 * Service: Trả giường bệnh và chuyển sang trạng thái khử khuẩn
 */
export const releaseBedService = async ({ bedId, hospitalId, user, releaseData = {} }) => {
  if (!["doctor", "nurse", "admin", "hospital_admin"].includes(user.role)) {
    const err = new Error("Không có quyền trả giường bệnh.");
    err.statusCode = 403;
    throw err;
  }

  const bed = await HospitalBed.findOne({ _id: bedId, hospitalId });
  if (!bed) {
    const err = new Error("Không tìm thấy giường bệnh.");
    err.statusCode = 404;
    throw err;
  }

  if (bed.status === 'available') {
    const err = new Error("Giường này đang trống sẵn sàng, không cần trả.");
    err.statusCode = 400;
    throw err;
  }

  const { toCleaning = true } = releaseData;

  bed.status = toCleaning ? 'cleaning' : 'available';
  bed.currentVisitId = null;
  bed.currentPatientId = null;
  bed.occupiedAt = null;
  bed.reservedUntil = null;
  bed.reservedForVisitId = null;
  bed.reservedForPatientId = null;

  await bed.save();
  return bed;
};
