/**
 * Facade Re-export for Backward Compatibility (Strangler Fig Pattern)
 * Đảm bảo mọi router/service cũ import từ '../controllers/auth.controller.js' vẫn hoạt động 100%.
 */
export * from "../modules/auth/auth.controller.js";
