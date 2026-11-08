/**
 * Lỗi do dữ liệu client gửi lên sai định dạng/kiểu (id không phải ObjectId, số/chuỗi sai kiểu, thiếu trường bắt buộc
 * theo schema) là lỗi 400, không phải lỗi máy chủ. Dùng trong khối catch thay cho mã 500 cứng:
 *   return errorResponse(res, "…", inputErrorStatus(res, error));
 * Lỗi khác vẫn trả 500 như cũ. Thông báo 400 được thay bằng câu chung ở sanitizeServerErrors.
 */
const INPUT_ERROR_NAMES = new Set(["CastError", "ValidationError", "BSONError", "StrictModeError", "ObjectParameterError"]);

export const isInputError = (error) => Boolean(error && INPUT_ERROR_NAMES.has(error.name));

export const INPUT_ERROR_MESSAGE = "Dữ liệu gửi lên không hợp lệ (sai định dạng mã hoặc kiểu dữ liệu).";

export const inputErrorStatus = (res, error, fallback = 500) => {
  if (!isInputError(error)) return fallback;
  if (res?.locals) res.locals.inputError = true;
  return 400;
};
