import { Schema, model } from "mongoose";

const workScheduleSchema = new Schema(
  {
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    shift: {
      type: String,
      enum: ["sáng", "chiều", "tối", "cả ngày"],
      required: true,
    },
    startTime: {
      type: String, // e.g. "07:00"
      default: "",
    },
    endTime: {
      type: String, // e.g. "15:00"
      default: "",
    },
    role: {
      type: String, // e.g. doctor, nurse, technician
      default: "",
    },
    notes: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["confirmed", "pending", "off"],
      default: "confirmed",
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to quickly find schedules for a hospital in a date range
workScheduleSchema.index({ hospitalId: 1, date: 1 });
// Avoid duplicate shifts for the same staff member on the same date
workScheduleSchema.index({ staffId: 1, date: 1, shift: 1 }, { unique: true });

export const WorkSchedule = model("WorkSchedule", workScheduleSchema);
export default WorkSchedule;
