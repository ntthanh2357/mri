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
    otpCode: {
      type: String,
      default: null,
    },
    otpExpires: {
      type: Date,
      default: null,
    },
    wardId: {
      type: String,
      default: "",
      trim: true,
    },
    departmentId: {
      type: String,
      default: "KNT",
      trim: true,
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
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

export const User = model("User", userSchema);
