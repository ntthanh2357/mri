import { PeerReview } from "../models/peerReview.model.js";
import { ImagingResult } from "../models/imagingResult.model.js";
import { Visit } from "../models/visit.model.js";
import { Hospital } from "../models/hospital.model.js";
import { User } from "../models/user.model.js";
import { createNotificationInternal } from "./notification.controller.js";
import { successResponse, errorResponse } from "../utils/response.util.js";
import { getDayRangeVN } from "../utils/date.util.js";

// ─── P.1 — Gắn cờ ca cần bình duyệt lần 2 ────────────────────────────────────
// @route POST /api/v1/peer-reviews
// @access Private (Doctor, Admin)
export const flagForPeerReview = async (req, res) => {
  try {
    if (!["doctor", "admin", "system_admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Không có quyền yêu cầu bình duyệt.", 403);
    }

    const hospitalId = req.user.hospitalId;
    const { imagingResultId, visitId, requestType = 'manual', conflictReason } = req.body;

    if (!imagingResultId) return errorResponse(res, "Thiếu ID kết quả hình ảnh.", 400);
    if (!['conflict', 'manual'].includes(requestType)) {
      return errorResponse(res, "requestType phải là 'conflict' hoặc 'manual'.", 400);
    }

    // Kiểm tra đã có peer review pending chưa
    const existing = await PeerReview.findOne({
      imagingResultId,
      status: { $in: ['pending', 'in_review'] }
    });
    if (existing) {
      return errorResponse(res, "Kết quả này đã có yêu cầu bình duyệt đang xử lý.", 409);
    }

    const imagingResult = await ImagingResult.findOne({ _id: imagingResultId, hospitalId });
    if (!imagingResult) return errorResponse(res, "Không tìm thấy kết quả hình ảnh.", 404);

    // Tìm bác sĩ thứ 2 (khác người đọc lần đầu)
    // Lấy assignment để biết ai đã đọc
    const { Assignment } = await import("../models/assignment.model.js");
    const firstReaderAssignment = await Assignment.findOne({
      imagingResultId,
      type: 'read',
      status: { $in: ['acknowledged', 'in_progress', 'completed'] }
    });
    const firstReaderId = firstReaderAssignment?.doctorId?.toString() || req.user.id;

    // Chọn reviewer thứ 2 — bác sĩ cùng specialty, khác người đọc đầu
    const reviewer2 = await User.findOne({
      hospitalId,
      role: 'doctor',
      _id: { $ne: firstReaderId },
      "profile.specialty": { $in: ['neuroradiologist', 'radiologist'] },
      isLocked: false,
    }).lean();

    const reviewerIds = reviewer2 ? [reviewer2._id] : [];

    const peerReview = new PeerReview({
      hospitalId,
      imagingResultId,
      visitId: visitId || imagingResult.visitId || null,
      requestType,
      conflictReason: conflictReason || "",
      reviewerIds,
      status: reviewerIds.length ? 'in_review' : 'pending',
      createdBy: req.user.id,
    });
    await peerReview.save();

    // Thông báo cho reviewer
    if (reviewer2) {
      try {
        await createNotificationInternal({
          hospitalId,
          recipientId: reviewer2._id,
          senderId: req.user.id,
          type: "peer_review_assigned",
          title: "🔍 Yêu cầu bình duyệt lần 2",
          message: `Bạn được yêu cầu bình duyệt độc lập kết quả đọc phim MRI. Lý do: ${conflictReason || 'Kiểm soát chất lượng'}.`,
          relatedId: peerReview._id,
        });
      } catch (notifErr) {
        console.warn("⚠️ Không thể gửi thông báo peer review:", notifErr.message);
      }
    }

    return successResponse(res, {
      peerReview,
      reviewer: reviewer2 ? { id: reviewer2._id, name: reviewer2.profile?.name } : null,
      warning: !reviewer2 ? "Không tìm được bác sĩ để bình duyệt. Admin cần phân công thủ công." : null,
    }, "Đã tạo yêu cầu bình duyệt lần 2.", 201);
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── P.3 — Nộp kết quả bình duyệt ────────────────────────────────────────────
// @route POST /api/v1/peer-reviews/:id/submit-reading
// @access Private (Doctor)
export const submitReview = async (req, res) => {
  try {
    if (req.user.role !== 'doctor') {
      return errorResponse(res, "Chỉ bác sĩ mới có thể nộp kết quả bình duyệt.", 403);
    }

    const peerReview = await PeerReview.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    });
    if (!peerReview) return errorResponse(res, "Không tìm thấy yêu cầu bình duyệt.", 404);

    if (peerReview.status === 'completed' || peerReview.status === 'cancelled') {
      return errorResponse(res, "Yêu cầu bình duyệt này đã đóng.", 400);
    }

    // Kiểm tra reviewer có quyền nộp không
    const isAssignedReviewer = peerReview.reviewerIds.some(
      id => id.toString() === req.user.id.toString()
    );
    if (!isAssignedReviewer) {
      return errorResponse(res, "Bạn không được phân công bình duyệt ca này.", 403);
    }

    // Kiểm tra đã nộp chưa
    const alreadySubmitted = peerReview.readings.some(
      r => r.reviewerId.toString() === req.user.id.toString()
    );
    if (alreadySubmitted) {
      return errorResponse(res, "Bạn đã nộp kết quả bình duyệt cho ca này rồi.", 400);
    }

    const { conclusion, findings, malignancyLevel, agreeWithAi } = req.body;
    if (!conclusion) return errorResponse(res, "Thiếu kết luận.", 400);

    // Kiểm tra mâu thuẫn với reading trước (nếu có)
    let isConflicting = false;
    if (peerReview.readings.length > 0) {
      const prevReading = peerReview.readings[peerReview.readings.length - 1];
      if (prevReading.malignancyLevel && malignancyLevel &&
          prevReading.malignancyLevel !== malignancyLevel) {
        isConflicting = true;
      }
    }

    peerReview.readings.push({
      reviewerId: req.user.id,
      conclusion,
      findings: findings || "",
      malignancyLevel: malignancyLevel || 'not_applicable',
      agreeWithAi: agreeWithAi !== undefined ? Boolean(agreeWithAi) : null,
      submittedAt: new Date(),
      isConflicting,
    });

    // Nếu đủ 2 readings → chờ kết luận cuối (awaiting_final)
    if (peerReview.readings.length >= peerReview.reviewerIds.length) {
      peerReview.status = 'awaiting_final';
    }

    await peerReview.save();

    return successResponse(res, { peerReview, isConflicting }, "Đã nộp kết quả bình duyệt.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── P.3 — Kết luận cuối (trưởng khoa quyết định) ────────────────────────────
// @route PUT /api/v1/peer-reviews/:id/finalize
// @access Private (Admin, Hospital_admin, Doctor with head_of_dept)
export const finalizePeerReview = async (req, res) => {
  try {
    if (!["admin", "hospital_admin", "doctor"].includes(req.user.role)) {
      return errorResponse(res, "Không có quyền kết luận bình duyệt.", 403);
    }

    const peerReview = await PeerReview.findOne({
      _id: req.params.id,
      hospitalId: req.user.hospitalId
    });
    if (!peerReview) return errorResponse(res, "Không tìm thấy yêu cầu bình duyệt.", 404);
    if (peerReview.status === 'completed') return errorResponse(res, "Đã có kết luận cuối.", 400);

    const { finalConclusion } = req.body;
    if (!finalConclusion) return errorResponse(res, "Thiếu kết luận cuối.", 400);

    peerReview.finalConclusion = finalConclusion;
    peerReview.finalBy = req.user.id;
    peerReview.finalAt = new Date();
    peerReview.status = 'completed';
    await peerReview.save();

    return successResponse(res, { peerReview }, "Đã lưu kết luận cuối của bình duyệt lần 2.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── P.2 — Lấy mẫu ngẫu nhiên để QA định kỳ ─────────────────────────────────
// @route POST /api/v1/peer-reviews/random-qa-sampling
// @access Private (Admin, Hospital_admin)
export const runRandomQaSampling = async (req, res) => {
  try {
    if (!["admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ admin mới có thể chạy QA sampling.", 403);
    }

    const hospitalId = req.user.hospitalId;

    // Lấy tỷ lệ từ Hospital config
    const hospital = await Hospital.findById(hospitalId).lean();
    const qaRate = hospital?.aiThresholds?.qaRate || 5; // Mặc định 5%

    // Lấy tuần hiện tại
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
    const { startOfDay: weekStart } = getDayRangeVN(monday);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const weekKey = `${now.getFullYear()}-W${Math.ceil((weekStart.getDate() + 6 - weekStart.getDay()) / 7).toString().padStart(2, '0')}`;

    // Kiểm tra đã chạy tuần này chưa
    const existingCount = await PeerReview.countDocuments({
      hospitalId,
      samplingWeek: weekKey,
      requestType: 'random_qa',
    });
    if (existingCount > 0) {
      return errorResponse(res, `QA sampling tuần ${weekKey} đã được chạy rồi (${existingCount} ca).`, 409);
    }

    // Lấy các ImagingResult đã ký duyệt trong tuần
    const signedResults = await ImagingResult.find({
      hospitalId,
      isSigned: true,
      signedAt: { $gte: weekStart, $lt: weekEnd },
    }).lean();

    if (!signedResults.length) {
      return successResponse(res, { sampled: 0, weekKey }, "Không có ca nào đã ký duyệt trong tuần để lấy mẫu.");
    }

    // Chọn ngẫu nhiên qaRate% số ca
    const sampleSize = Math.max(1, Math.ceil(signedResults.length * qaRate / 100));
    const shuffled = signedResults.sort(() => Math.random() - 0.5);
    const sampled = shuffled.slice(0, sampleSize);

    const reviews = [];
    for (const result of sampled) {
      const review = new PeerReview({
        hospitalId,
        imagingResultId: result._id,
        requestType: 'random_qa',
        samplingWeek: weekKey,
        status: 'pending',
        createdBy: req.user.id,
      });
      await review.save();
      reviews.push(review);
    }

    return successResponse(res, {
      sampled: reviews.length,
      weekKey,
      totalSignedCases: signedResults.length,
      qaRate,
      reviews,
    }, `Đã lấy mẫu ${reviews.length}/${signedResults.length} ca để QA (${qaRate}%).`, 201);
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── Lấy danh sách Peer Reviews ──────────────────────────────────────────────
// @route GET /api/v1/peer-reviews
// @access Private
export const getPeerReviews = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    const { status, requestType, limit = 20, page = 1 } = req.query;
    const filter = { hospitalId };
    if (status) filter.status = status;
    if (requestType) filter.requestType = requestType;

    // Bác sĩ chỉ xem review được phân công cho mình
    if (req.user.role === 'doctor') {
      filter.reviewerIds = req.user.id;
    }

    const total = await PeerReview.countDocuments(filter);
    const reviews = await PeerReview.find(filter)
      .populate("imagingResultId", "patientName procedure diagnosis aiReport representativeSliceUrl isSigned")
      .populate("createdBy", "profile.name")
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    return successResponse(res, { reviews, total }, "Lấy danh sách peer reviews thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};
