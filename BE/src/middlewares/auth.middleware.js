import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { Hospital } from "../models/hospital.model.js";
import { tenantStorage } from "./tenant.middleware.js";

export const protect = async (req, res, next) => {
  let token;

  // Check for Bearer token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const secret = process.env.JWT_SECRET || "access_secret";

      // Verify token
      const decoded = jwt.verify(token, secret);

      // Fetch user from database to check token version and locked status
      const user = await User.findById(decoded.id).select("tokenVersion isLocked hospitalId");
      if (!user) {
        res.status(401).json({ message: "Người dùng không tồn tại hoặc tài khoản đã bị khóa." });
        return;
      }

      if (user.isLocked) {
        res.status(403).json({ message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên." });
        return;
      }

      // Check if hospital is deactivated/locked or subscription has expired
      if (user.hospitalId) {
        const hospital = await Hospital.findById(user.hospitalId).select("isActive subscriptionExpiresAt subscriptionStatus");
        if (hospital) {
          if (hospital.isActive === false) {
            res.status(403).json({ message: "Bệnh viện của bạn đang bị khóa. Vui lòng liên hệ quản trị viên." });
            return;
          }
          const now = new Date();
          const hasExpired = hospital.subscriptionExpiresAt && new Date(hospital.subscriptionExpiresAt) < now;
          const isSuspended = hospital.subscriptionStatus === "suspended" || hospital.subscriptionStatus === "expired";
          
          if ((hasExpired || isSuspended) && decoded.role !== "admin") {
            res.status(403).json({ message: "Gói đăng ký dịch vụ của bệnh viện đã hết hạn hoặc bị tạm ngưng. Vui lòng liên hệ quản trị viên để gia hạn." });
            return;
          }
        }
      }

      // Check token version
      const tokenVersionInJwt = decoded.tokenVersion !== undefined ? decoded.tokenVersion : 0;
      if (user.tokenVersion !== tokenVersionInJwt) {
        res.status(401).json({ message: "Phiên đăng nhập đã hết hạn hoặc đã bị đăng xuất trên các thiết bị khác." });
        return;
      }

      // Add user info to request
      req.user = decoded;
      req.user.hospitalId = user.hospitalId ? user.hospitalId.toString() : null; // [BUG FIX] Lấy hospitalId từ DB

      if (user.hospitalId) {
        tenantStorage.run({ hospitalId: user.hospitalId.toString() }, () => {
          next();
        });
      } else {
        next();
      }
    } catch (error) {
      console.error("Lỗi xác thực token:", error);
      res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn." });
      return;
    }
  }

  if (!token) {
    res.status(401).json({ message: "Không có quyền truy cập, thiếu token." });
    return;
  }
};

export const optionalProtect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const secret = process.env.JWT_SECRET || "access_secret";
      const decoded = jwt.verify(token, secret);
      const user = await User.findById(decoded.id).select("tokenVersion isLocked hospitalId");
      if (user && !user.isLocked) {
        const tokenVersionInJwt = decoded.tokenVersion !== undefined ? decoded.tokenVersion : 0;
        if (user.tokenVersion === tokenVersionInJwt) {
          req.user = decoded;
        }
      }
    } catch (error) {
      // Ignored for optional protect
    }
  }
  
  if (req.user && req.user.hospitalId) {
    tenantStorage.run({ hospitalId: req.user.hospitalId.toString() }, () => {
      next();
    });
  } else {
    next();
  }
};

export const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      res.status(403).json({ message: "Quyền truy cập bị từ chối, thiếu vai trò người dùng." });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ message: "Quyền truy cập bị từ chối, bạn không có quyền thực hiện hành động này." });
      return;
    }

    next();
  };
};

