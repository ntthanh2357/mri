import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../plugins/tenancy.plugin.js";

const prescriptionSchema = new Schema({
  hospitalId: {
    type: Schema.Types.ObjectId,
    ref: "Hospital",
    required: true,
    index: true
  },
  patient_id: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  doctor_name: {
    type: String,
    required: true,
    default: "Bác sĩ điều trị"
  },
  diagnosis: {
    type: String,
    required: true,
    default: ""
  },
  drugs: [{
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true, default: "viên" },
    usage: { type: String, default: "" }
  }],
  note: {
    type: String,
    default: ""
  },
  isBilled: {
    type: Boolean,
    default: false
  },
  invoiceId: {
    type: Schema.Types.ObjectId,
    ref: "Invoice"
  },
  recorded_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

prescriptionSchema.plugin(tenancyPlugin);

export const Prescription = model("Prescription", prescriptionSchema, "prescriptions");
export default Prescription;
