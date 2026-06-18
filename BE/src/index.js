import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./config/db.js";
import routes from "./routes/index.js";
import { errorHandler } from "./middlewares/error.middleware.js";
// Initialize Firebase config
import "./config/firebase.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Serve uploaded files (fallback khi GCS chưa cấu hình)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Main Router (includes /auth and /api/v1)
app.use("/", routes);

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Kết nối thành công đến API NeuroScan AI (BE)!" });
});

app.get("/ping", (req, res) => {
  res.json({ message: "pong", timestamp: new Date() });
});

// Global Error Handler Middleware
app.use(errorHandler);

// Database connection & start server
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend server is running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database connection failed during boot:", error);
    process.exit(1);
  });
