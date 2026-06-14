import { User } from "../models/user.model";
import { AuditLog } from "../models/auditLog.model";

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
