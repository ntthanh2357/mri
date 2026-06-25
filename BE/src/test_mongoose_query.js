import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import { Visit } from "./models/visit.model.js";
import { User } from "./models/user.model.js";

dotenv.config();

const run = async () => {
  await connectDB();

  // Variables as extracted in visit.controller.js
  const role = "technician";
  const id = "6a3caccbb92fc2409e27b25a";
  const hospitalId = "6a3caccab92fc2409e27b245";

  let filter = { hospitalId };
  if (role === "technician") {
    filter.technicianId = id;
    filter.status = { $in: ["chờ chụp", "đang chụp", "chờ kết quả AI", "chờ bác sĩ đọc", "hoàn tất"] };
  }

  console.log("Query filter:", JSON.stringify(filter, null, 2));

  const visits = await Visit.find(filter)
    .populate("patientId", "email profile")
    .populate("doctorId", "profile.name")
    .populate("nurseId", "profile.name")
    .populate("technicianId", "profile.name");

  console.log("Found visits length:", visits.length);
  visits.forEach(v => {
    console.log(`- ID: ${v._id}, Patient: ${v.patientId?.profile?.name}, TechId: ${v.technicianId?._id}, Status: ${v.status}`);
  });

  process.exit(0);
};

run();
