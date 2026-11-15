// Bộ test có deleteMany trên nhiều collection: chỉ được chạy trên DB cục bộ.
import dotenv from "dotenv";

dotenv.config();
const isLocal = (uri) => !uri || /^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri);
if (!isLocal(process.env.TEST_MONGO_URI) || !isLocal(process.env.MONGO_URI)) {
  console.error("Từ chối chạy test: TEST_MONGO_URI hoặc MONGO_URI không trỏ tới DB cục bộ.");
  process.exit(9);
}
