import mongoose from "mongoose";
import { HospitalBed } from "../models/hospitalBed.model.js";
import { recordAuditLog, AUDIT_ACTIONS } from "./auditLog.service.js";

/**
 * Service: Lấy danh sách giường bệnh theo khoa và điều kiện lọc
 * Tự động giải phóng các giường giữ chỗ đã hết hạn trước khi trả về danh sách
 */
export const getBedsService = async ({ hospitalId, filters = {} }) => {
  if (!hospitalId) {
    const err = new Error("Bạn chưa được gán vào bệnh viện nào.");
    err.statusCode = 403;
    throw err;
  }

  // Tự động thu hồi các giường giữ chỗ đã quá hạn
  await HospitalBed.updateMany(
    { hospitalId, status: 'reserved', reservedUntil: { $lt: new Date() } },
    {
      $set: {
        status: 'available',
        reservedUntil: null,
        reservedForPatientId: null,
        reservedForVisitId: null,
        reserveReason: null
      }
    }
  );

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
 * Service: Thêm mới giường bệnh (Hỗ trợ cấu hình Neuro-Oncology ICU & Cách ly)
 */
export const createBedService = async ({ hospitalId, role, bedData }) => {
  if (!["admin", "hospital_admin"].includes(role)) {
    const err = new Error("Chỉ admin mới có thể thêm giường bệnh.");
    err.statusCode = 403;
    throw err;
  }

  const {
    departmentId,
    departmentName,
    bedNumber,
    roomNumber,
    floor,
    type,
    notes,
    hasIcpMonitor,
    hasEegMonitor,
    isIsolationRoom
  } = bedData;

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
    hasIcpMonitor: Boolean(hasIcpMonitor || type === 'icu_neuro_icp'),
    hasEegMonitor: Boolean(hasEegMonitor || type === 'icu_neuro_eeg'),
    isIsolationRoom: Boolean(isIsolationRoom || type === 'isolation'),
  });

  await bed.save();
  return bed;
};

/**
 * Service: Giữ chỗ giường nguyên tử chống Race Condition (Atomic Reserve)
 * Hỗ trợ giữ chỗ mổ phiên u não mở sọ (scheduled_craniotomy) lên tới 48 tiếng
 * Tự động thu hồi và tái sử dụng nguyên tử nếu giường cũ đã hết hạn giữ chỗ
 */
export const reserveBedAtomicService = async ({ bedId, hospitalId, user, reserveData }) => {
  if (!["doctor", "nurse", "admin", "hospital_admin", "receptionist"].includes(user?.role)) {
    const err = new Error("Không có quyền giữ chỗ giường bệnh.");
    err.statusCode = 403;
    throw err;
  }

  const {
    visitId,
    patientId,
    holdHours = 4,
    reserveReason = 'emergency',
    notes = ""
  } = reserveData;

  // Với phẫu thuật mở sọ u não theo kế hoạch (scheduled_craniotomy) cho phép giữ tới 48h
  const parsedHoldHours = reserveReason === 'scheduled_craniotomy'
    ? Math.min(Math.max(Number(holdHours) || 24, 1), 48)
    : Math.min(Math.max(Number(holdHours) || 4, 1), 24);

  const reservedUntil = new Date(Date.now() + parsedHoldHours * 60 * 60 * 1000);

  // Thao tác nguyên tử: chỉ match khi giường 'available' HOẶC 'reserved' nhưng đã quá hạn
  const bed = await HospitalBed.findOneAndUpdate(
    {
      _id: bedId,
      hospitalId,
      $or: [
        { status: 'available' },
        { status: 'reserved', reservedUntil: { $lt: new Date() } }
      ]
    },
    {
      $set: {
        status: 'reserved',
        reservedUntil,
        reserveReason,
        reservedForVisitId: visitId || null,
        reservedForPatientId: patientId || null,
        reservedByUserId: (user?.id && mongoose.isValidObjectId(user.id)) ? user.id : null,
        reservedAt: new Date(),
        ...(notes ? { notes } : {})
      }
    },
    { new: true }
  );

  if (!bed) {
    // Ghi vết cảnh báo cướp giường bị chặn
    try {
      await recordAuditLog({
        action: AUDIT_ACTIONS.BED_HIJACK_BLOCKED,
        entity: "HospitalBed",
        entityId: bedId,
        performedBy: user?.id || "unknown",
        hospitalId,
        details: `Cố gắng giữ chỗ giường không khả dụng (đang có người hoặc đang giữ chỗ cho người khác) cho bệnh nhân ${patientId}`,
        payload: { targetPatientId: patientId, bedId }
      });
    } catch (_) {}

    const err = new Error("Không thể giữ chỗ: Giường này hiện không ở trạng thái sẵn sàng (available) hoặc vừa được giữ chỗ bởi nhân viên khác!");
    err.statusCode = 409;
    throw err;
  }

  // Ghi vết audit log thành công
  try {
    await recordAuditLog({
      action: AUDIT_ACTIONS.BED_RESERVED,
      entity: "HospitalBed",
      entityId: bed._id,
      performedBy: user?.id || "unknown",
      hospitalId,
      details: `Giữ chỗ giường ${bed.bedNumber} (Phòng ${bed.roomNumber}) trong ${parsedHoldHours}h cho bệnh nhân ${patientId}. Lý do: ${reserveReason}`,
      payload: { bedId: bed._id, patientId, reserveReason, reservedUntil }
    });
  } catch (_) {}

  return bed;
};

/**
 * Service: Bệnh nhân nhận giường (Atomic Occupy)
 * Đảm bảo chỉ đúng bệnh nhân được giữ chỗ hoặc giường hoàn toàn khả dụng mới được nhận giường
 * Thẩm định an toàn lâm sàng bệnh nhân suy giảm miễn dịch nặng u não (hóa trị Temozolomide)
 */
export const occupyBedAtomicService = async ({ bedId, hospitalId, user, occupyData }) => {
  if (!["doctor", "nurse", "admin", "hospital_admin"].includes(user?.role)) {
    const err = new Error("Không có quyền xếp bệnh nhân vào giường.");
    err.statusCode = 403;
    throw err;
  }

  const {
    visitId,
    patientId,
    diagnosis,
    medicalRecordId,
    hasInfection = false,
    isImmunosuppressed = false
  } = occupyData;

  if (!patientId) {
    const err = new Error("Thông tin bệnh nhân (patientId) là bắt buộc khi nhập viện.");
    err.statusCode = 400;
    throw err;
  }

  // Thao tác nguyên tử:
  // 1. Giường đang 'available'
  // 2. Hoặc giường đang 'reserved' đúng cho patientId này còn hạn
  // 3. Hoặc giường 'reserved' nhưng đã hết hạn giữ chỗ
  const bed = await HospitalBed.findOneAndUpdate(
    {
      _id: bedId,
      hospitalId,
      $or: [
        { status: 'available' },
        { 
          status: 'reserved', 
          reservedForPatientId: patientId, 
          reservedUntil: { $gte: new Date() } 
        },
        {
          status: 'reserved',
          reservedUntil: { $lt: new Date() }
        }
      ]
    },
    {
      $set: {
        status: 'occupied',
        currentVisitId: visitId || null,
        currentPatientId: patientId,
        occupiedAt: new Date(),
        admittedAt: new Date(),
        reservedUntil: null,
        reservedForVisitId: null,
        reservedForPatientId: null,
        reserveReason: null,
        notes: diagnosis ? `Chẩn đoán: ${diagnosis}` : ""
      }
    },
    { new: true }
  );

  if (!bed) {
    try {
      await recordAuditLog({
        action: AUDIT_ACTIONS.BED_HIJACK_BLOCKED,
        entity: "HospitalBed",
        entityId: bedId,
        performedBy: user?.id || "unknown",
        hospitalId,
        details: `Chặn đứng nỗ lực xếp bệnh nhân ${patientId} vào giường đã có người hoặc đang giữ chỗ cho người khác!`,
        payload: { attemptPatientId: patientId, bedId }
      });
    } catch (_) {}

    const err = new Error("Không thể xếp bệnh nhân: Giường này đang có người nằm hoặc đang khử khuẩn/bảo trì!");
    err.statusCode = 409;
    throw err;
  }

  // Cảnh báo lâm sàng nếu bệnh nhân suy giảm miễn dịch/nhiễm trùng cần buồng cách ly
  if ((hasInfection || isImmunosuppressed) && bed.type !== 'isolation' && !bed.isIsolationRoom) {
    console.warn(`⚠️ [CLINICAL_WARNING] Bệnh nhân u não suy giảm miễn dịch ${patientId} được xếp vào giường không cách ly ${bed.bedNumber}.`);
  }

  // Ghi vết audit log
  try {
    await recordAuditLog({
      action: AUDIT_ACTIONS.BED_OCCUPIED,
      entity: "HospitalBed",
      entityId: bed._id,
      performedBy: user?.id || "unknown",
      hospitalId,
      details: `Bệnh nhân ${patientId} đã nhập vào giường ${bed.bedNumber} (Khoa ${bed.departmentId}, Loại: ${bed.type})`,
      payload: { bedId: bed._id, patientId, bedType: bed.type, visitId }
    });
  } catch (_) {}

  return bed;
};

/**
 * Service: Trả giường bệnh và chuyển sang trạng thái khử khuẩn
 * Khắc phục triệt để Lost Update bằng findOneAndUpdate nguyên tử có điều kiện trạng thái
 */
export const releaseBedService = async ({ bedId, hospitalId, user, releaseData = {} }) => {
  if (!["doctor", "nurse", "admin", "hospital_admin"].includes(user?.role)) {
    const err = new Error("Không có quyền trả giường bệnh.");
    err.statusCode = 403;
    throw err;
  }

  const { toCleaning = true, notes = "" } = releaseData;

  // Thao tác nguyên tử: Chỉ cập nhật nếu giường đang occupied, reserved, cleaning hoặc maintenance
  const bed = await HospitalBed.findOneAndUpdate(
    {
      _id: bedId,
      hospitalId,
      status: { $in: ['occupied', 'reserved', 'cleaning', 'maintenance'] }
    },
    {
      $set: {
        status: toCleaning ? 'cleaning' : 'available',
        currentVisitId: null,
        currentPatientId: null,
        occupiedAt: null,
        reservedUntil: null,
        reservedForVisitId: null,
        reservedForPatientId: null,
        reserveReason: null,
        lastOccupiedAt: new Date(),
        notes: notes || (toCleaning ? "Đang chờ khử khuẩn buồng bệnh" : "Sẵn sàng đón bệnh nhân mới")
      }
    },
    { new: true }
  );

  if (!bed) {
    // Kiểm tra xem giường có tồn tại không để trả mã lỗi chính xác
    const existingBed = await HospitalBed.findOne({ _id: bedId, hospitalId });
    if (!existingBed) {
      const err = new Error("Không tìm thấy giường bệnh.");
      err.statusCode = 404;
      throw err;
    }
    if (existingBed.status === 'available') {
      const err = new Error("Giường này đang trống sẵn sàng, không cần trả.");
      err.statusCode = 400;
      throw err;
    }
  }

  // Ghi vết audit log
  try {
    await recordAuditLog({
      action: AUDIT_ACTIONS.BED_RELEASED,
      entity: "HospitalBed",
      entityId: bed._id,
      performedBy: user?.id || "unknown",
      hospitalId,
      details: `Giải phóng giường ${bed.bedNumber}. Chuyển trạng thái sang: ${bed.status}`,
      payload: { bedId: bed._id, newStatus: bed.status }
    });
  } catch (_) {}

  return bed;
};

/**
 * Service: Hoàn tất khử khuẩn buồng bệnh (Quy chuẩn Kiểm soát nhiễm khuẩn Bộ Y tế)
 * Chuyển giường từ 'cleaning' hoặc 'maintenance' về 'available' nguyên tử
 */
export const completeCleaningService = async ({ bedId, hospitalId, user, cleaningData = {} }) => {
  if (!["doctor", "nurse", "admin", "hospital_admin", "cleaner"].includes(user?.role)) {
    const err = new Error("Không có quyền hoàn tất khử khuẩn buồng bệnh.");
    err.statusCode = 403;
    throw err;
  }

  const { notes = "Khử khuẩn tia cực tím & lau cồn bề mặt đạt chuẩn" } = cleaningData;

  const bed = await HospitalBed.findOneAndUpdate(
    {
      _id: bedId,
      hospitalId,
      status: { $in: ['cleaning', 'maintenance'] }
    },
    {
      $set: {
        status: 'available',
        notes
      }
    },
    { new: true }
  );

  if (!bed) {
    const existing = await HospitalBed.findOne({ _id: bedId, hospitalId });
    if (!existing) {
      const err = new Error("Không tìm thấy giường bệnh.");
      err.statusCode = 404;
      throw err;
    }
    const err = new Error(`Không thể hoàn tất khử khuẩn: Giường đang ở trạng thái '${existing.status}'.`);
    err.statusCode = 400;
    throw err;
  }

  try {
    await recordAuditLog({
      action: AUDIT_ACTIONS.BED_CLEANING_COMPLETED,
      entity: "HospitalBed",
      entityId: bed._id,
      performedBy: user?.id || "unknown",
      hospitalId,
      details: `Đã hoàn tất khử khuẩn giường ${bed.bedNumber}. Đưa về sẵn sàng (available).`,
      payload: { bedId: bed._id, notes }
    });
  } catch (_) {}

  return bed;
};

/**
 * Service: Chuyển giường nội viện (ICU Neuro ICP <-> Hồi tỉnh <-> Khoa thường)
 * Đảm bảo chuỗi thao tác nguyên tử: Chiếm giường mới thành công trước khi trả giường cũ sang khử khuẩn
 */
export const transferBedWithinHospitalService = async ({ fromBedId, toBedId, hospitalId, user, transferData = {} }) => {
  if (!["doctor", "nurse", "admin", "hospital_admin"].includes(user?.role)) {
    const err = new Error("Không có quyền điều chuyển giường nội viện.");
    err.statusCode = 403;
    throw err;
  }

  const { patientId, reason = "post_op_stabilization", diagnosis = "" } = transferData;
  if (!patientId) {
    const err = new Error("Mã bệnh nhân (patientId) là bắt buộc khi chuyển giường.");
    err.statusCode = 400;
    throw err;
  }

  // 1. Kiểm tra giường nguồn có đúng đang chứa bệnh nhân này không
  const fromBed = await HospitalBed.findOne({ _id: fromBedId, hospitalId, status: 'occupied', currentPatientId: patientId });
  if (!fromBed) {
    const err = new Error("Giường nguồn không hợp lệ hoặc bệnh nhân không nằm tại giường này.");
    err.statusCode = 400;
    throw err;
  }

  // 2. Chiếm giữ giường đích nguyên tử
  const toBed = await occupyBedAtomicService({
    bedId: toBedId,
    hospitalId,
    user,
    occupyData: {
      patientId,
      diagnosis: diagnosis || `Chuyển từ giường ${fromBed.bedNumber} (${reason})`
    }
  });

  // 3. Giải phóng giường nguồn sang trạng thái khử khuẩn
  await releaseBedService({
    bedId: fromBedId,
    hospitalId,
    user,
    releaseData: {
      toCleaning: true,
      notes: `Đã chuyển bệnh nhân ${patientId} sang giường ${toBed.bedNumber}. Đang chờ khử khuẩn buồng bệnh.`
    }
  });

  // Ghi vết chuyển giường
  try {
    await recordAuditLog({
      action: AUDIT_ACTIONS.BED_TRANSFERRED,
      entity: "HospitalBed",
      entityId: toBed._id,
      performedBy: user?.id || "unknown",
      hospitalId,
      details: `Điều chuyển bệnh nhân ${patientId} từ giường ${fromBed.bedNumber} (${fromBed.type}) sang giường ${toBed.bedNumber} (${toBed.type}). Lý do: ${reason}`,
      payload: { patientId, fromBedId, toBedId, reason }
    });
  } catch (_) {}

  return { fromBed, toBed };
};

/**
 * Service: Cảnh báo quá tải giường hồi sức tích cực U não (Neuro-ICU Capacity Alert)
 */
export const checkNeuroIcuCapacityAlertService = async ({ hospitalId }) => {
  const neuroIcuBeds = await HospitalBed.find({
    hospitalId,
    type: { $in: ['icu_neuro_icp', 'icu_neuro_eeg', 'icu_standard', 'icu'] }
  }).lean();

  const total = neuroIcuBeds.length;
  const available = neuroIcuBeds.filter(b => b.status === 'available').length;
  const occupied = neuroIcuBeds.filter(b => b.status === 'occupied').length;
  const reserved = neuroIcuBeds.filter(b => b.status === 'reserved').length;

  const isCritical = total > 0 && available < 2;

  return {
    total,
    available,
    occupied,
    reserved,
    isCritical,
    alertLevel: isCritical ? "HIGH" : "NORMAL",
    message: isCritical
      ? `🚨 CẢNH BÁO: Khoa HSTC Ngoại Thần kinh chỉ còn ${available} giường ICU u não! Cần điều phối hoặc kích hoạt phương án chuyển viện dự phòng.`
      : `Hệ thống giường Neuro-ICU hoạt động an toàn (${available}/${total} giường sẵn sàng).`
  };
};
