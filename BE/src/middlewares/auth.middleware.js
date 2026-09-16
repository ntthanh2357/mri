import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { Hospital } from "../models/hospital.model.js";
import { tenantStorage } from "./tenant.middleware.js";
import { authCache } from "../utils/authCache.util.js";
import { getJwtSecret } from "../config/jwt.config.js";
import { FEATURES } from "../config/features.config.js";

export const protect = async (req, res, next) => {
  let token;

  // Check for Bearer token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const secret = getJwtSecret();

      // [OWASP API2:2023 HARDENING]: Chống tấn công alg: none và Algorithm Confusion
      if (FEATURES.ENABLE_JWT_ALGORITHM_LOCK) {
        const unverified = jwt.decode(token, { complete: true });
        if (!unverified || !unverified.header || unverified.header.alg === "none" || !["HS256"].includes(unverified.header.alg)) {
          res.status(401).json({ message: "Thuật toán xác thực JWT không hợp lệ hoặc bị cấm (chống giả mạo alg:none)." });
          return;
        }
      }

      // Verify token
      const verifyOptions = FEATURES.ENABLE_JWT_ALGORITHM_LOCK ? { algorithms: ["HS256"] } : {};
      const decoded = jwt.verify(token, secret, verifyOptions);

      // Tầng đệm Auth Cache (In-Memory Fast Path): Tránh gọi DB lặp lại trên mọi request
      let user = authCache.getUserAuth(decoded.id);
      if (!user) {
        user = await User.findById(decoded.id).select("tokenVersion isLocked hospitalId role").lean();
        if (user) {
          authCache.setUserAuth(decoded.id, user, 60000); // Cache 60s
        }
      }

      if (!user) {
        res.status(401).json({ message: "Người dùng không tồn tại hoặc tài khoản đã bị khóa." });
        return;
      }

      if (user.isLocked) {
        res.status(403).json({ message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên." });
        return;
      }

      // Check if hospital is deactivated/locked or subscription has expired (với Hospital Cache)
      if (user.hospitalId) {
        let hospital = authCache.getHospitalAuth(user.hospitalId);
        if (!hospital) {
          hospital = await Hospital.findById(user.hospitalId).select("isActive subscriptionExpiresAt subscriptionStatus").lean();
          if (hospital) {
            authCache.setHospitalAuth(user.hospitalId, hospital, 120000); // Cache 120s
          }
        }

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
      req.user.role = user.role || decoded.role;
      req.user.hospitalId = user.hospitalId ? user.hospitalId.toString() : null;

      const isSuperAdmin = req.user.role === "admin" || req.user.role === "system_admin";
      tenantStorage.run({
        hospitalId: req.user.hospitalId,
        isSuperAdmin,
        role: req.user.role,
        userId: decoded.id
      }, () => {
        next();
      });
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
      const secret = getJwtSecret();
      const verifyOptions = FEATURES.ENABLE_JWT_ALGORITHM_LOCK ? { algorithms: ["HS256"] } : {};
      const decoded = jwt.verify(token, secret, verifyOptions);

      let user = authCache.getUserAuth(decoded.id);
      if (!user) {
        user = await User.findById(decoded.id).select("tokenVersion isLocked hospitalId role").lean();
        if (user) {
          authCache.setUserAuth(decoded.id, user, 60000);
        }
      }

      if (user && !user.isLocked) {
        const tokenVersionInJwt = decoded.tokenVersion !== undefined ? decoded.tokenVersion : 0;
        if (user.tokenVersion === tokenVersionInJwt) {
          req.user = decoded;
          req.user.role = user.role || decoded.role;
          req.user.hospitalId = user.hospitalId ? user.hospitalId.toString() : null;
        }
      }
    } catch (error) {
      // Ignored for optional protect
    }
  }
  
  if (req.user) {
    const isSuperAdmin = req.user.role === "admin" || req.user.role === "system_admin";
    tenantStorage.run({
      hospitalId: req.user.hospitalId || null,
      isSuperAdmin,
      role: req.user.role,
      userId: req.user.id
    }, () => {
      next();
    });
  } else {
    next();
  }
};

export const checkRole = (...roles) => {
  const allowedRoles = roles.flat().filter(Boolean);
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


