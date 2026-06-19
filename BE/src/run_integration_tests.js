import { spawn } from "child_process";

const PORT = 3031;
const BASE_URL = `http://localhost:${PORT}`;

console.log("🚀 Bắt đầu quy trình kiểm nghiệm tích hợp hệ thống tự động...");

// Khởi chạy server ở tiến trình con
const serverProcess = spawn("node", ["src/index.js"], {
  env: {
    ...process.env,
    PORT: PORT.toString(),
  },
  shell: true,
});

let serverOutput = "";
serverProcess.stdout.on("data", (data) => {
  const text = data.toString();
  serverOutput += text;
  console.log(`[Server] ${text.trim()}`);
});

serverProcess.stderr.on("data", (data) => {
  console.error(`[Server Error] ${data.toString().trim()}`);
});

// Chờ server khởi động thành công
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runTests = async () => {
  try {
    // Chờ 3 giây để server kết nối DB và listen port
    await delay(3000);
    console.log("\n🧪 Khởi động các ca kiểm thử tích hợp...");

    let doctorToken = "";
    let patientToken = "";
    let nurseToken = "";
    let patientUserId = "";

    // ─── 1. Đăng nhập với các role khác nhau ───
    console.log("\n1. Kiểm thử Đăng nhập tài khoản & Nhận diện phiên");
    
    // Đăng nhập Bác sĩ
    const loginDocRes = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "doctor@neuroscan.com", password: "123456" }),
    });
    const docData = await loginDocRes.json();
    if (loginDocRes.ok && docData.accessToken) {
      doctorToken = docData.accessToken;
      console.log("   ✅ Đăng nhập Bác sĩ thành công.");
    } else {
      throw new Error(`Đăng nhập Bác sĩ thất bại: ${JSON.stringify(docData)}`);
    }

    // Đăng nhập Điều dưỡng
    const loginNurseRes = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nurse@neuroscan.com", password: "123456" }),
    });
    const nurseData = await loginNurseRes.json();
    if (loginNurseRes.ok && nurseData.accessToken) {
      nurseToken = nurseData.accessToken;
      console.log("   ✅ Đăng nhập Điều dưỡng thành công.");
    } else {
      throw new Error(`Đăng nhập Điều dưỡng thất bại: ${JSON.stringify(nurseData)}`);
    }

    // Đăng nhập Bệnh nhân
    const loginPatRes = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "patient@neuroscan.com", password: "123456" }),
    });
    const patData = await loginPatRes.json();
    if (loginPatRes.ok && patData.accessToken) {
      patientToken = patData.accessToken;
      patientUserId = patData.user?.id || patData.user?._id;
      console.log(`   ✅ Đăng nhập Bệnh nhân thành công. PatientId: ${patientUserId}`);
    } else {
      throw new Error(`Đăng nhập Bệnh nhân thất bại: ${JSON.stringify(patData)}`);
    }

    // ─── 2. Kiểm tra Session Persistence (Lấy thông tin tài khoản hiện tại) ───
    console.log("\n2. Kiểm thử Session Persistence (Xác thực /auth/me)");
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: {
        "Authorization": `Bearer ${doctorToken}`,
      },
    });
    const meData = await meRes.json();
    if (meRes.ok && meData.user?.email === "doctor@neuroscan.com") {
      console.log("   ✅ Trích xuất trạng thái phiên thành công (Session persistent).");
    } else {
      throw new Error(`Không thể xác thực trạng thái phiên đăng nhập: ${JSON.stringify(meData)}`);
    }

    // ─── 3. Kiểm thử Smart Prescription Safety Checker ───
    console.log("\n3. Kiểm thử Kê đơn thông minh (Clinical Warnings API)");
    
    // Tương tác thuốc Keppra + Depakine & Dị ứng Gadolinium
    const checkRes = await fetch(`${BASE_URL}/api/drugs/check-prescription`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${doctorToken}`,
      },
      body: JSON.stringify({
        patientId: patientUserId || "60d21b4667d0d8992e610c85",
        medications: ["Keppra", "Depakine"],
        orders: ["Chụp MRI sọ não có tiêm thuốc cản từ Gadolinium"],
      }),
    });
    const checkData = await checkRes.json();
    if (checkRes.ok && checkData.data) {
      const warnings = checkData.data.warnings || [];
      const hasInteraction = warnings.some(w => w.type === "INTERACTION");
      const hasAllergy = warnings.some(w => w.type === "ALLERGY_ADR");

      if (hasInteraction && hasAllergy) {
        console.log("   ✅ Phát hiện và cảnh báo thành công tương tác thuốc Keppra-Depakine.");
        console.log("   ✅ Phát hiện và cảnh báo thành công dị ứng thuốc cản từ Gadolinium.");
      } else {
        throw new Error(`Cảnh báo lâm sàng bị thiếu hoặc sai: ${JSON.stringify(warnings)}`);
      }
    } else {
      throw new Error(`Gọi API cảnh báo đơn thuốc thất bại: ${JSON.stringify(checkData)}`);
    }

    // ─── 4. Kiểm thử Quản lý EMR và Ghi nhận lịch sử (Versioning) ───
    console.log("\n4. Kiểm thử Quản lý bệnh án & Ghi nhận lịch sử (EMR Versioning)");
    
    // Lấy danh sách bệnh án
    const getRecordsRes = await fetch(`${BASE_URL}/emr/records`, {
      headers: { "Authorization": `Bearer ${doctorToken}` },
    });
    const recordsData = await getRecordsRes.json();
    if (getRecordsRes.ok && Array.isArray(recordsData.data) && recordsData.data.length > 0) {
      const record = recordsData.data[0];
      const recordId = record._id;
      console.log(`   ✅ Tải danh sách bệnh án thành công. Chọn bệnh án ID: ${recordId}`);

      // Thực hiện cập nhật chẩn đoán (Tạo phiên bản mới)
      const updateRes = await fetch(`${BASE_URL}/emr/records/${recordId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${doctorToken}`,
        },
        body: JSON.stringify({
          diagnosis: `Chẩn đoán mới thử nghiệm lâm sàng lúc ${new Date().toLocaleTimeString()}`,
          treatmentPlan: "Kế hoạch điều trị cập nhật: Uống Keppra 500mg mỗi ngày.",
        }),
      });
      const updateData = await updateRes.json();
      if (updateRes.ok) {
        console.log(`   ✅ Cập nhật chẩn đoán bệnh án thành công (Sinh phiên bản v${updateData.data?.currentVersion || 2}).`);

        // Lấy lịch sử sửa đổi bệnh án
        const getVersionsRes = await fetch(`${BASE_URL}/emr/records/${recordId}/versions`, {
          headers: { "Authorization": `Bearer ${doctorToken}` },
        });
        const versionsData = await getVersionsRes.json();
        if (getVersionsRes.ok && Array.isArray(versionsData.data) && versionsData.data.length > 0) {
          console.log(`   ✅ Truy xuất lịch sử thay đổi thành công. Phát hiện ${versionsData.data.length} phiên bản chỉnh sửa.`);
          console.log(`      Phiên bản mới nhất lưu bởi: ${versionsData.data[0].modifiedBy}`);
        } else {
          throw new Error("Không thể lấy lịch sử phiên bản bệnh án.");
        }
      } else {
        throw new Error(`Cập nhật bệnh án thất bại: ${JSON.stringify(updateData)}`);
      }
    } else {
      throw new Error(`Không tải được danh sách bệnh án hoặc chưa được seed: ${JSON.stringify(recordsData)}`);
    }

    // ─── 5. Kiểm thử LIS Receiver Simulator ───
    console.log("\n5. Kiểm thử LIS Receiver (Kết nối thiết bị xét nghiệm)");
    const lisPayload = {
      barcode: "PREOP-NEURO-001",
      results: [
        { code: "GLU", value: 8.5 },
        { code: "AST", value: 45.0 }
      ]
    };
    const lisRes = await fetch(`${BASE_URL}/api/lis/receiver`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${doctorToken}`,
      },
      body: JSON.stringify(lisPayload),
    });
    const lisData = await lisRes.json();
    if (lisRes.ok && lisData.success) {
      console.log("   ✅ LIS Simulator gửi kết quả xét nghiệm thành công.");
    } else {
      throw new Error(`LIS gửi kết quả thất bại: ${JSON.stringify(lisData)}`);
    }

    console.log("\n🎉 HOÀN TẤT: Toàn bộ 5 ca kiểm thử tích hợp chính đều THÀNH CÔNG 100%!");
    
  } catch (error) {
    console.error("\n❌ Gặp lỗi trong quá trình kiểm thử tích hợp:");
    console.error(error);
    process.exitCode = 1;
  } finally {
    // Dừng server
    console.log("\n🛑 Đang tắt tiến trình server...");
    serverProcess.kill("SIGTERM");
    process.exit();
  }
};

runTests();
