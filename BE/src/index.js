import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import routes from "./routes/index.js";
import { errorHandler } from "./middlewares/error.middleware.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

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
