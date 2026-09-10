/**
 * Facade Re-export for Backward Compatibility (Strangler Fig Pattern)
 * Đảm bảo mọi module cũ import từ '../models/otp.model.js' vẫn hoạt động 100%.
 */
export * from "../modules/auth/models/otp.model.js";
export { Otp } from "../modules/auth/models/otp.model.js";
