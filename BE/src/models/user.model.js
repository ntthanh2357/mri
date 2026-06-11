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
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["patient", "doctor", "admin"],
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
    otpCode: {
      type: String,
      default: null,
    },
    otpExpires: {
      type: Date,
      default: null,
    },
    profile: {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      photoUrl: {
        type: String,
        default: "",
      },
      bhytNumber: {
        type: String,
        default: "",
      },
      licenseUrl: {
        type: String,
        default: "",
      },
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

export const User = model("User", userSchema);
