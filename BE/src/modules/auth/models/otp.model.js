import { Schema, model } from "mongoose";

const otpSchema = new Schema(
  {
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    otpCode: {
      type: String,
      required: true,
    },
    otpExpires: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically delete expired OTP documents
otpSchema.index({ otpExpires: 1 }, { expireAfterSeconds: 0 });

export const Otp = model("Otp", otpSchema);
