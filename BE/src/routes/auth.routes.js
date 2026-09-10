/**
 * Facade Re-export for Backward Compatibility (Strangler Fig Pattern)
 * Đảm bảo routes/index.js hoặc bất kỳ file cũ nào import từ './auth.routes.js' vẫn hoạt động 100%.
 */
export * from "../modules/auth/auth.routes.js";
export { default } from "../modules/auth/auth.routes.js";
