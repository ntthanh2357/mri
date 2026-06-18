import { Schema, model } from "mongoose";

const vitalSignSchema = new Schema({
  patient_id: { 
    type: Schema.Types.ObjectId, 
    ref: "User",
    required: true
  },
  pulse: { 
    type: Number,
    required: true 
  }, // Mạch (lần/phút)
  blood_pressure: {
    systolic: { type: Number, required: true }, // Huyết áp tâm thu (mmHg)
    diastolic: { type: Number, required: true } // Huyết áp tâm trương (mmHg)
  },
  spo2: { 
    type: Number,
    required: true 
  }, // SpO2 (%)
  weight: { 
    type: Number 
  }, // Cân nặng (kg)
  height: { 
    type: Number 
  }, // Chiều cao (cm)
  bmi: { 
    type: Number 
  }, // Chỉ số BMI
  recorded_at: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

export const VitalSign = model("VitalSign", vitalSignSchema, "vital_signs");
