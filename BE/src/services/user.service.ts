import mongoose from "mongoose";
import { User } from "../models/user.model";
import { AuditLog } from "../models/auditLog.model";
import { Dataset } from "../models/dataset.model";

export const getAllUsers = async () => {
  return User.find({}, "-passwordHash").lean();
};

export const toggleUserLock = async (userId: string, isLocked: boolean, adminId: string) => {
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
      details: `User ${user.email} ${isLocked ? "bị khóa" : "đã mở khóa"} bởi admin`,
    });
  }

  return user;
};

export const getAllDoctors = async () => {
  return User.find({ role: "doctor" }, "-passwordHash").lean();
};

export const lockUserById = async (id: string, adminId: string) => {
  const user = await User.findById(id).select("isLocked email").lean();

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
    details: `User ${user.email} locked by admin`,
  });

  return updatedUser;
};

export const verifyDoctor = async (userId: string, verified: boolean, adminId: string) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { isVerified: verified },
    { new: true }
  ).select("-passwordHash");

  if (user) {
    await AuditLog.create({
      action: verified ? "verify-doctor" : "unverify-doctor",
      entity: "User",
      entityId: userId,
      performedBy: adminId,
      details: `Doctor ${user.email} verification ${verified ? "approved" : "revoked"} by admin`,
    });
  }

  return user;
};

export const verifyDoctorById = async (id: string, verified: boolean, adminId: string) => {
  // Step 1: Find user by id, selecting only the fields we need to validate
  const existing = await User.findById(id).select("role email isVerified").lean();

  // Step 2: If not found or not a doctor, throw
  if (!existing || existing.role !== "doctor") {
    throw new Error("Doctor not found");
  }

  // Step 3: Update and return the sanitized document
  const updated = await User.findByIdAndUpdate(
    id,
    { isVerified: verified },
    { new: true }
  )
    .select("-passwordHash -otpCode -otpExpires -tokenVersion")
    .lean();

  // Step 4: Create audit log
  await AuditLog.create({
    action: verified ? "verify-doctor" : "unverify-doctor",
    entity: "User",
    entityId: id,
    performedBy: adminId,
    details: `Doctor ${existing.email} verification ${verified ? "approved" : "revoked"} by admin`,
  });

  // Step 5: Return updated doctor
  return updated;
};

export const unlockUserById = async (id: string, adminId: string) => {
  const existing = await User.findById(id).select("isLocked email").lean();

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
    details: `User ${existing.email} unlocked by admin`,
  });

  return updated;
};

export const getUserById = async (id: string) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return User.findById(id)
    .select("-passwordHash -otpCode -otpExpires -tokenVersion")
    .lean();
};

export const getSystemStats = async () => {
  const [totalUsers, totalDoctors, totalDatasets, totalAuditLogs] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: "doctor" }),
    Dataset.countDocuments(),
    AuditLog.countDocuments(),
  ]);
  return { totalUsers, totalDoctors, totalDatasets, totalAuditLogs };
};
