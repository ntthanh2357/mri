/**
 * NeuroScan AI - Compliance & Security Feature Flags
 * Điều khiển bật/tắt các rào chắn an ninh theo chuẩn TT46/2018/TT-BYT, Luật 15/2023/QH15, HIPAA, OWASP.
 * Hỗ trợ cơ chế Rollback tức thời không cần redeploy khi phát hiện sự cố trên môi trường sản xuất.
 */

export const FEATURES = {
  // P0 Flags
  ENABLE_JWT_ALGORITHM_LOCK: process.env.ENABLE_JWT_ALGORITHM_LOCK !== "false", // Mặc định: BẬT
  ENABLE_EMR_IMMUTABLE_LOCK: process.env.ENABLE_EMR_IMMUTABLE_LOCK !== "false", // Mặc định: BẬT

  // P1 Flags
  ENABLE_HASH_CHAIN_AUDIT: process.env.ENABLE_HASH_CHAIN_AUDIT !== "false",     // Mặc định: BẬT
  ENABLE_DATA_SEGREGATION: process.env.ENABLE_DATA_SEGREGATION !== "false",     // Mặc định: BẬT (Non-breaking masking)
  ENABLE_FIELD_LEVEL_ENCRYPTION: process.env.ENABLE_FIELD_LEVEL_ENCRYPTION !== "false", // Mặc định: BẬT

  // P2 Flags
  ENABLE_RETENTION_ENGINE: process.env.ENABLE_RETENTION_ENGINE !== "false",     // Mặc định: BẬT
};

export default FEATURES;
