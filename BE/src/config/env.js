// Nạp BE/.env TRƯỚC mọi module khác. Phải là import đầu tiên của src/index.js.
// ESM đánh giá các import trước thân file: trước đây dotenv.config() trong index.js chạy SAU khi
// features.config.js (ENABLE_OUT_OF_SCOPE, ENABLE_JWT_ALGORITHM_LOCK…), storageEngine.js (STORAGE_MODE)… đã đọc
// process.env, nên các cờ đặt trong BE/.env không có tác dụng khi chạy `npm start` (chỉ biến môi trường hệ thống/docker).
// dotenv không ghi đè biến môi trường đã có sẵn.
import dotenv from "dotenv";

dotenv.config();
