/**
 * Nhiều controller bắt lỗi rồi tự trả 500 kèm error.message. Lớp cuối này:
 *  - lỗi do dữ liệu gửi lên sai định dạng (CastError, ValidationError của Mongoose) → 400, thông báo chung;
 *  - lỗi 5xx khác → bỏ trường `error` và chi tiết kỹ thuật trong message, giữ thông báo cho người dùng.
 * Log chi tiết vẫn nằm ở console của từng controller.
 */
const INPUT_ERROR = /Cast to [A-Za-z]+ failed|validation failed|is not a valid enum value|input must be a 24 character hex string|BSONError/i;
const TECH_DETAIL = /Cast to |validation failed|MongoServerError|E11000|is not a function|Cannot read properties|is not defined|Unexpected token|node_modules|\bat [A-Za-z_.$]+ \(|ENOENT|EACCES|EPERM|[A-Za-z]:\\|\/Users\//;

export const sanitizeServerErrors = (req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body) => {
    // Controller đã nhận diện lỗi dữ liệu đầu vào qua inputErrorStatus → thông báo chung, không lộ chi tiết.
    if (res.statusCode === 400 && res.locals?.inputError) {
      return json({ success: false, message: "Dữ liệu gửi lên không hợp lệ (sai định dạng mã hoặc kiểu dữ liệu)." });
    }
    if (res.statusCode >= 500 && body && typeof body === "object" && !Array.isArray(body)) {
      const text = [body.message, body.error].filter((x) => typeof x === "string").join(" ");
      if (INPUT_ERROR.test(text)) {
        res.status(400);
        return json({ success: false, message: "Dữ liệu gửi lên không hợp lệ (sai định dạng mã hoặc kiểu dữ liệu)." });
      }
      const { error, ...rest } = body;
      if (typeof rest.message === "string" && TECH_DETAIL.test(rest.message)) rest.message = "Lỗi máy chủ. Vui lòng thử lại sau.";
      return json(rest);
    }
    return json(body);
  };
  next();
};
