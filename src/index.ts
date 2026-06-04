import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/neuro";

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use("/auth", authRoutes);

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Kết nối thành công đến API NeuroScan AI!" });
});

app.get("/ping", (req, res) => {
  res.json({ message: "pong", timestamp: new Date() });
});

// Database connection
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("Successfully connected to MongoDB Cloud Database");
    // Start Express server
    app.listen(PORT, () => {
      console.log(`Backend server is running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database connection failed:", error);
    process.exit(1);
  });
