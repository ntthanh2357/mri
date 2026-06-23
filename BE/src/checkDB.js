import mongoose from "mongoose";
import { User } from "./models/user.model.js";
import { Hospital } from "./models/hospital.model.js";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/neuro";

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Hospitals:");
  const hospitals = await Hospital.find();
  console.log(hospitals);

  console.log("\nUsers:");
  const users = await User.find().select("email role hospitalId");
  console.log(users);

  await mongoose.disconnect();
}
run();
