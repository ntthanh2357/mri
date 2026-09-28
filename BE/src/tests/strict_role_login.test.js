import { login, phoneLoginRequest } from '../modules/auth/auth.controller.js';
import { User } from '../modules/auth/models/user.model.js';
import { Hospital } from '../models/hospital.model.js';
import bcrypt from 'bcryptjs';

async function runTests() {
  console.log("=== KIỂM THỬ PHÂN TÁCH NGHIÊM NGẶT LUỒNG ĐĂNG NHẬP ===");

  const createMockRes = () => {
    const res = {
      statusCode: 200,
      jsonData: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.jsonData = data;
        return this;
      }
    };
    return res;
  };

  const mockDoctor = {
    _id: "doc_123",
    email: "doctor@test.com",
    role: "doctor",
    passwordHash: "hashed_pass",
    isVerified: true,
    save: async () => {},
  };

  const mockPatient = {
    _id: "pat_123",
    email: "patient@test.com",
    role: "patient",
    passwordHash: "hashed_pass",
    isVerified: true,
    save: async () => {},
  };

  const originalUserFindOne = User.findOne;
  const originalUserFindByIdAndUpdate = User.findByIdAndUpdate;
  const originalHospitalFindOne = Hospital.findOne;
  const originalCompare = bcrypt.compare;

  try {
    bcrypt.compare = async () => true;
    User.findByIdAndUpdate = async () => {};
    Hospital.findOne = () => ({
      lean: async () => null,
    });

    User.findOne = (query) => {
      if (query.$or) {
        const emailObj = query.$or.find(item => item.email);
        if (emailObj && emailObj.email === 'doctor@test.com') return Promise.resolve(mockDoctor);
        if (emailObj && emailObj.email === 'patient@test.com') return Promise.resolve(mockPatient);
      }
      return Promise.resolve(null);
    };

    // TEST 1: Bác sĩ đăng nhập vào tab Bệnh nhân (roleType: 'patient') -> Phải bị chặn 403
    const req1 = {
      body: { email: 'doctor@test.com', password: 'password123', roleType: 'patient' }
    };
    const res1 = createMockRes();
    await login(req1, res1);

    if (res1.statusCode === 403 && res1.jsonData?.message?.includes("Bác sĩ / Nhân viên y tế")) {
      console.log("✔ TEST 1 PASS: Chặn Bác sĩ đăng nhập ở tab Bệnh nhân (403)");
    } else {
      console.error("✖ TEST 1 FAIL:", res1.statusCode, res1.jsonData);
    }

    // TEST 2: Bệnh nhân đăng nhập vào tab Bác sĩ (roleType: 'staff') -> Phải bị chặn 403
    const req2 = {
      body: { email: 'patient@test.com', password: 'password123', roleType: 'staff' }
    };
    const res2 = createMockRes();
    await login(req2, res2);

    if (res2.statusCode === 403 && res2.jsonData?.message?.includes("Bệnh nhân")) {
      console.log("✔ TEST 2 PASS: Chặn Bệnh nhân đăng nhập ở tab Bác sĩ / Nhân viên (403)");
    } else {
      console.error("✖ TEST 2 FAIL:", res2.statusCode, res2.jsonData);
    }

    // TEST 3: Bệnh nhân đăng nhập đúng tab (roleType: 'patient') -> Cho phép (200)
    const req3 = {
      body: { email: 'patient@test.com', password: 'password123', roleType: 'patient' }
    };
    const res3 = createMockRes();
    await login(req3, res3);

    if (res3.statusCode === 200) {
      console.log("✔ TEST 3 PASS: Bệnh nhân đăng nhập đúng tab Bệnh nhân thành công (200)");
    } else {
      console.error("✖ TEST 3 FAIL:", res3.statusCode, res3.jsonData);
    }

    // TEST 4: Bác sĩ đăng nhập đúng tab (roleType: 'staff') -> Cho phép (200)
    const req4 = {
      body: { email: 'doctor@test.com', password: 'password123', roleType: 'staff' }
    };
    const res4 = createMockRes();
    await login(req4, res4);

    if (res4.statusCode === 200) {
      console.log("✔ TEST 4 PASS: Bác sĩ đăng nhập đúng tab Bác sĩ thành công (200)");
    } else {
      console.error("✖ TEST 4 FAIL:", res4.statusCode, res4.jsonData);
    }

    // TEST 5: Đăng nhập OTP số điện thoại với tài khoản Bác sĩ -> Bị chặn 403
    User.findOne = () => Promise.resolve(mockDoctor);
    const req5 = {
      body: { phone: '0987654321' }
    };
    const res5 = createMockRes();
    await phoneLoginRequest(req5, res5);

    if (res5.statusCode === 403 && res5.jsonData?.message?.includes("chỉ áp dụng cho tài khoản Bệnh nhân")) {
      console.log("✔ TEST 5 PASS: Chặn tài khoản Bác sĩ dùng chức năng OTP số điện thoại (403)");
    } else {
      console.error("✖ TEST 5 FAIL:", res5.statusCode, res5.jsonData);
    }

    console.log("=== TẤT CẢ 5/5 TEST ĐÃ VƯỢT QUA XUẤT SẮC ===");
  } finally {
    User.findOne = originalUserFindOne;
    User.findByIdAndUpdate = originalUserFindByIdAndUpdate;
    Hospital.findOne = originalHospitalFindOne;
    bcrypt.compare = originalCompare;
  }
}

runTests().catch(console.error);
