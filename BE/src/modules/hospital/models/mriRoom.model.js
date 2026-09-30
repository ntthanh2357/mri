import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../../../plugins/tenancy.plugin.js";

/**
 * MriRoom — Quản lý phòng máy MRI (Module A.1)
 * Mỗi bệnh viện có nhiều phòng MRI, mỗi phòng có lịch riêng.
 */
const mriRoomSchema = new Schema(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    name: { type: String, required: true, trim: true }, // VD: "Phòng MRI 1", "MRI Siemens 3T"
    modelMachine: { type: String, default: "" },        // Model máy: "Siemens MAGNETOM Vida 3T"
    location: { type: String, default: "" },            // Vị trí: "Tầng B1 - Khu CĐHA"
    status: {
      type: String,
      enum: ['active', 'maintenance', 'inactive'],
      default: 'active',
      index: true
    },
    maxSlotsPerDay: { type: Number, default: 16 },      // Tối đa ca/ngày
    slotDurationMinutes: { type: Number, default: 30 }, // Thời lượng mỗi ca (phút)
    operatingHours: {
      start: { type: String, default: "07:00" },        // Giờ bắt đầu
      end: { type: String, default: "17:00" }           // Giờ kết thúc
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

mriRoomSchema.plugin(tenancyPlugin);

export const MriRoom = model("MriRoom", mriRoomSchema);
export default MriRoom;
