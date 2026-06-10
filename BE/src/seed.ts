import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { User } from "./models/user.model";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/neuro";
// mongodb+srv://admin:[EMAIL_ADDRESS]/neuro
const seedDatabase = async () => {
  try {
    console.log("Connecting to MongoDB for seeding...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected successfully.");

    // 1. Clear existing users (Optional - keep it safe or only clear test users)
    console.log("Cleaning up test users...");
    await User.deleteMany({ email: { $in: ["admin@neuroscan.com", "doctor@neuroscan.com", "patient@neuroscan.com"] } });

    // 2. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash("123456", salt);

    // 3. Create mock users
    const mockUsers = [
      {
        email: "admin@neuroscan.com",
        phone: "+84999999991",
        passwordHash,
        role: "admin",
        isVerified: true,
        profile: {
          name: "Huy Hoàng Admin",
          photoUrl: "",
        },
      },
      {
        email: "doctor@neuroscan.com",
        phone: "+84999999992",
        passwordHash,
        role: "doctor",
        isVerified: true, // Approved
        profile: {
          name: "Bác sĩ Gia Huy",
          photoUrl: "",
          licenseUrl: "https://storage.googleapis.com/neuroscan-cchn/cchn_gia_huy.pdf", // Mock certificate
        },
      },
      {
        email: "patient@neuroscan.com",
        phone: "+84999999993", // Can use the test phone number here
        passwordHash,
        role: "patient",
        isVerified: true,
        profile: {
          name: "Bệnh nhân Tuấn Thành",
          photoUrl: "",
          bhytNumber: "GD4797932200123",
        },
      },
    ];

    console.log("Inserting seed users...");
    const createdUsers = await User.insertMany(mockUsers);
    console.log("Created users:", createdUsers.map(u => `${u.email} (${u.role})`));

    console.log("Seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
};

seedDatabase();
