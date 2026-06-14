import { Dataset } from "../models/dataset.model";
import { AuditLog } from "../models/auditLog.model";

export const getDatasets = async () => {
  return Dataset.find().lean();
};

export const createDataset = async (
  payload: {
    name: string;
    description?: string;
    price?: number;
    status?: "active" | "inactive" | "pending";
  },
  adminId: string
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
