import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../plugins/tenancy.plugin.js";

const medicalRecordSchema = new Schema(
  {
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: 'Hospital',
      required: true,
      index: true,
    },
    patientId: {
      type: String,
      required: true,
      trim: true,
    },
    patientName: {
      type: String,
      required: true,
      trim: true,
    },
    gender: {
      type: String,
      enum: ["Nam", "Nữ", "Khác"],
      default: "Nam",
    },
    age: {
      type: Number,
      required: true,
    },

    admissionType: {
      type: String,
      enum: ["Ngoại trú", "Nội trú", "Cấp cứu"],
      default: "Ngoại trú",
    },
    department: {
      type: String,
      required: true,
      default: "Khoa Nội Thần Kinh",
    },
    paymentMethod: {
      type: String,
      enum: ["BHYT", "Viện phí", "Dịch vụ"],
      default: "Viện phí",
    },
    diagnosis: {
      type: String,
      required: true,
      default: "",
    },
    treatmentPlan: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["Đang điều trị", "Xuất viện", "Cấp cứu"],
      default: "Đang điều trị",
    },
    dischargeDate: {
      type: Date,
      default: null,
    },
    doctorInCharge: {
      type: String,
      required: true,
    },
    signStatus: {
      type: String,
      enum: ["Chưa duyệt", "Đã duyệt", "Đã ký số"],
      default: "Chưa duyệt",
    },
    allergies: [
      {
        type: String,
      },
    ],
    wardId: {
      type: String,
      default: "",
      trim: true,
    },
    currentVersion: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

medicalRecordSchema.plugin(tenancyPlugin);

export const MedicalRecord = model("MedicalRecord", medicalRecordSchema);
export default MedicalRecord;
