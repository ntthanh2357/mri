import mongoose from "mongoose";

export const connectDB = async () => {
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/neuro";
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 3000 });
    console.log("Successfully connected to MongoDB Database via Config");
  } catch (error) {
    console.warn("⚠️ Không thể kết nối MongoDB từ xa:", error.message);
    // Trên môi trường thật, đổi sang DB rỗng sẽ làm dữ liệu mới nằm sai chỗ mà không ai biết
    if (process.env.NODE_ENV === "production") {
      console.error("❌ Không kết nối được DB trên production, dừng ứng dụng.");
      process.exit(1);
    }
    console.log("🔄 Đang tự động chuyển tiếp sang MongoDB cục bộ (mongodb://127.0.0.1:27017/neuro)...");
    try {
      await mongoose.connect("mongodb://127.0.0.1:27017/neuro", { serverSelectionTimeoutMS: 3000 });
      console.log("✅ Đã kết nối thành công với MongoDB cục bộ (mongodb://127.0.0.1:27017/neuro)");
    } catch (localErr) {
      console.error("❌ Kết nối cơ sở dữ liệu thất bại:", localErr.message);
      process.exit(1);
    }
  }
};
