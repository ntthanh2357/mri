import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const checkJwt = async () => {
  try {
    // 1. Get token from running server
    const loginRes = await fetch("http://localhost:3000/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "receptionist@neuroscan.com",
        password: "123456"
      })
    });

    const loginData = await loginRes.json();
    if (!loginRes.ok) {
      console.error("Login failed:", loginData);
      return;
    }

    const token = loginData.accessToken;
    console.log("Token obtained from server successfully!");
    console.log("Token length:", token ? token.length : "undefined");

    if (!token) {
      console.error("No token found in response:", loginData);
      return;
    }

    // 2. Decode token without verification to see payload
    const decodedNoVerify = jwt.decode(token);
    console.log("Decoded payload (no verification):", decodedNoVerify);

    // 3. Try to verify using the .env secret
    const envSecret = process.env.JWT_SECRET;
    console.log(`.env JWT_SECRET: '${envSecret}'`);

    try {
      const verified = jwt.verify(token, envSecret);
      console.log("Verification with .env secret: SUCCESS!");
      console.log("Verified payload:", verified);
    } catch (err) {
      console.log("Verification with .env secret: FAILED!");
      console.log("Error name:", err.name);
      console.log("Error message:", err.message);
    }

    // 4. Try to verify using the default fallback secret "access_secret"
    const fallbackSecret = "access_secret";
    try {
      const verified = jwt.verify(token, fallbackSecret);
      console.log("Verification with fallback secret 'access_secret': SUCCESS!");
      console.log("Verified payload:", verified);
    } catch (err) {
      console.log("Verification with fallback secret 'access_secret': FAILED!");
      console.log("Error name:", err.name);
      console.log("Error message:", err.message);
    }

  } catch (error) {
    console.error("Error in diagnostic:", error);
  }
};

checkJwt();
