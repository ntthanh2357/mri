/**
 * Automated Verification Suite for:
 * 1. Single Device / Session Enforcement (Mỗi tài khoản chỉ đăng nhập ở 1 máy)
 * 2. IP Geolocation and Login History Tracking (Định vị IP và ghi vết đăng nhập cho Admin)
 */

import jwt from "jsonwebtoken";
import { User } from "../modules/auth/models/user.model.js";
import { AuditLog } from "../models/auditLog.model.js";
import { protect } from "../middlewares/auth.middleware.js";
import { recordUserLoginSession, extractClientIp, resolveIpLocation } from "../utils/geoIp.util.js";
import { getJwtSecret } from "../config/jwt.config.js";
import { authCache } from "../utils/authCache.util.js";

// Hỗ trợ cả môi trường test_runner (global describe/it) lẫn chạy trực tiếp node
const describeSuite = typeof describe === "function" ? describe : async (name, fn) => {
  console.log(`\n=== ${name} ===`);
  await fn();
};
const itTest = typeof it === "function" ? it : async (name, fn) => {
  try {
    await fn();
    console.log(`  ✔ PASS: ${name}`);
  } catch (err) {
    console.error(`  ✖ FAIL: ${name}`, err);
    throw err;
  }
};

describeSuite("Bảo Mật Hệ Thống: Cưỡng Chế 1 Máy Đăng Nhập & Định Vị Địa Chỉ IP (GeoIP)", () => {
  const secret = getJwtSecret();
  let originalAuditLogCreate;

  if (typeof beforeAll === "function") {
    beforeAll(() => {
      originalAuditLogCreate = AuditLog.create;
      AuditLog.create = async (d) => d;
    });
    afterAll(() => {
      if (originalAuditLogCreate) AuditLog.create = originalAuditLogCreate;
    });
  } else {
    AuditLog.create = async (d) => d;
  }

  itTest("1. Cưỡng chế 1 máy duy nhất: Máy B đăng nhập làm văng Máy A tức thì (Single Device Enforcement)", async () => {
    const userDoc = {
      _id: "user_test_single_device",
      role: "doctor",
      tokenVersion: 0,
      isLocked: false,
      hospitalId: null,
      save: async function () { return this; },
    };

    const tokenMachineA = jwt.sign(
      { id: userDoc._id, role: userDoc.role, tokenVersion: userDoc.tokenVersion },
      secret,
      { expiresIn: "1h", algorithm: "HS256" }
    );

    const originalFindById = User.findById;
    User.findById = (id) => ({
      select: () => ({
        lean: async () => ({
          _id: id,
          role: userDoc.role,
          tokenVersion: userDoc.tokenVersion,
          isLocked: userDoc.isLocked,
          hospitalId: userDoc.hospitalId,
        }),
      }),
    });

    try {
      authCache.invalidateUser(userDoc._id);
      let nextCalledA = false;
      const reqA = { headers: { authorization: `Bearer ${tokenMachineA}` } };
      const resA = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { this.jsonData = data; return this; },
      };

      await protect(reqA, resA, () => { nextCalledA = true; });
      if (!nextCalledA) throw new Error("Máy A phải truy cập được khi chưa có máy B");

      // Máy B đăng nhập
      const reqBLogin = {
        headers: {
          "x-forwarded-for": "113.161.72.10",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
        },
      };
      await recordUserLoginSession(userDoc, reqBLogin);

      if (userDoc.tokenVersion !== 1) {
        throw new Error(`Kỳ vọng tokenVersion tăng lên 1, thực tế là ${userDoc.tokenVersion}`);
      }

      // Máy A gửi request tiếp theo với token cũ
      let machineAErrorStatus = null;
      let machineAErrorMessage = "";
      const reqASecond = { headers: { authorization: `Bearer ${tokenMachineA}` } };
      const resASecond = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) {
          machineAErrorStatus = this.statusCode;
          machineAErrorMessage = data.message;
          return this;
        },
      };

      await protect(reqASecond, resASecond, () => {});

      if (machineAErrorStatus !== 401) {
        throw new Error(`Kỳ vọng Máy A bị trả về 401, nhưng nhận được ${machineAErrorStatus}`);
      }
    } finally {
      User.findById = originalFindById;
    }
  });

  itTest("2. Trích xuất đúng Client IP & Phân giải định vị địa lý (GeoIP)", async () => {
    const mockReqChain = {
      headers: { "x-forwarded-for": "14.241.12.34, 10.0.0.1, 192.168.1.1" },
    };
    const extractedIp = extractClientIp(mockReqChain);
    if (extractedIp !== "14.241.12.34") {
      throw new Error(`Trích xuất client IP thất bại. Kỳ vọng 14.241.12.34, nhận: ${extractedIp}`);
    }

    const localLocation = await resolveIpLocation("127.0.0.1");
    if (!localLocation.isLocal || !localLocation.displayLocation.includes("Mạng nội bộ")) {
      throw new Error("Phân giải IP Localhost phải nhận diện là Mạng nội bộ");
    }

    const lanLocation = await resolveIpLocation("192.168.1.55");
    if (!lanLocation.isLocal) {
      throw new Error("Dải 192.168.* phải được nhận diện là LAN");
    }
  });

  itTest("3. Ghi vết Login History và AuditLog IP/Location cho Admin giám sát", async () => {
    let createdAuditLog = null;
    const oldCreate = AuditLog.create;
    AuditLog.create = async (data) => {
      createdAuditLog = data;
      return data;
    };

    try {
      const userObj = {
        _id: "user_audit_test",
        role: "hospital_admin",
        tokenVersion: 1,
        loginHistory: [],
        save: async function () { return this; },
        markModified: () => {},
      };

      const mockReq = {
        headers: {
          "x-forwarded-for": "113.161.72.10",
          "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
        },
      };

      await recordUserLoginSession(userObj, mockReq);

      if (!userObj.lastLoginIp || userObj.lastLoginIp !== "113.161.72.10") {
        throw new Error(`lastLoginIp không khớp: ${userObj.lastLoginIp}`);
      }
      if (!userObj.lastLoginLocation || !userObj.lastLoginLocation.displayLocation) {
        throw new Error("lastLoginLocation chưa có displayLocation");
      }
      if (userObj.loginHistory.length !== 1) {
        throw new Error(`loginHistory phải có 1 phần tử, nhận: ${userObj.loginHistory.length}`);
      }
      if (!userObj.loginHistory[0].device.includes("iOS")) {
        throw new Error(`Thiết bị phải nhận diện là iOS, nhận: ${userObj.loginHistory[0].device}`);
      }

      if (!createdAuditLog || createdAuditLog.action !== "USER_LOGIN") {
        throw new Error("AuditLog USER_LOGIN chưa được tạo");
      }
      if (createdAuditLog.ipAddress !== "113.161.72.10") {
        throw new Error(`AuditLog ipAddress không khớp: ${createdAuditLog.ipAddress}`);
      }
    } finally {
      AuditLog.create = oldCreate;
    }
  });
});
