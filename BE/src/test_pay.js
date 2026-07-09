import fetch from "node-fetch";

const runTest = async (email, roleName) => {
  console.log(`\n=== TESTING AS ${roleName} (${email}) ===`);
  try {
    // 1. Log in
    const loginRes = await fetch("http://localhost:3000/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "123456"
      })
    });

    const loginData = await loginRes.json();
    if (!loginRes.ok) {
      console.error(`Login failed for ${email}:`, loginData);
      return;
    }

    const token = loginData.accessToken;
    console.log(`Logged in successfully! Role: ${loginData.user?.role}`);

    // 2. Attempt to pay the first invoice
    const invoiceId = "6a3dd5c3b7c53686ae049ce4";
    console.log(`Sending PUT to pay invoice ${invoiceId}...`);
    
    const payRes = await fetch(`http://localhost:3000/api/v1/invoices/${invoiceId}/pay`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ paymentMethod: "cash" })
    });

    const payData = await payRes.json();
    console.log(`Status code: ${payRes.status}`);
    console.log("Response data:", JSON.stringify(payData, null, 2));

  } catch (error) {
    console.error("Error during test:", error);
  }
};

const main = async () => {
  // Test as receptionist
  await runTest("receptionist@neuroscan.com", "RECEPTIONIST");
};

main();
