import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { User } from "./models/user.model.js";
import { Hospital } from "./models/hospital.model.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/neuro";

async function run() {
  try {
    console.log("Connecting to MongoDB for hospital seeding...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected successfully.");

    // 1. Clear existing hospitals
    await Hospital.deleteMany({});
    console.log("Cleared old hospitals.");

    // 2. Create hospitals
    const bvbm = await Hospital.create({
      name: "Bệnh viện Bạch Mai",
      code: "BVBM",
      address: "78 Giải Phóng, Phương Mai, Đống Đa, Hà Nội",
      pricing: {
        examFee: 150000,
        mriFee: 1500000,
        aiFee: 200000
      }
    });

    const bvcr = await Hospital.create({
      name: "Bệnh viện Chợ Rẫy",
      code: "BVCR",
      address: "201B Nguyễn Chí Thanh, Phường 12, Quận 5, Hồ Chí Minh",
      pricing: {
        examFee: 180000,
        mriFee: 1600000,
        aiFee: 220000
      }
    });

    console.log("Seeded Hospitals:");
    console.log(`- ${bvbm.name} (ID: ${bvbm._id}, Code: ${bvbm.code})`);
    console.log(`- ${bvcr.name} (ID: ${bvcr._id}, Code: ${bvcr.code})`);

    // 3. Clear existing specific hospital admins to avoid duplicates
    await User.deleteMany({ email: { $in: ["admin.bvbm@neuroscan.com", "admin.bvcr@neuroscan.com"] } });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash("123456", salt);

    // Create hospital admins
    const hospitalAdmins = [
      {
        email: "admin.bvbm@neuroscan.com",
        phone: "+84999999111",
        passwordHash,
        role: "hospital_admin",
        hospitalId: bvbm._id,
        isVerified: true,
        profile: { name: "Quản lý Bạch Mai", photoUrl: "" }
      },
      {
        email: "admin.bvcr@neuroscan.com",
        phone: "+84999999222",
        passwordHash,
        role: "hospital_admin",
        hospitalId: bvcr._id,
        isVerified: true,
        profile: { name: "Quản lý Chợ Rẫy", photoUrl: "" }
      }
    ];

    await User.insertMany(hospitalAdmins);
    console.log("Seeded Hospital Admins (hospital_admin role).");

    // 4. Update existing staff accounts to belong to BVBM (Hospital 1)
    const updateResult = await User.updateMany(
      { email: { $in: ["doctor@neuroscan.com", "nurse@neuroscan.com", "technician@neuroscan.com", "receptionist@neuroscan.com"] } },
      { $set: { hospitalId: bvbm._id } }
    );
    console.log(`Updated ${updateResult.modifiedCount} existing staff to belong to Bệnh viện Bạch Mai.`);

    console.log("✅ Hospital Seeding Complete!");
  } catch (error) {
    console.error("Seeding failed:", error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
