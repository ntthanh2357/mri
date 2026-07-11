import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../plugins/tenancy.plugin.js";

const dischargePaperSchema = new Schema({
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
  dischargeNo: {
    type: String,
    default: ""
  },
  hospitalNo: {
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
  diagnosis: {
    type: String,
    default: ""
  },
  treatment: {
    type: String,
    default: ""
  },
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

dischargePaperSchema.plugin(tenancyPlugin);

export const DischargePaper = model("DischargePaper", dischargePaperSchema, "discharge_papers");
export default DischargePaper;
