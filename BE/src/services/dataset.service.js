import { isValidObjectId } from "mongoose";
import { Dataset } from "../models/dataset.model.js";
import { AuditLog } from "../models/auditLog.model.js";

export const getDatasets = async () => {
  return Dataset.find().lean();
};

export const createDataset = async (
  payload,
  adminId
) => {
  const dataset = await Dataset.create({
    name: payload.name,
    description: payload.description || "",
    price: payload.price ?? 0,
    status: payload.status || "pending",
  });

  await AuditLog.create({
    action: "create-dataset",
    entity: "Dataset",
    entityId: dataset._id.toString(),
    performedBy: adminId,
    details: `Dataset ${dataset.name} được tạo bởi admin`,
  });

  return dataset;
};

/**
 * Update the price of an existing dataset.
 * Requirements: 9.2, 9.3, 9.6
 *
 * @throws {Error} "INVALID_ID"    — id is not a valid ObjectId
 * @throws {Error} "INVALID_PRICE" — price is out of [0, 999_999_999]
 * @throws {Error} "NOT_FOUND"     — no dataset found with that id
 */
export const updateDatasetPrice = async (
  id,
  price,
  adminId
) => {
  // Validate ObjectId format
  if (!isValidObjectId(id)) {
    throw new Error("INVALID_ID");
  }

  // Validate price range [0, 999_999_999]
  if (typeof price !== "number" || price < 0 || price > 999_999_999) {
    throw new Error("INVALID_PRICE");
  }

  const dataset = await Dataset.findByIdAndUpdate(
    id,
    { $set: { price } },
    { new: true }
  ).lean();

  if (!dataset) {
    throw new Error("NOT_FOUND");
  }

  // Create audit log after successful write (Requirement 9.6)
  await AuditLog.create({
    action: "update-dataset-price",
    entity: "Dataset",
    entityId: id,
    performedBy: adminId,
    details: `Dataset ${dataset.name} price updated to ${price}`,
  });

  return dataset;
};
