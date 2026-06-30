import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { AuditLog } from "../models/auditLog.model.js";
import { Dataset } from "../models/dataset.model.js";
import { Visit } from "../models/visit.model.js";
import { Invoice } from "../models/invoice.model.js";

export const getAllUsers = async () => {
  return User.find({}, "-passwordHash").lean();
};

export const toggleUserLock = async (userId, isLocked, adminId) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { isLocked },
    { new: true }
  ).select("-passwordHash");

  if (user) {
    await AuditLog.create({
      action: isLocked ? "lock-user" : "unlock-user",
      entity: "User",
      entityId: userId,
      performedBy: adminId,
      hospitalId: user.hospitalId || null,
      details: `User ${user.email} ${isLocked ? "bị khóa" : "đã mở khóa"} bởi admin`,
    });
  }

  return user;
};

export const lockUserById = async (id, adminId) => {
  const user = await User.findById(id).select("isLocked email hospitalId").lean();

  if (!user) {
    throw new Error("User not found");
  }

  if (user.isLocked) {
    return User.findById(id)
      .select("-passwordHash -otpCode -otpExpires -tokenVersion")
      .lean();
  }

  const updatedUser = await User.findByIdAndUpdate(
    id,
    { isLocked: true },
    { new: true }
  )
    .select("-passwordHash -otpCode -otpExpires -tokenVersion")
    .lean();

  await AuditLog.create({
    action: "lock-user",
    entity: "User",
    entityId: id,
    performedBy: adminId,
    hospitalId: user.hospitalId || null,
    details: `User ${user.email} locked by admin`,
  });

  return updatedUser;
};

export const verifyAdminById = async (id, verified, adminId) => {
  const existing = await User.findById(id).select("role email isVerified hospitalId").lean();

  if (!existing || !["admin", "hospital_admin", "doctor"].includes(existing.role)) {
    throw new Error("Admin not found");
  }

  const updated = await User.findByIdAndUpdate(
    id,
    { isVerified: verified },
    { new: true }
  )
    .select("-passwordHash -otpCode -otpExpires -tokenVersion")
    .lean();

  await AuditLog.create({
    action: verified ? "verify-admin" : "unverify-admin",
    entity: "User",
    entityId: id,
    performedBy: adminId,
    hospitalId: existing.hospitalId || null,
    details: `Tài khoản ${existing.email} (${existing.role}) đã được duyệt/xác thực: ${verified ? "Thành công" : "Thu hồi"} bởi Admin`,
  });

  return updated;
};

export const unlockUserById = async (id, adminId) => {
  const existing = await User.findById(id).select("isLocked email hospitalId").lean();

  if (!existing) {
    throw new Error("User not found");
  }

  // Idempotent: already unlocked — return user without creating AuditLog
  if (!existing.isLocked) {
    return User.findById(id)
      .select("-passwordHash -otpCode -otpExpires -tokenVersion")
      .lean();
  }

  // Lock is active — unlock and audit
  const updated = await User.findByIdAndUpdate(
    id,
    { isLocked: false },
    { new: true }
  )
    .select("-passwordHash -otpCode -otpExpires -tokenVersion")
    .lean();

  await AuditLog.create({
    action: "unlock-user",
    entity: "User",
    entityId: id,
    performedBy: adminId,
    hospitalId: existing.hospitalId || null,
    details: `User ${existing.email} unlocked by admin`,
  });

  return updated;
};

export const getUserById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return User.findById(id)
    .select("-passwordHash -otpCode -otpExpires -tokenVersion")
    .lean();
};

export const getSystemStats = async () => {
  const [totalUsers, totalDoctors, totalDatasets, totalAuditLogs, pendingDoctors, totalAiScans, paidInvoices] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: "doctor" }),
    Dataset.countDocuments(),
    AuditLog.countDocuments(),
    User.countDocuments({ role: "doctor", isVerified: false }),
    Visit.countDocuments({ "mriOrder.requestAiAnalysis": true }),
    Invoice.find({ status: "đã thanh toán" }),
  ]);

  const totalRevenue = paidInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

  // User role distribution counts
  const patientsCount = await User.countDocuments({ role: "patient" });
  const staffCount = await User.countDocuments({ role: { $in: ["admin", "hospital_admin", "technician", "nurse"] } });

  const userDistribution = {
    patient: patientsCount,
    doctor: totalDoctors,
    staff: staffCount,
    total: patientsCount + totalDoctors + staffCount
  };

  // Compile monthly scans dynamically for the last 12 months
  const monthlyScans = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

    const count = await Visit.countDocuments({
      "mriOrder.requestAiAnalysis": true,
      createdAt: { $gte: start, $lte: end }
    });

    const monthLabel = `T${d.getMonth() + 1}/${String(d.getFullYear()).substring(2)}`;
    monthlyScans.push({ label: monthLabel, value: count });
  }

  // Retrieve actual recent activities from AuditLog
  const recentAuditLogs = await AuditLog.find({})
    .sort({ createdAt: -1 })
    .limit(6)
    .lean();

  const userIds = recentAuditLogs.map(l => l.performedBy).filter(id => mongoose.Types.ObjectId.isValid(id));
  const users = await User.find({ _id: { $in: userIds } }).select("profile.name email").lean();
  const userMap = new Map(users.map(u => [u._id.toString(), u]));

  const recentActivities = recentAuditLogs.map(log => {
    const user = userMap.get(log.performedBy);
    const userName = user?.profile?.name || user?.email || log.performedBy || "Hệ thống";
    const formattedDate = log.createdAt ? new Date(log.createdAt) : new Date();
    const diffMs = new Date() - formattedDate;
    const diffMins = Math.max(0, Math.floor(diffMs / 60000));
    let timeStr = `${diffMins} phút trước`;
    if (diffMins >= 60) {
      const diffHours = Math.floor(diffMins / 60);
      timeStr = `${diffHours} giờ trước`;
      if (diffHours >= 24) {
        timeStr = `${formattedDate.getDate()}/${formattedDate.getMonth() + 1}`;
      }
    }
    return {
      action: log.details || `${log.action} bởi ${userName}`,
      time: timeStr,
      type: log.action
    };
  });

  return {
    totalUsers,
    totalDoctors,
    totalDatasets,
    totalAuditLogs,
    pendingDoctors,
    totalAiScans,
    totalRevenue,
    userDistribution,
    monthlyScans,
    recentActivities
  };
};
