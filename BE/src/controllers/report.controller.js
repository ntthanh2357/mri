import { Invoice } from "../models/invoice.model.js";
import { AiJob } from "../models/aiJob.model.js";
import { ImagingResult } from "../models/imagingResult.model.js";
import { Visit } from "../models/visit.model.js";
import { MriSlot } from "../models/mriSlot.model.js";
import { Assignment } from "../models/assignment.model.js";
import { Task } from "../models/task.model.js";
import { successResponse, errorResponse } from "../utils/response.util.js";

// ─── W.5 — Báo cáo Năng suất & Thời gian Chờ Khám (SLA) — UC-HADM-12 ────────
// @route GET /api/v1/reports/sla?days=30
// @access Private (Hospital_admin, Admin)
// Thống kê thời gian chờ trung bình của bệnh nhân qua từng khâu của hành
// trình khám (Tiếp đón → Khám & Chỉ định → Chụp MRI & AI → Đọc phim & Ký
// duyệt → Thanh toán) và tỷ lệ ca hoàn thành đúng hạn (SLA).
// Nguồn dữ liệu: Task Kanban 8 bước (tạo tự động theo visit) — mỗi task ghi
// createdAt (lúc bước mở ra), startedAt (nhân sự bắt tay làm), completedAt
// (chốt bước) và deadlineAt (hạn SLA từng bước).
const SLA_STAGE_MAP = [
  { key: "tiep_don", label: "Tiếp đón & Xác thực BHYT", stepNumbers: [1] },
  { key: "kham", label: "Khám lâm sàng & Chỉ định MRI", stepNumbers: [2, 3] },
  { key: "chup_mri", label: "Chụp MRI & Xử lý AI", stepNumbers: [4, 5] },
  { key: "doc_phim", label: "Đọc phim & Ký duyệt hồ sơ", stepNumbers: [6, 7] },
  { key: "thanh_toan", label: "Thanh toán viện phí", stepNumbers: [8] },
];

export const getSlaReport = async (req, res) => {
  try {
    if (!["admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ Quản trị viên bệnh viện mới xem được báo cáo năng suất & SLA.", 403);
    }
    const hospitalId = req.user.hospitalId;

    // Super Admin (admin/system_admin) chưa gán bệnh viện → tổng hợp toàn hệ
    // thống thay vì lọc hospitalId: null (sẽ âm thầm trả 0 bản ghi như các
    // report cũ). Hospital Admin luôn có hospitalId nên luồng chuẩn không đổi.
    const scopeFilter = hospitalId ? { hospitalId } : {};

    let days = parseInt(req.query.days, 10);
    if (!Number.isFinite(days) || days < 1) days = 30;
    if (days > 365) days = 365;
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

    const tasks = await Task.find({
      ...scopeFilter,
      createdAt: { $gte: from, $lte: to },
    })
      .select("visitId stepNumber status startedAt completedAt deadlineAt createdAt")
      .lean();

    // ── 1. Thời gian qua từng khâu (map 8 bước Kanban → 5 khâu nghiệp vụ) ──
    const stageStats = SLA_STAGE_MAP.map((stage) => {
      const stageTasks = tasks.filter((t) => stage.stepNumbers.includes(t.stepNumber));
      const completed = stageTasks.filter((t) => t.status === "completed" && t.completedAt);
      const inProgress = stageTasks.filter((t) => t.status === "in_progress");

      const waitMinutes = completed.map((t) =>
        Math.max(0, (new Date(t.completedAt) - new Date(t.createdAt)) / 60000)
      );
      const activeMinutes = completed
        .filter((t) => t.startedAt)
        .map((t) => Math.max(0, (new Date(t.completedAt) - new Date(t.startedAt)) / 60000));
      const withDeadline = completed.filter((t) => t.deadlineAt);
      const slaMet = withDeadline.filter((t) => new Date(t.completedAt) <= new Date(t.deadlineAt));

      return {
        key: stage.key,
        label: stage.label,
        stepNumbers: stage.stepNumbers,
        completedCount: completed.length,
        inProgressCount: inProgress.length,
        avgWaitMinutes: waitMinutes.length
          ? Math.round(waitMinutes.reduce((s, v) => s + v, 0) / waitMinutes.length)
          : null,
        avgActiveMinutes: activeMinutes.length
          ? Math.round(activeMinutes.reduce((s, v) => s + v, 0) / activeMinutes.length)
          : null,
        longestWaitMinutes: waitMinutes.length ? Math.round(Math.max(...waitMinutes)) : null,
        slaMetCount: slaMet.length,
        slaTotalWithDeadline: withDeadline.length,
        slaRatePercentage: withDeadline.length
          ? Math.round((slaMet.length / withDeadline.length) * 100)
          : null,
      };
    });

    // ── 2. Hành trình end-to-end theo visit (toàn bộ 8 bước) ──────────────
    const byVisit = new Map();
    for (const t of tasks) {
      const vid = String(t.visitId);
      if (!byVisit.has(vid)) byVisit.set(vid, []);
      byVisit.get(vid).push(t);
    }

    let completedVisits = 0;
    let inProgressVisits = 0;
    let onTimeCompletedVisits = 0;
    const endToEndMinutes = [];
    for (const visitTasks of byVisit.values()) {
      const completedTasks = visitTasks.filter((t) => t.status === "completed" && t.completedAt);
      const isCompleted = visitTasks.length >= 8 && completedTasks.length === visitTasks.length;
      const anyActive = visitTasks.some((t) => ["pending", "in_progress"].includes(t.status));

      if (isCompleted) {
        completedVisits++;
        const first = Math.min(...visitTasks.map((t) => new Date(t.createdAt).getTime()));
        const last = Math.max(...completedTasks.map((t) => new Date(t.completedAt).getTime()));
        endToEndMinutes.push(Math.max(0, (last - first) / 60000));
        const late = completedTasks.some(
          (t) => t.deadlineAt && new Date(t.completedAt) > new Date(t.deadlineAt)
        );
        if (!late) onTimeCompletedVisits++;
      } else if (anyActive) {
        inProgressVisits++;
      }
    }

    const measuredStages = stageStats.filter((s) => s.avgWaitMinutes != null);
    const slowestStage =
      measuredStages.length > 0
        ? measuredStages.reduce((a, b) => (b.avgWaitMinutes > a.avgWaitMinutes ? b : a))
        : null;

    return successResponse(res, {
      timeframe: { from, to, days },
      totalTasksAnalyzed: tasks.length,
      stages: stageStats,
      journeys: {
        totalVisits: byVisit.size,
        completedVisits,
        inProgressVisits,
        onTimeCompletedVisits,
        slaRatePercentage: completedVisits > 0
          ? Math.round((onTimeCompletedVisits / completedVisits) * 100)
          : null,
        avgEndToEndMinutes: endToEndMinutes.length
          ? Math.round(endToEndMinutes.reduce((s, v) => s + v, 0) / endToEndMinutes.length)
          : null,
        slowestStage: slowestStage
          ? { key: slowestStage.key, label: slowestStage.label, avgWaitMinutes: slowestStage.avgWaitMinutes }
          : null,
      },
    }, "Lấy báo cáo năng suất & SLA thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── W.1 — Báo cáo doanh thu theo ngày/tuần/tháng ───────────────────────────
// @route GET /api/v1/reports/revenue
// @access Private (Hospital_admin, Admin)
export const getRevenueReport = async (req, res) => {
  try {
    if (!["admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ admin mới xem được báo cáo doanh thu.", 403);
    }
    const hospitalId = req.user.hospitalId;
    const { from, to, groupBy = 'day' } = req.query;

    const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = to ? new Date(to) : new Date();

    const invoices = await Invoice.find({
      hospitalId,
      status: "đã thanh toán",
      paidAt: { $gte: startDate, $lte: endDate }
    }).lean();

    // Thống kê doanh thu theo loại dịch vụ
    let totalRevenue = 0;
    let examRevenue = 0;
    let mriRevenue = 0;
    let aiRevenue = 0;
    let drugRevenue = 0;
    const paymentMethods = { cash: 0, transfer: 0, payos: 0 };

    invoices.forEach(inv => {
      totalRevenue += inv.totalAmount || 0;
      if (inv.paymentMethod === 'tiền mặt') paymentMethods.cash += inv.totalAmount;
      else paymentMethods.transfer += inv.totalAmount;

      (inv.items || []).forEach(item => {
        if (item.type === 'exam') examRevenue += item.amount;
        if (item.type === 'mri') mriRevenue += item.amount;
        if (item.type === 'ai') aiRevenue += item.amount;
        if (item.type === 'drug') drugRevenue += item.amount;
      });
    });

    return successResponse(res, {
      timeframe: { from: startDate, to: endDate },
      totalInvoicesCount: invoices.length,
      totalRevenue,
      breakdownByService: { examRevenue, mriRevenue, aiRevenue, drugRevenue },
      breakdownByPaymentMethod: paymentMethods,
    }, "Lấy báo cáo doanh thu thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── W.2 — Báo cáo hoạt động & hiệu suất AI ─────────────────────────────────
// @route GET /api/v1/reports/ai-performance
// @access Private (Hospital_admin, Admin)
export const getAiPerformanceReport = async (req, res) => {
  try {
    if (!["admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ admin xem được báo cáo AI.", 403);
    }
    const hospitalId = req.user.hospitalId;

    const [totalJobs, completedJobs, failedJobs] = await Promise.all([
      AiJob.countDocuments({ hospitalId }),
      AiJob.countDocuments({ hospitalId, status: 'completed' }),
      AiJob.countDocuments({ hospitalId, status: 'failed' }),
    ]);

    // 0012: không ép thành công 100% khi chưa có job nào — trả null để FE hiển thị "—"
    const successRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : null;

    // 0012: bỏ giá trị hardcode 145s — tính trung bình thật từ startedAt→completedAt
    // của các AiJob đã hoàn tất (null khi chưa có job đo được, FE hiển thị "—")
    const completedJobDocs = await AiJob.find({ hospitalId, status: 'completed' })
      .select("startedAt completedAt")
      .lean();
    const durationsSec = completedJobDocs
      .filter((j) => j.startedAt && j.completedAt)
      .map((j) => Math.max(0, (new Date(j.completedAt) - new Date(j.startedAt)) / 1000));
    const averageProcessingTimeSeconds = durationsSec.length
      ? Math.round(durationsSec.reduce((s, v) => s + v, 0) / durationsSec.length)
      : null;

    // Lấy các kết quả AI đã có
    const imagingResults = await ImagingResult.find({
      hospitalId,
      aiReport: { $ne: null }
    }).select("aiReport procedure").lean();

    // Thống kê phân bố u phát hiện
    const tumorTypesCount = { glioma: 0, meningioma: 0, pituitary: 0, no_tumor: 0 };
    imagingResults.forEach(res => {
      const type = res.aiReport?.tumorType?.toLowerCase();
      if (type?.includes('glioma')) tumorTypesCount.glioma++;
      else if (type?.includes('meningioma')) tumorTypesCount.meningioma++;
      else if (type?.includes('pituitary')) tumorTypesCount.pituitary++;
      else tumorTypesCount.no_tumor++;
    });

    return successResponse(res, {
      totalJobsProcessed: totalJobs,
      completedJobs,
      failedJobs,
      successRatePercentage: successRate,
      averageProcessingTimeSeconds,
      tumorDistribution: tumorTypesCount,
    }, "Lấy báo cáo hoạt động AI thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── W.3 — Báo cáo vận hành khoa & phòng MRI ─────────────────────────────────
// @route GET /api/v1/reports/department-operation
// @access Private (Hospital_admin, Admin)
export const getDepartmentOperationReport = async (req, res) => {
  try {
    if (!["admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ admin xem được báo cáo vận hành.", 403);
    }
    const hospitalId = req.user.hospitalId;

    const [totalSlots, completedSlots, totalAssignments, overdueAssignments] = await Promise.all([
      MriSlot.countDocuments({ hospitalId }),
      MriSlot.countDocuments({ hospitalId, status: 'completed' }),
      Assignment.countDocuments({ hospitalId }),
      Assignment.countDocuments({ hospitalId, isOverdue: true }),
    ]);

    return successResponse(res, {
      mriSlotMetrics: {
        totalSlotsScheduled: totalSlots,
        completedSlots,
        utilizationRate: totalSlots > 0 ? Math.round((completedSlots / totalSlots) * 100) : 0,
      },
      assignmentMetrics: {
        totalAssignments,
        overdueAssignments,
        onTimeRate: totalAssignments > 0 ? Math.round(((totalAssignments - overdueAssignments) / totalAssignments) * 100) : 100,
      }
    }, "Lấy báo cáo vận hành khoa thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── W.4 — Dashboard thống kê lâm sàng tổng hợp ─────────────────────────────
// @route GET /api/v1/reports/clinical-analytics
// @access Private (Hospital_admin, Doctor, Admin)
export const getClinicalAnalyticsDashboard = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;

    const imagingResults = await ImagingResult.find({ hospitalId }).lean();

    let totalCases = imagingResults.length;
    let highMalignancyCount = 0;
    let midlineShiftCasesCount = 0;

    const regionDistribution = { frontal: 0, temporal: 0, parietal: 0, occipital: 0, cerebellum: 0, brainstem: 0, other: 0 };

    imagingResults.forEach(r => {
      if (r.aiReport?.malignancyScore > 0.7 || r.aiReport?.malignancyLevel === 'high') {
        highMalignancyCount++;
      }
      if (r.aiReport?.midlineShiftMm > 5) {
        midlineShiftCasesCount++;
      }

      const region = (r.aiReport?.brainRegion || "").toLowerCase();
      if (region.includes('frontal')) regionDistribution.frontal++;
      else if (region.includes('temporal')) regionDistribution.temporal++;
      else if (region.includes('parietal')) regionDistribution.parietal++;
      else if (region.includes('occipital')) regionDistribution.occipital++;
      else if (region.includes('cerebell')) regionDistribution.cerebellum++;
      else if (region.includes('stem')) regionDistribution.brainstem++;
      else regionDistribution.other++;
    });

    return successResponse(res, {
      totalAnalyzedCases: totalCases,
      highMalignancyCount,
      highMalignancyRatePercentage: totalCases > 0 ? Math.round((highMalignancyCount / totalCases) * 100) : 0,
      midlineShiftCasesCount,
      brainRegionDistribution: regionDistribution,
    }, "Lấy dashboard thống kê lâm sàng thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};
