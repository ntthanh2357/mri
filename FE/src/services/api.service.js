/**
 * Facade Re-export for Backward Compatibility (Strangler Fig Pattern)
 * Đảm bảo tất cả màn hình cũ import từ '../services/api.service' hoặc '../services/api.service.js' hoạt động 100%.
 */
export * from '../api/client.js';
export { default } from '../api/client.js';
export { authApi } from '../api/endpoints/auth.api.js';
export { emrApi } from '../api/endpoints/emr.api.js';
export { imagingApi } from '../api/endpoints/imaging.api.js';
export { lisApi } from '../api/endpoints/lis.api.js';
export { adminApi } from '../api/endpoints/admin.api.js';
export { patientApi } from '../api/endpoints/patient.api.js';
