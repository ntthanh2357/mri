import mongoose from "mongoose";

export const connectDB = async () => {
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/neuro";
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Successfully connected to MongoDB Database via Config");
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
};
