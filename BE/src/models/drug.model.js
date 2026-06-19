import { Schema, model } from "mongoose";

const drugSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    category: {
      type: String,
      enum: ["anticonvulsant", "corticosteroid", "psychotropic", "pain_reliever", "other"],
      default: "other",
    },
    dosageInstructions: {
      type: String,
      default: "",
    },
    bmiWarningThreshold: {
      min: { type: Number, default: 18.5 },
      max: { type: Number, default: 25.0 },
    },
    interactions: [
      {
        type: String, // Tên hoạt chất/thuốc gây tương tác có hại
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const Drug = model("Drug", drugSchema);
export default Drug;
