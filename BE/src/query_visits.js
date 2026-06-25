import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import { Visit } from "./models/visit.model.js";
import { User } from "./models/user.model.js";

dotenv.config();

const query = async () => {
  await connectDB();
  
  const users = await User.find({});
  console.log("USERS IN DATABASE:");
  users.forEach(u => {
    console.log(`- ID: ${u._id}, Email: ${u.email}, Role: ${u.role}, HospitalId: ${u.hospitalId}`);
  });

  const visits = await Visit.find({}).populate("patientId").populate("technicianId");
  console.log("\nVISITS IN DATABASE:");
  visits.forEach(v => {
    console.log(`- ID: ${v._id}, Patient: ${v.patientId?.profile?.name}, TechId: ${v.technicianId?._id}, HospitalId: ${v.hospitalId}, Status: ${v.status}`);
  });

  process.exit(0);
};

query();
