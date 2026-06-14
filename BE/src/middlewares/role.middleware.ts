import { Request, Response, NextFunction } from "express";

export const requireAdmin = (req: any, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ message: "Yêu cầu quyền admin." });
    return;
  }

  next();
};
