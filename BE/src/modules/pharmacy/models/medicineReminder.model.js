import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../../../plugins/tenancy.plugin.js";

const medicineReminderSchema = new Schema(
  {
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    prescriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Prescription",
      required: true,
      index: true,
    },
    drugName: {
      type: String,
      required: true,
    },
    dosageText: {
      type: String,
      default: "",
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    time: {
      type: String, // "HH:MM"
      required: true,
    },
    // UC-PAT-13: khung Sáng/Trưa/Chiều/Tối để đổi giờ theo cài đặt của bệnh nhân ("" = lịch cũ, suy ra từ giờ)
    slot: {
      type: String,
      enum: ["", "morning", "noon", "afternoon", "evening"],
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "done", "skipped"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

medicineReminderSchema.index({ patientId: 1, date: 1, time: 1 });
medicineReminderSchema.plugin(tenancyPlugin);

export const MedicineReminder = model("MedicineReminder", medicineReminderSchema, "medicine_reminders");
export default MedicineReminder;
