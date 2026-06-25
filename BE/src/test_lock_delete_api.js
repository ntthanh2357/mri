import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { User } from "./models/user.model.js";
import { Hospital } from "./models/hospital.model.js";
import { connectDB } from "./config/db.js";

dotenv.config();

const generateAccessToken = (userId, role, tokenVersion, hospitalId) => {
  const secret = process.env.JWT_SECRET || "access_secret";
  return jwt.sign({ id: userId, role, tokenVersion, hospitalId }, secret, { expiresIn: "1h" });
};

(async () => {
  try {
    console.log("Connecting to Database...");
    await connectDB();

    // 1. Get or create admin user
    console.log("Finding or creating admin user...");
    let admin = await User.findOne({ role: "admin" });
    if (!admin) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash("123456", salt);
      admin = await User.create({
        email: "system_admin@neuroscan.com",
        passwordHash,
        role: "admin",
        isVerified: true,
        profile: { name: "System Admin" }
      });
      console.log("Created default system admin user.");
    }
    const adminToken = generateAccessToken(admin._id.toString(), admin.role, admin.tokenVersion || 0, null);

    // 2. Create test hospital
    console.log("Creating test hospital...");
    // Ensure clean state first
    await Hospital.deleteMany({ code: "HOSP_TEST" });
    await User.deleteMany({ email: "doc_test@neuroscan.com" });

    const hospital = await Hospital.create({
      name: "Test Lock Hospital",
      code: "HOSP_TEST",
      isActive: true,
      status: "active"
    });
    console.log(`Created test hospital: ${hospital.name} (${hospital.code}), isActive: ${hospital.isActive}`);

    // 3. Create staff user for hospital
    console.log("Creating staff user...");
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash("123456", salt);
    const staff = await User.create({
      email: "doc_test@neuroscan.com",
      passwordHash,
      role: "doctor",
      hospitalId: hospital._id,
      isVerified: true,
      profile: { name: "Test Doctor" }
    });
    console.log(`Created staff: ${staff.email} with hospitalId: ${staff.hospitalId}`);

    // 4. Try login as staff
    console.log("\n--- Testing Login with Active Hospital ---");
    const loginRes = await fetch("http://localhost:3000/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "doc_test@neuroscan.com", password: "123456" })
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) {
      throw new Error(`Login should succeed but failed: ${JSON.stringify(loginData)}`);
    }
    console.log("✅ Login succeeded when hospital is active!");

    // 5. Call API toggle lock to deactivate hospital
    console.log("\n--- Deactivating hospital via Admin API ---");
    const lockRes = await fetch(`http://localhost:3000/api/v1/admin/hospitals/${hospital._id}/toggle-lock`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${adminToken}`,
        "Content-Type": "application/json"
      }
    });
    const lockData = await lockRes.json();
    if (!lockRes.ok) {
      throw new Error(`Lock request failed: ${JSON.stringify(lockData)}`);
    }
    console.log("API Response:", lockData.message);

    // Verify DB updated
    const updatedHospital = await Hospital.findById(hospital._id);
    console.log("Hospital isActive in DB:", updatedHospital.isActive);
    if (updatedHospital.isActive !== false) {
      throw new Error("Hospital isActive should be false!");
    }
    console.log("✅ Hospital is now deactivated in DB!");

    // 6. Try login as staff (should fail with 403)
    console.log("\n--- Testing Login with Deactivated Hospital ---");
    const loginRes2 = await fetch("http://localhost:3000/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "doc_test@neuroscan.com", password: "123456" })
    });
    const loginData2 = await loginRes2.json();
    console.log("Login HTTP Status:", loginRes2.status);
    console.log("Login Message:", loginData2.message);
    if (loginRes2.status !== 403) {
      throw new Error("Login should have failed with status 403!");
    }
    console.log("✅ Login successfully blocked with 403 when hospital is deactivated!");

    // 7. Try fetching /auth/me or other routes using previous token (should fail with 403)
    console.log("\n--- Testing Middleware Auth with Deactivated Hospital ---");
    const meRes = await fetch("http://localhost:3000/auth/me", {
      headers: { "Authorization": `Bearer ${loginData.accessToken}` }
    });
    const meData = await meRes.json();
    console.log("Middleware Auth Status:", meRes.status);
    console.log("Middleware Auth Message:", meData.message);
    if (meRes.status !== 403) {
      throw new Error("Middleware request should have failed with status 403!");
    }
    console.log("✅ Middleware successfully blocked active session with 403 when hospital is deactivated!");

    // 8. Unlock hospital
    console.log("\n--- Re-activating hospital via Admin API ---");
    const unlockRes = await fetch(`http://localhost:3000/api/v1/admin/hospitals/${hospital._id}/toggle-lock`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${adminToken}`,
        "Content-Type": "application/json"
      }
    });
    const unlockData = await unlockRes.json();
    if (!unlockRes.ok) {
      throw new Error(`Unlock request failed: ${JSON.stringify(unlockData)}`);
    }
    console.log("API Response:", unlockData.message);
    const updatedHospital2 = await Hospital.findById(hospital._id);
    console.log("Hospital isActive in DB:", updatedHospital2.isActive);
    if (updatedHospital2.isActive !== true) {
      throw new Error("Hospital isActive should be true!");
    }
    console.log("✅ Hospital is now active in DB!");

    // Verify login works again
    const loginRes3 = await fetch("http://localhost:3000/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "doc_test@neuroscan.com", password: "123456" })
    });
    if (!loginRes3.ok) {
      throw new Error("Login should work again!");
    }
    console.log("✅ Login succeeded after hospital is reactivated!");

    // 9. Delete hospital
    console.log("\n--- Deleting hospital via Admin API ---");
    const deleteRes = await fetch(`http://localhost:3000/api/v1/admin/hospitals/${hospital._id}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${adminToken}`,
        "Content-Type": "application/json"
      }
    });
    const deleteData = await deleteRes.json();
    if (!deleteRes.ok) {
      throw new Error(`Delete request failed: ${JSON.stringify(deleteData)}`);
    }
    console.log("API Response:", deleteData.message);

    // Verify hospital and user are deleted in DB
    const deletedHosp = await Hospital.findById(hospital._id);
    const deletedStaff = await User.findOne({ email: "doc_test@neuroscan.com" });
    console.log("Hospital still in DB:", !!deletedHosp);
    console.log("Staff still in DB:", !!deletedStaff);
    if (deletedHosp || deletedStaff) {
      throw new Error("Hospital and associated users must be deleted!");
    }
    console.log("✅ Hospital and all associated staff users deleted successfully!");

    console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! BOTH LOCKING AND DELETING WORK PERFECTLY!");
    mongoose.connection.close();
  } catch (err) {
    console.error("❌ TEST FAILED:", err);
    mongoose.connection.close();
    process.exit(1);
  }
})();
