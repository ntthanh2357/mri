import { Schema, model } from "mongoose";

const swapRequestSchema = new Schema(
  {
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    requesterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    scheduleId: {
      type: Schema.Types.ObjectId,
      ref: "WorkSchedule",
      required: true,
    },
    // The staff member to swap shifts with (optional, if none, it's an open request or shift giveaway)
    targetStaffId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    targetDate: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewNotes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

swapRequestSchema.index({ hospitalId: 1, status: 1 });

export const SwapRequest = model("SwapRequest", swapRequestSchema);
export default SwapRequest;
