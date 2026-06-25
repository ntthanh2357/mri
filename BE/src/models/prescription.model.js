import { Schema, model } from "mongoose";

const prescriptionSchema = new Schema({
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
  recorded_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

export const Prescription = model("Prescription", prescriptionSchema, "prescriptions");
export default Prescription;
