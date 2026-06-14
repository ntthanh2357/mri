import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    tokenVersion: number;
  };
}

export const protect = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  let token;

  // Check for Bearer token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const secret = process.env.JWT_SECRET || "access_secret";

      // Verify token
      const decoded = jwt.verify(token, secret) as { id: string; role: string; tokenVersion?: number };

      // Fetch user from database to check token version and locked status
      const user = await User.findById(decoded.id).select("tokenVersion isLocked");
      if (!user) {
        res.status(401).json({ message: "Người dùng không tồn tại hoặc tài khoản đã bị khóa." });
        return;
      }

      if (user.isLocked) {
        res.status(403).json({ message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên." });
        return;
      }

      // Check token version
      const tokenVersionInJwt = decoded.tokenVersion !== undefined ? decoded.tokenVersion : 0;
      if (user.tokenVersion !== tokenVersionInJwt) {
        res.status(401).json({ message: "Phiên đăng nhập đã hết hạn hoặc đã bị đăng xuất trên các thiết bị khác." });
        return;
      }

      // Add user info to request
      req.user = decoded;

      next();
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
