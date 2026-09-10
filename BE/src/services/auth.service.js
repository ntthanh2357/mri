/**
 * Facade Re-export for Backward Compatibility (Strangler Fig Pattern)
 * Đảm bảo mọi module cũ import từ '../services/auth.service.js' vẫn hoạt động 100%.
 */
export * from "../modules/auth/auth.service.js";
export { default } from "../modules/auth/auth.service.js";
