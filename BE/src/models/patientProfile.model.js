import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../plugins/tenancy.plugin.js";

const patientProfileSchema = new Schema(
  {
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: 'Hospital',
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    dateOfBirth: { type: Date, default: null },
    gender: {
      type: String,
      enum: ["nam", "nu", "khac", ""],
      default: "",
    },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },

    // UC-PAT-02 — bệnh nhân tự khai. CCCD & số thẻ BHYT mã hoá AES-256-GCM (services/fieldCrypto.service.js)
    citizenIdEnc: { type: String, default: "" },
    bhytDeclared: {
      cardNumberEnc: { type: String, default: "" },
      expiresAt: { type: Date, default: null },
      registrationPlace: { type: String, trim: true, default: "" },
      // "" chưa khai · pending chờ lễ tân xác nhận · verified đã đối chiếu thẻ thật · rejected sai thông tin
      status: { type: String, enum: ["", "pending", "verified", "rejected"], default: "" },
      declaredAt: { type: Date, default: null },
      verifiedAt: { type: Date, default: null },
      verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    },
    emergencyContact: {
      name: { type: String, trim: true, default: "" },
      relation: { type: String, trim: true, default: "" },
      phone: { type: String, trim: true, default: "" },
    },
    drugAllergies: { type: [String], default: [] },

    // UC-PAT-13 — giờ nhắc uống thuốc theo khung (rỗng = dùng giờ cố định mặc định)
    reminderTimes: {
      morning: { type: String, default: "" },
      noon: { type: String, default: "" },
      afternoon: { type: String, default: "" },
      evening: { type: String, default: "" },
      updatedAt: { type: Date, default: null },
    },

    // UC-PAT-06 — chữ ký đã lưu để tự điền khi ký phiếu sau (vẽ trên điện thoại hoặc gõ tên)
    savedSignature: {
      kind: { type: String, enum: ["", "drawn", "typed"], default: "" },
      svgPath: { type: String, default: "" },
      text: { type: String, trim: true, default: "" },
      updatedAt: { type: Date, default: null },
    },

    // Google Drive Personal uploads folder configurations
    driveFolderId: { type: String, default: "" },
    driveFolderUrl: { type: String, default: "" }
  },
  { timestamps: true }
);

patientProfileSchema.plugin(tenancyPlugin);

export const PatientProfile = model("PatientProfile", patientProfileSchema);
