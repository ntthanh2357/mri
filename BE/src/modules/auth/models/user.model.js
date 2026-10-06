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
      enum: ["patient", "doctor", "admin", "hospital_admin", "technician", "nurse", "receptionist"],
      default: "patient",
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
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
    // Cơ chế chống Brute-force mật khẩu (khóa tạm 15 phút sau 5 lần nhập sai)
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    otpCode: {
      type: String,
      default: null,
    },
    otpExpires: {
      type: Date,
      default: null,
    },
    // [2FA] Mã OTP xác thực 2 lớp khi đăng nhập (riêng biệt với otpCode dùng
    // cho kích hoạt tài khoản / quên mật khẩu để tránh xung đột luồng)
    otp2FACode: {
      type: String,
      default: null,
    },
    otp2FAExpires: {
      type: Date,
      default: null,
    },
    otp2FAAttempts: {
      type: Number,
      default: 0,
    },
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
      birthYear: { type: Number, default: null },
      gender: { type: String, enum: ['Nam', 'Nữ', 'Khác', ''], default: '' },
      age: { type: Number, default: null },
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
