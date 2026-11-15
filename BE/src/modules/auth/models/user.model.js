import { Schema, model } from "mongoose";

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null/undefined values
      trim: true,
    },
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: 'Hospital',
      default: null,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      // system_admin: quản trị nền tảng SaaS (không gắn bệnh viện)
      // cleaner: nhân viên vệ sinh — chỉ dùng cho bước "hoàn tất dọn giường"
      // radiologist: Bác sĩ Chẩn đoán hình ảnh (Khoa CĐHA - KCDHA)
      // department_head: Trưởng khoa lâm sàng (Khoa Ung thư Não - KUTN)
      enum: ["patient", "doctor", "radiologist", "department_head", "admin", "system_admin", "hospital_admin", "technician", "lab_technician", "nurse", "receptionist", "pharmacist", "cleaner"],
      default: "patient",
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isTestAccount: {
      type: Boolean,
      default: false,
      index: true,
    },
    tokenVersion: {
      type: Number,
      default: 0,
      required: true,
    },
    isLocked: {
      type: Boolean,
      default: false,
    },
    // [P2-4] Xóa mềm: giữ ObjectId để Visit/Invoice/Prescription/EMR không mồ côi.
    // Khi xóa, PII trong hồ sơ được ẩn danh hóa; tài khoản không thể đăng nhập lại.
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    // Cơ chế chống Brute-force mật khẩu (khóa tạm 15 phút sau 5 lần nhập sai)
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    // HMAC của mã OTP (utils/accountOtp.util.js), không lưu mã gốc; ẩn khỏi mọi truy vấn mặc định
    otpCode: {
      type: String,
      default: null,
      select: false,
    },
    otpExpires: {
      type: Date,
      default: null,
    },
    // Giới hạn dò mã cho otpCode (quên mật khẩu, kích hoạt, đăng nhập SĐT)
    otpAttempts: {
      type: Number,
      default: 0,
    },
    otpLastSentAt: {
      type: Date,
      default: null,
    },
    // Xác thực bước 2 (step-up) trước thao tác nhạy cảm: hiện dùng khi duyệt hoàn tiền
    stepUpOtpHash: {
      type: String,
      default: null,
      select: false,
    },
    stepUpOtpExpires: {
      type: Date,
      default: null,
    },
    stepUpOtpAttempts: {
      type: Number,
      default: 0,
    },
    stepUpOtpLastSentAt: {
      type: Date,
      default: null,
    },
    stepUpVerifiedAt: {
      type: Date,
      default: null,
    },
    // Quyền ký báo cáo CĐHA cấp theo từng người (Trưởng khoa lâm sàng không tự động có phạm vi
    // hành nghề hình ảnh - NĐ 96/2023 Điều 41). Hospital Admin cấp sau khi đã đối chiếu giấy phép.
    canSignImaging: {
      type: Boolean,
      default: false,
    },
    // [2FA] Mã OTP xác thực 2 lớp khi đăng nhập (riêng biệt với otpCode dùng
    // cho kích hoạt tài khoản / quên mật khẩu để tránh xung đột luồng)
    otp2FACode: {
      type: String,
      default: null,
      select: false,
    },
    otp2FAExpires: {
      type: Date,
      default: null,
    },
    otp2FAAttempts: {
      type: Number,
      default: 0,
    },
    // Giám sát an ninh đăng nhập & Định vị địa lý IP (HIPAA & TT 13/2025/TT-BYT)
    lastLoginIp: {
      type: String,
      default: "",
      trim: true,
    },
    lastLoginLocation: {
      country: { type: String, default: "" },
      countryCode: { type: String, default: "" },
      region: { type: String, default: "" },
      city: { type: String, default: "" },
      timezone: { type: String, default: "" },
      lat: { type: Number, default: null },
      lon: { type: Number, default: null },
      isp: { type: String, default: "" },
      displayLocation: { type: String, default: "" },
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    loginHistory: [
      {
        ip: { type: String, default: "" },
        location: { type: String, default: "" },
        device: { type: String, default: "" },
        loggedInAt: { type: Date, default: Date.now },
      },
    ],
    wardId: {
      type: String,
      default: "",
      trim: true,
    },
    departmentId: {
      type: String,
      default: "KUTN", // Chuẩn Khoa Ung Thư Não (KUTN-SURG, KUTN-ICU, KUTN-CHEMO, KUTN-PAL, KUTN-CLI, KCDHA, KD, KXN)
      trim: true,
    },
    // Phân công trực cấp cứu y khoa (Emergency Duty Assignment - Admin / Trưởng khoa cấp)
    emergencyDuty: {
      isAssigned: { type: Boolean, default: false },
      assignedAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null }, // Thời hạn ca trực có hiệu lực
      assignedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      shiftType: { type: String, enum: ['day_shift', 'night_shift', 'weekend_shift', 'acute_code_blue', null], default: null },
      department: { type: String, default: null }
    },
    profile: {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      fullName: { type: String, default: "", trim: true },
      photoUrl: {
        type: String,
        default: "",
      },
      medicalId: {
        type: String,
        default: "",
        trim: true,
        index: true,
      },
      licenseUrl: {
        type: String,
        default: "",
      },
      address: {
        type: String,
        default: "",
        trim: true,
      },
      dob: { type: Date, default: null },
      birthYear: { type: Number, default: null },
      gender: { type: String, enum: ['Nam', 'Nữ', 'Khác', ''], default: '' },
      age: { type: Number, default: null },
      // UC-REC-01 — Định danh bệnh nhân tại quầy tiếp đón
      // CCCD lưu dạng băm HMAC (tra cứu chính xác) + 4 số cuối để hiển thị, không lưu bản rõ
      cccdHash: { type: String, default: null, index: true },
      cccdLast4: { type: String, default: '' },
      phoneLast4: { type: String, default: '' },
      // Email nhận thông báo (lịch khám, dời lịch MRI, hoàn tiền) — tách riêng khỏi email đăng nhập duy nhất để có thể dùng email của tài khoản/người nhà đã tồn tại
      notificationEmail: { type: String, default: '', lowercase: true, trim: true },
      registeredAtDeskBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      // Module O — bổ sung cho nhân viên y tế
      specialty: { type: String, default: '' }, // neuroradiologist | neurosurgeon | general
      isOnCall: { type: Boolean, default: false }, // Đang trực ca
      maxCaseload: { type: Number, default: 10 }, // Tối đa ca/ca trực
      currentCaseload: { type: Number, default: 0 }, // Số ca đang xử lý
      fcmToken: { type: String, default: null }, // Firebase Cloud Messaging token (J.4)
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

export const User = model("User", userSchema);
