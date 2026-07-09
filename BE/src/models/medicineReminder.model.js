import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../plugins/tenancy.plugin.js";

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
