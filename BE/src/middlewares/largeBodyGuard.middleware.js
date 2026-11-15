import jwt from "jsonwebtoken";
import { getJwtSecret } from "../config/jwt.config.js";

/**
 * Các route ảnh nhận body lớn đều yêu cầu đăng nhập. Kiểm tra chữ ký token TRƯỚC khi đọc body,
 * để người chưa đăng nhập không đẩy được hàng trăm MB vào bộ nhớ máy chủ. Quyền chi tiết vẫn do protect kiểm tra sau.
 */
export const requireJwtBeforeLargeBody = (req, res, next) => {
  // GET / HEAD / OPTIONS không có JSON body; route ảnh đã ký (?exp=&sig=) sẽ được allowSignedPath / protect xác thực phía dưới
  if (req.method === "OPTIONS" || req.method === "GET" || req.method === "HEAD") return next();
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Chưa đăng nhập hoặc phiên đăng nhập đã hết hạn." });
  }
};
