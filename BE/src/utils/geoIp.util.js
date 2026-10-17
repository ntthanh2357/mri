/**
 * Tiện ích trích xuất IP, nhận diện thiết bị và định vị địa lý (IP Geolocation)
 * Chuẩn bảo mật an toàn Y tế: HIPAA §164.312(b) & Luật An toàn thông tin mạng 86/2015/QH13
 */

import { AuditLog } from "../models/auditLog.model.js";
import { authCache } from "./authCache.util.js";

// Cache in-memory kết quả GeoIP để tránh gọi lặp lại và giảm tải mạng
const geoCache = new Map();
const MAX_CACHE_SIZE = 1000;

/**
 * Trích xuất Client IP thực tế từ request
 * Xử lý an toàn các header proxy (x-forwarded-for, x-real-ip) và chuyển đổi IPv6-mapped IPv4
 */
export const extractClientIp = (req) => {
  if (!req) return "127.0.0.1";

  const forwarded = req.headers?.["x-forwarded-for"];
  let ip = "";
  if (forwarded) {
    // x-forwarded-for có thể chứa danh sách: client, proxy1, proxy2
    ip = forwarded.split(",")[0].trim();
  }
  if (!ip) {
    ip = req.headers?.["x-real-ip"] || req.socket?.remoteAddress || req.ip || "127.0.0.1";
  }

  // Chuẩn hóa dạng IPv6 localhost ::1 hoặc ::ffff:127.0.0.1
  if (ip === "::1" || ip === "::ffff:127.0.0.1") {
    return "127.0.0.1";
  }
  if (ip.startsWith("::ffff:")) {
    ip = ip.replace("::ffff:", "");
  }

  return ip;
};

/**
 * Kiểm tra xem IP có thuộc dải mạng nội bộ (LAN / Private IP / Loopback) không
 */
export const isPrivateOrLocalIp = (ip) => {
  if (!ip) return true;
  if (ip === "127.0.0.1" || ip === "localhost") return true;

  // Dải 10.0.0.0 - 10.255.255.255
  if (/^10\./.test(ip)) return true;
  // Dải 172.16.0.0 - 172.31.255.255
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
  // Dải 192.168.0.0 - 192.168.255.255
  if (/^192\.168\./.test(ip)) return true;
  // Link-local 169.254.0.0 - 169.254.255.255
  if (/^169\.254\./.test(ip)) return true;

  return false;
};

/**
 * Phân giải IP ra vị trí địa lý (Quốc gia, Thành phố, Tọa độ, ISP)
 * Hoạt động cả khi offline hoặc mạng nội bộ (fallback an toàn, không block request)
 */
export const resolveIpLocation = async (ip) => {
  const cleanIp = (ip || "").trim();

  // Kiểm tra cache trước
  if (geoCache.has(cleanIp)) {
    return geoCache.get(cleanIp);
  }

  // Nếu là mạng nội bộ / Localhost bệnh viện
  if (isPrivateOrLocalIp(cleanIp)) {
    const localLocation = {
      ip: cleanIp || "127.0.0.1",
      isLocal: true,
      country: "Việt Nam",
      countryCode: "VN",
      region: "Nội bộ",
      city: "Mạng Nội Bộ Bệnh Viện (LAN)",
      timezone: "Asia/Ho_Chi_Minh",
      lat: 10.8231, // Tọa độ trung tâm y tế tham chiếu
      lon: 106.6297,
      isp: "Hospital Intranet / Mini-PACS Network",
      displayLocation: "Mạng nội bộ Bệnh viện (Localhost / LAN)",
    };
    if (geoCache.size < MAX_CACHE_SIZE) geoCache.set(cleanIp, localLocation);
    return localLocation;
  }

  // Nếu là IP công khai (Public IP), tra cứu nhanh qua service GeoIP với timeout 1.5s
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const response = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,message,country,countryCode,regionName,city,lat,lon,timezone,isp`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.status === "success") {
        const resolved = {
          ip: cleanIp,
          isLocal: false,
          country: data.country || "Việt Nam",
          countryCode: data.countryCode || "VN",
          region: data.regionName || "",
          city: data.city || "",
          timezone: data.timezone || "Asia/Ho_Chi_Minh",
          lat: data.lat || null,
          lon: data.lon || null,
          isp: data.isp || "Internet Service Provider",
          displayLocation: `${data.city ? `${data.city}, ` : ""}${data.country || "Việt Nam"}`,
        };
        if (geoCache.size < MAX_CACHE_SIZE) geoCache.set(cleanIp, resolved);
        return resolved;
      }
    }
  } catch {
    // Không chặn luồng nếu request timeout hoặc mạng ngoài gián đoạn
  }

  // Fallback an toàn nếu không tra cứu được dịch vụ ngoài
  const fallback = {
    ip: cleanIp,
    isLocal: false,
    country: "Việt Nam",
    countryCode: "VN",
    region: "",
    city: "Truy cập Internet",
    timezone: "Asia/Ho_Chi_Minh",
    lat: null,
    lon: null,
    isp: "Public Internet",
    displayLocation: `Địa chỉ IP: ${cleanIp}`,
  };
  if (geoCache.size < MAX_CACHE_SIZE) geoCache.set(cleanIp, fallback);
  return fallback;
};

/**
 * Phân tích User-Agent thành tên thiết bị và hệ điều hành dễ đọc
 */
export const extractDeviceInfo = (req) => {
  const ua = req?.headers?.["user-agent"] || "";
  if (!ua) return "Trình duyệt Web (Không xác định)";

  let os = "Thiết bị khác";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/macintosh|mac os/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua)) os = "Linux";

  let client = "Trình duyệt";
  if (/edg/i.test(ua)) client = "Microsoft Edge";
  else if (/chrome|crios/i.test(ua)) client = "Google Chrome";
  else if (/firefox|fxios/i.test(ua)) client = "Mozilla Firefox";
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) client = "Apple Safari";
  else if (/expo/i.test(ua)) client = "NeuroScan Mobile App";

  return `${client} (${os})`;
};

/**
 * Ghi nhận phiên đăng nhập:
 * 1. TĂNG tokenVersion để vô hiệu hóa tất cả các phiên trước đó (Chặn đăng nhập đồng thời ở nhiều máy - Single Device Enforcement).
 * 2. Lưu IP, định vị địa lý (GeoIP), thiết bị vào hồ sơ User.
 * 3. Ghi vết AuditLog theo chuẩn HIPAA / Luật ATTT mạng.
 */
export const recordUserLoginSession = async (user, req) => {
  if (!user) return null;

  const ip = extractClientIp(req);
  const locationInfo = await resolveIpLocation(ip);
  const device = extractDeviceInfo(req);

  // [SINGLE DEVICE ENFORCEMENT]: Tăng tokenVersion để hủy phiên của mọi máy khác
  user.tokenVersion = (user.tokenVersion || 0) + 1;

  // Cập nhật thông tin đăng nhập gần nhất
  user.lastLoginIp = ip;
  user.lastLoginLocation = {
    country: locationInfo.country || "",
    countryCode: locationInfo.countryCode || "",
    region: locationInfo.region || "",
    city: locationInfo.city || "",
    timezone: locationInfo.timezone || "",
    lat: locationInfo.lat || null,
    lon: locationInfo.lon || null,
    isp: locationInfo.isp || "",
    displayLocation: locationInfo.displayLocation || ip,
  };
  user.lastLoginAt = new Date();

  // Duy trì lịch sử tối đa 10 phiên đăng nhập gần nhất
  if (!Array.isArray(user.loginHistory)) {
    user.loginHistory = [];
  }
  user.loginHistory.unshift({
    ip,
    location: locationInfo.displayLocation || ip,
    device,
    loggedInAt: new Date(),
  });
  if (user.loginHistory.length > 10) {
    user.loginHistory = user.loginHistory.slice(0, 10);
  }

  // Đánh dấu modified và lưu
  user.markModified?.("lastLoginLocation");
  user.markModified?.("loginHistory");
  await user.save({ validateBeforeSave: false });

  // Xóa authCache để token cũ bị từ chối ngay lập tức ở request kế tiếp
  const userIdStr = user._id ? user._id.toString() : user.id;
  if (userIdStr) {
    authCache.invalidateUser(userIdStr);
  }

  // Ghi nhật ký kiểm toán hệ thống (AuditLog) kèm IP và Vị trí
  try {
    await AuditLog.create({
      action: "USER_LOGIN",
      entity: "User",
      entityId: userIdStr || "",
      performedBy: userIdStr || "user",
      hospitalId: user.hospitalId || null,
      details: `Đăng nhập thành công từ ${locationInfo.displayLocation} (IP: ${ip}) trên ${device}. Phiên máy cũ đã được thu hồi an toàn.`,
      ipAddress: ip,
      location: locationInfo.displayLocation || ip,
    });
  } catch (logErr) {
    console.warn("[GeoIP/Audit] Không thể ghi audit log đăng nhập:", logErr.message);
  }

  return {
    tokenVersion: user.tokenVersion,
    ip,
    location: locationInfo,
    device,
  };
};
