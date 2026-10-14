import { isValidObjectId } from "mongoose";
import { Assignment } from "../models/assignment.model.js";
import { User } from "../models/user.model.js";
import { Visit } from "../models/visit.model.js";
import { ImagingResult } from "../models/imagingResult.model.js";
import { Hospital } from "../models/hospital.model.js";
import { createNotificationInternal } from "./notification.controller.js";
import { successResponse, errorResponse } from "../utils/response.util.js";

// ─── D.1 — Tự động phân công bác sĩ đọc phim ────────────────────────────────
// Logic: chọn bác sĩ Neuroradiologist đang trực (isOnCall=true) có caseload ít nhất
// @route POST /api/v1/assignments/auto-assign
// @access Private (System/Admin)
export const autoAssignDoctor = async (req, res) => {
  try {
    if (!["admin", "hospital_admin", "technician"].includes(req.user.role)) {
      return errorResponse(res, "Không có quyền phân công bác sĩ.", 403);
    }

    const hospitalId = req.user.hospitalId;
    const { visitId, imagingResultId, assignmentType = 'read' } = req.body;

    if (!visitId) return errorResponse(res, "Thiếu visitId.", 400);

    // Fix 0009: chặn ObjectId sai định dạng sớm — tránh 500 CastError lộ message Mongoose
    if (!isValidObjectId(visitId)) {
      return errorResponse(res, "visitId không hợp lệ.", 400);
    }
    if (imagingResultId && !isValidObjectId(imagingResultId)) {
      return errorResponse(res, "imagingResultId không hợp lệ.", 400);
    }

    const visit = await Visit.findOne({ _id: visitId, hospitalId });
    if (!visit) return errorResponse(res, "Không tìm thấy lượt khám.", 404);

    // Kiểm tra đã có assignment type này chưa
    const existing = await Assignment.findOne({ visitId, type: assignmentType, status: { $ne: 'overridden' } });
    if (existing) {
      return errorResponse(res, `Lượt khám này đã có phân công ${assignmentType === 'read' ? 'đọc phim' : 'điều trị'}.`, 409);
    }

    // Lấy tham số từ Hospital
    const hospital = await Hospital.findById(hospitalId).lean();
    const readFilmDeadlineHours = hospital?.aiThresholds?.taskDeadlines?.readFilmHours || 4;

    // D.1 — Tìm bác sĩ phù hợp (Gộp Lâm sàng & CĐHA)
    let candidates = [];

    // Ưu tiên 1: Gộp quy trình — Tự động gán cho chính Bác sĩ khám lâm sàng phụ trách ca này
    if (visit.doctorId) {
      const visitDoctor = await User.findOne({
        _id: visit.doctorId,
        hospitalId,
        role: "doctor",
        isLocked: false,
      }).lean();
      if (visitDoctor) {
        candidates.push(visitDoctor);
      }
    }

    // Nếu chưa có hoặc cần tìm thêm bác sĩ trực
    if (!candidates.length) {
      const candidateQuery = {
        hospitalId,
        role: "doctor",
        isLocked: false,
        "profile.isOnCall": true,
      };

      candidates = await User.find(candidateQuery).lean();
    }

    if (!candidates.length) {
      // Fallback: lấy bất kỳ bác sĩ nào trong bệnh viện đang hoạt động
      const fallbackCandidates = await User.find({
        hospitalId,
        role: "doctor",
        isLocked: false,
      }).lean();

      if (!fallbackCandidates.length) {
        return errorResponse(res, "Không tìm được bác sĩ phù hợp trong viện. Vui lòng phân công thủ công (D.3).", 400);
      }
      candidates.push(...fallbackCandidates);
    }

    // Lọc bác sĩ còn slot (currentCaseload < maxCaseload)
    const availableDoctors = candidates.filter(d =>
      (d.profile?.currentCaseload || 0) < (d.profile?.maxCaseload || 10)
    );

    if (!availableDoctors.length) {
      return errorResponse(res, "Tất cả bác sĩ đang đầy ca. Vui lòng phân công thủ công (D.3).", 400);
    }

    // Chọn bác sĩ có caseload thấp nhất
    const selectedDoctor = availableDoctors.reduce((min, d) =>
      (d.profile?.currentCaseload || 0) < (min.profile?.currentCaseload || 0) ? d : min
    );

    // Tính deadline
    const deadlineAt = new Date(Date.now() + readFilmDeadlineHours * 60 * 60 * 1000);

    // Tạo Assignment
    const assignment = new Assignment({
      hospitalId,
      visitId,
      imagingResultId: imagingResultId || visit.mriOrder?.imagingResultId || null,
      doctorId: selectedDoctor._id,
      type: assignmentType,
      priority: visit.priority === 'khẩn cấp' ? 1 : 5,
      caseloadAtAssignment: selectedDoctor.profile?.currentCaseload || 0,
      deadlineAt,
    });
    await assignment.save();

    // Tăng caseload của bác sĩ
    await User.updateOne(
      { _id: selectedDoctor._id },
      { $inc: { "profile.currentCaseload": 1 } }
    );

    // Gửi thông báo bác sĩ (J.1)
    try {
      await createNotificationInternal({
        hospitalId,
        recipientId: selectedDoctor._id,
        senderId: req.user.id,
        type: "assignment_new",
        title: "📋 Phân công đọc phim mới",
        message: `Bạn được phân công ${assignmentType === 'read' ? 'đọc phim MRI' : 'điều trị'} cho lượt khám. Hạn chót: ${deadlineAt.toLocaleString('vi-VN')}.`,
        relatedId: assignment._id,
      });
    } catch (notifErr) {
      console.warn("⚠️ Không thể gửi thông báo phân công:", notifErr.message);
    }

    return successResponse(res, {
      assignment,
      doctor: {
        id: selectedDoctor._id,
        name: selectedDoctor.profile?.name || selectedDoctor.profile?.fullName,
        specialty: selectedDoctor.profile?.specialty,
      }
    }, `Đã phân công ${assignmentType === 'read' ? 'đọc phim' : 'điều trị'} cho bác sĩ ${selectedDoctor.profile?.name}.`, 201);
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── D.3 — Override thủ công (UC-HADM-04 Smart Override — trưởng khoa thay đổi phân công) ─
// @route PUT /api/v1/assignments/:id/override
// @access Private (Admin, Hospital_admin)
export const overrideAssignment = async (req, res) => {
  try {
    if (!["admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ trưởng khoa hoặc admin mới có quyền thay đổi phân công.", 403);
    }

    // Fix 0009: chặn ObjectId sai định dạng sớm — tránh 500 CastError lộ message Mongoose
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, "ID phân công không hợp lệ.", 400);
    }

    const assignment = await Assignment.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    });
    if (!assignment) return errorResponse(res, "Không tìm thấy phân công.", 404);

    // Chỉ được điều chuyển ca còn đang hoạt động — ca đã hoàn tất/đã bị điều chuyển
    // thì mọi can thiệp phải đi luồng nghiệp vụ khác (bổ sung, peer-review), tránh
    // ghi đè lịch sử phân công đã chốt.
    if (!["pending", "acknowledged", "in_progress"].includes(assignment.status)) {
      return errorResponse(res, `Chỉ được điều chuyển ca đang hoạt động. Phân công này đang ở trạng thái "${assignment.status}".`, 400);
    }

    const { newDoctorId, reason } = req.body;
    if (!newDoctorId) return errorResponse(res, "Thiếu ID bác sĩ mới.", 400);
    if (!isValidObjectId(newDoctorId)) {
      return errorResponse(res, "ID bác sĩ mới không hợp lệ.", 400);
    }

    // UC-HADM-04: ghi log bắt buộc lý do điều chuyển — không lý do, không can thiệp
    const trimmedReason = (reason || "").trim();
    if (!trimmedReason) {
      return errorResponse(res, "Lý do điều chuyển là bắt buộc để ghi nhật ký kiểm toán.", 400);
    }
    if (trimmedReason.length < 10) {
      return errorResponse(res, "Lý do điều chuyển cần cụ thể (tối thiểu 10 ký tự).", 400);
    }

    const newDoctor = await User.findOne({ _id: newDoctorId, hospitalId: req.user.hospitalId, role: "doctor" });
    if (!newDoctor) return errorResponse(res, "Không tìm thấy bác sĩ mới.", 404);
    if (String(newDoctor._id) === String(assignment.doctorId)) {
      return errorResponse(res, "Bác sĩ mới trùng với bác sĩ đang phụ trách ca này.", 400);
    }

    // Ghi nhận override
    const prevDoctorId = assignment.doctorId;
    assignment.previousDoctorId = prevDoctorId;
    assignment.doctorId = newDoctorId;
    assignment.isOverridden = true;
    assignment.overriddenBy = req.user.id;
    assignment.overrideReason = trimmedReason;
    assignment.overriddenAt = new Date();
    assignment.status = 'pending'; // Reset cho bác sĩ mới
    assignment.acknowledgedAt = null;
    await assignment.save();

    // Cập nhật caseload
    await User.updateOne({ _id: prevDoctorId }, { $inc: { "profile.currentCaseload": -1 } });
    await User.updateOne({ _id: newDoctorId }, { $inc: { "profile.currentCaseload": 1 } });

    // UC-HADM-13 — ghi vết kiểm toán cho thao tác nhạy cảm (hash-chain)
    try {
      const { recordAuditLog, AUDIT_ACTIONS } = await import("../services/auditLog.service.js");
      const [prevDoctor, assignedDoctor] = await Promise.all([
        User.findById(prevDoctorId).select("profile.name profile.fullName email").lean(),
        User.findById(newDoctorId).select("profile.name profile.fullName email").lean(),
      ]);
      await recordAuditLog({
        action: AUDIT_ACTIONS.ASSIGNMENT_OVERRIDDEN,
        entity: "Assignment",
        entityId: assignment._id.toString(),
        performedBy: req.user.id,
        hospitalId: req.user.hospitalId,
        details: `Điều chuyển ${assignment.type === 'read' ? 'ca đọc phim' : 'ca điều trị'} từ BS ${prevDoctor?.profile?.name || prevDoctor?.profile?.fullName || prevDoctor?.email || prevDoctorId} sang BS ${assignedDoctor?.profile?.name || assignedDoctor?.profile?.fullName || assignedDoctor?.email || newDoctorId}. Lý do: ${trimmedReason}`,
      });
    } catch (auditErr) {
      console.warn("Lỗi ghi audit log khi điều chuyển phân công:", auditErr.message);
    }

    // Thông báo bác sĩ cũ và mới
    try {
      await createNotificationInternal({
        hospitalId: req.user.hospitalId,
        recipientId: newDoctorId,
        senderId: req.user.id,
        type: "assignment_override",
        title: "📋 Phân công mới (chuyển giao)",
        message: `Bạn được chuyển giao ca đọc phim từ bác sĩ khác. Lý do: ${reason || 'Không có lý do'}.`,
        relatedId: assignment._id,
      });
    } catch (notifErr) {
      console.warn("⚠️ Không thể gửi thông báo override:", notifErr.message);
    }

    return successResponse(res, { assignment }, "Đã thay đổi bác sĩ phụ trách thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── D.4 — Dashboard caseload bác sĩ ─────────────────────────────────────────
// @route GET /api/v1/assignments/caseload-dashboard
// @access Private (Admin, Hospital_admin)
export const getCaseloadDashboard = async (req, res) => {
  try {
    if (!["admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ admin mới xem được dashboard caseload.", 403);
    }

    const hospitalId = req.user.hospitalId;

    // Lấy tất cả bác sĩ trong bệnh viện
    const doctors = await User.find({
      hospitalId,
      role: "doctor",
      isLocked: false
    }, "profile email").lean();

    // Đếm số assignment đang chạy cho từng bác sĩ
    const caseloadData = await Promise.all(doctors.map(async (doctor) => {
      const activeCases = await Assignment.countDocuments({
        doctorId: doctor._id,
        status: { $in: ['pending', 'acknowledged', 'in_progress'] }
      });
      const overdueCases = await Assignment.countDocuments({
        doctorId: doctor._id,
        status: { $in: ['pending', 'acknowledged'] },
        deadlineAt: { $lt: new Date() }
      });

      return {
        doctorId: doctor._id,
        name: doctor.profile?.name || doctor.profile?.fullName,
        email: doctor.email,
        specialty: doctor.profile?.specialty,
        isOnCall: doctor.profile?.isOnCall,
        maxCaseload: doctor.profile?.maxCaseload || 10,
        currentCaseload: activeCases,
        overdueCases,
        loadPercentage: Math.round((activeCases / (doctor.profile?.maxCaseload || 10)) * 100),
      };
    }));

    return successResponse(res, caseloadData, "Lấy dashboard caseload thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── Bác sĩ xác nhận nhận task ────────────────────────────────────────────────
// @route PUT /api/v1/assignments/:id/acknowledge
// @access Private (Doctor)
export const acknowledgeAssignment = async (req, res) => {
  try {
    // Fix 0009: chặn ObjectId sai định dạng sớm — tránh 500 CastError lộ message Mongoose
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, "ID phân công không hợp lệ.", 400);
    }

    const assignment = await Assignment.findOne({
      _id: req.params.id,
      doctorId: req.user.id,
      hospitalId: req.user.hospitalId,
    });
    if (!assignment) return errorResponse(res, "Không tìm thấy phân công hoặc bạn không có quyền.", 404);

    if (assignment.status !== 'pending') {
      return errorResponse(res, "Phân công này đã được xác nhận trước đó.", 400);
    }

    assignment.status = 'acknowledged';
    assignment.acknowledgedAt = new Date();
    await assignment.save();

    return successResponse(res, { assignment }, "Đã xác nhận nhận task.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── Lấy danh sách assignments của bác sĩ đang đăng nhập ───────────────────
// @route GET /api/v1/assignments/my
// @access Private (Doctor)
export const getMyAssignments = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { doctorId: req.user.id, hospitalId: req.user.hospitalId };
    if (status) filter.status = status;

    const assignments = await Assignment.find(filter)
      .populate("visitId", "patientId status priority")
      .populate("imagingResultId", "procedure diagnosis aiReport representativeSliceUrl")
      .sort({ priority: 1, deadlineAt: 1, createdAt: -1 });

    return successResponse(res, assignments, "Lấy danh sách ca được phân công thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── Lấy tất cả assignments của bệnh viện (admin) ─────────────────────────────
// @route GET /api/v1/assignments
// @access Private (Admin)
export const getAllAssignments = async (req, res) => {
  try {
    if (!["admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ admin xem được tất cả phân công.", 403);
    }
    const { status, doctorId, limit = 20, page = 1, overridden } = req.query;
    // Fix 0009: chặn ObjectId sai định dạng sớm — tránh 500 CastError lộ message Mongoose
    if (doctorId && !isValidObjectId(doctorId)) {
      return errorResponse(res, "doctorId không hợp lệ.", 400);
    }
    const filter = { hospitalId: req.user.hospitalId };
    // Hỗ trợ lọc nhiều trạng thái cùng lúc: ?status=pending,acknowledged,in_progress
    if (status) filter.status = status.includes(",") ? { $in: status.split(",").map((s) => s.trim()) } : status;
    if (doctorId) filter.doctorId = doctorId;
    // UC-HADM-04 — tab "Đã chuyển ca": override ghi in-place (status reset pending,
    // isOverridden=true) nên lọc theo cờ isOverridden thay vì status enum.
    if (overridden === "true") filter.isOverridden = true;

    const total = await Assignment.countDocuments(filter);
    const assignments = await Assignment.find(filter)
      .populate("doctorId", "profile.name profile.fullName profile.specialty")
      .populate("previousDoctorId", "profile.name profile.fullName")
      .populate("overriddenBy", "profile.name profile.fullName")
      .populate({
        path: "visitId",
        select: "patientId status priority",
        populate: { path: "patientId", select: "profile.name" },
      })
      .sort({ priority: 1, createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    return successResponse(res, { assignments, total }, "Lấy danh sách phân công thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};
