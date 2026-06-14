import { Schema, model, Document } from "mongoose";

export interface IDataset extends Document {
  name: string;
  description: string;
  price: number;
  status: "active" | "inactive" | "pending";
  createdAt: Date;
  updatedAt: Date;
}

const datasetSchema = new Schema<IDataset>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    price: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "pending"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

export const Dataset = model<IDataset>("Dataset", datasetSchema);
