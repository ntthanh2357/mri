import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../plugins/tenancy.plugin.js";

const transferFormSchema = new Schema({
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
  transferNo: {
    type: String,
    default: ""
  },
  hospitalNo: {
    type: String,
    default: ""
  },
  transferTo: {
    type: String,
    default: ""
  },
  dateIn: {
    type: Date,
    default: Date.now
  },
  dateOut: {
    type: Date,
    default: Date.now
  },
  clinicalSummary: {
    type: String,
    default: ""
  },
  labSummary: {
    type: String,
    default: ""
  },
  diagnosis: {
    type: String,
    default: ""
  },
  treatment: {
    type: String,
    default: ""
  },
  drugsUsed: {
    type: String,
    default: ""
  },
  patientStatus: {
    type: String,
    default: ""
  },
  reason: {
    type: String,
    enum: ["1", "2"],
    default: "1"
  },
  reasonDetail: {
    type: String,
    default: "" // e.g. "Phù hợp quy định", "Không phù hợp khả năng", "Theo yêu cầu"
  },
  treatmentDirection: {
    type: String,
    default: ""
  },
  transferTime: {
    type: Date,
    default: Date.now
  },
  isOneYearValid: {
    type: String,
    enum: ["Có", "Không"],
    default: "Không"
  },
  transportation: {
    type: String,
    default: ""
  },
  escort: {
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

transferFormSchema.plugin(tenancyPlugin);

export const TransferForm = model("TransferForm", transferFormSchema, "transfer_forms");
export default TransferForm;
