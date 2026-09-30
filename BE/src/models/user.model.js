/**
 * Facade Re-export for Backward Compatibility (Strangler Fig Pattern)
 * Đảm bảo mọi module cũ import từ '../models/user.model.js' vẫn hoạt động 100%.
 */
export * from "../modules/auth/models/user.model.js";
export { User } from "../modules/auth/models/user.model.js";
