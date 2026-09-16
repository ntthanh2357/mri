export const errorHandler = (err, req, res, next) => {
  console.error(`[Error Handler] ${req.method} ${req.url}:`, err.message || err);

  // Mongoose Bad ObjectId (CastError)
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `Định dạng mã định danh (${err.path}) không hợp lệ.`
    });
  }

  // Mongoose Validation Error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors || {}).map((val) => val.message);
    return res.status(400).json({
      success: false,
      message: "Dữ liệu không hợp lệ theo quy định hệ thống.",
      errors: messages
    });
  }

  // Mongoose Duplicate Key Error (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "trường dữ liệu";
    return res.status(409).json({
      success: false,
      message: `Thông tin ${field} đã tồn tại trên hệ thống, không thể trùng lặp.`
    });
  }

  // JWT Errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Mã xác thực JWT không hợp lệ."
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại."
    });
  }

  const statusCode = err.status || err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === "production";

  res.status(statusCode).json({
    success: false,
    message: isProduction && statusCode === 500
      ? "Đã xảy ra sự cố nội bộ trên máy chủ y tế. Vui lòng thử lại sau."
      : (err.message || "Internal Server Error"),
    ...(isProduction ? {} : { stack: err.stack })
  });
};
