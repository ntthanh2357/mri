/**
 * NeuroScan AI - Admin Analytics & Reporting Domain Service
 * Đóng gói toàn bộ logic truy vấn thống kê, doanh thu, dược phẩm và ca chụp MRI cho admin.
 */

import { Visit } from "../models/visit.model.js";
import { Invoice } from "../models/invoice.model.js";
import { Hospital } from "../models/hospital.model.js";
import { User } from "../models/user.model.js";
import { RevenueReport } from "../models/revenueReport.model.js";
import { DrugReport } from "../models/drugReport.model.js";

/**
 * Lấy số liệu tổng quan hệ thống (Dashboard KPI)
 */
export const getAdminDashboardStatsService = async (hospitalId = null) => {
  const filter = hospitalId ? { hospitalId } : {};

  const [totalVisits, totalPatients, totalInvoices, totalRevenueAgg] = await Promise.all([
    Visit.countDocuments(filter),
    User.countDocuments({ role: "patient", ...(hospitalId ? { hospitalId } : {}) }),
    Invoice.countDocuments({ ...filter, status: "PAID" }),
    Invoice.aggregate([
      { $match: { ...filter, status: "PAID" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
  ]);

  const totalRevenue = totalRevenueAgg[0]?.total || 0;

  return {
    totalVisits,
    totalPatients,
    totalPaidInvoices: totalInvoices,
    totalRevenue,
    calculatedAt: new Date(),
  };
};

/**
 * Thống kê các ca chụp MRI theo phân loại u não
 */
export const getMriClassificationStatsService = async (hospitalId = null) => {
  const matchStage = hospitalId ? { hospitalId } : {};

  const stats = await Visit.aggregate([
    { $match: { ...matchStage, "mriOrder.imagingResultId": { $ne: null } } },
    {
      $group: {
        _id: "$mriOrder.region",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return stats;
};

/**
 * Lấy lịch sử báo cáo doanh thu
 */
export const getRevenueReportsService = async (hospitalId = null, limit = 12) => {
  const filter = hospitalId ? { hospitalId } : {};
  return await RevenueReport.find(filter).sort({ month: -1, year: -1 }).limit(limit).lean();
};

/**
 * Lấy báo cáo tồn kho & tiêu thụ dược phẩm
 */
export const getDrugReportsService = async (hospitalId = null, limit = 10) => {
  const filter = hospitalId ? { hospitalId } : {};
  return await DrugReport.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
};

export default {
  getAdminDashboardStatsService,
  getMriClassificationStatsService,
  getRevenueReportsService,
  getDrugReportsService,
};
