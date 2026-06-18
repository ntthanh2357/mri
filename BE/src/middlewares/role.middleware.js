export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ message: "Yêu cầu quyền admin." });
    return;
  }

  next();
};
