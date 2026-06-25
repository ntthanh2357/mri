import fetch from "node-fetch";

const run = async () => {
  try {
    console.log("1. Logging in as technician2@neuroscan.com...");
    const loginRes = await fetch("http://localhost:3000/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "technician2@neuroscan.com",
        password: "123456"
      })
    });
    
    if (!loginRes.ok) {
      const err = await loginRes.text();
      throw new Error(`Login failed: ${err}`);
    }

    const loginData = await loginRes.json();
    console.log("Login response:", JSON.stringify(loginData, null, 2));
    const token = loginData.accessToken;
    console.log("Token:", token ? (token.substring(0, 20) + "...") : "undefined");

    console.log("\n2. Calling GET /api/v1/visits/my-queue...");
    const queueRes = await fetch("http://localhost:3000/api/v1/visits/my-queue", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!queueRes.ok) {
      const err = await queueRes.text();
      throw new Error(`Fetch queue failed: ${err}`);
    }

    const queueData = await queueRes.json();
    console.log("Queue response:", JSON.stringify(queueData, null, 2));

  } catch (error) {
    console.error("Test failed:", error);
  }
};

run();
