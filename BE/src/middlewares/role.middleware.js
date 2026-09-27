export const requireSystemAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "system_admin")) {
    res.status(403).json({ message: "Yêu cầu quyền Quản trị viên hệ thống (SaaS Admin)." });
    return;
  }
  next();
};

export const requireHospitalAdmin = (req, res, next) => {
  if (!req.user || !["admin", "system_admin", "hospital_admin"].includes(req.user.role)) {
    res.status(403).json({ message: "Yêu cầu quyền Quản trị viên bệnh viện." });
    return;
  }
  next();
};

// Vẫn giữ lại requireAdmin cho tương thích ngược nếu cần
export const requireAdmin = requireSystemAdmin;
