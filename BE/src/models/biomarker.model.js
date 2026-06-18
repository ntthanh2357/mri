import { Schema, model } from "mongoose";

const biomarkerSchema = new Schema({
  code: { 
    type: String, 
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  }, // Ví dụ: 'GLU', 'AST', 'ALT'
  name: {
    type: String,
    required: true,
    trim: true
  }, // Ví dụ: 'Glucose', 'AST (GOT)'
  category: { 
    type: String, 
    required: true,
    enum: ['HOA_SINH', 'HUYET_HOC'] 
  },
  unit: {
    type: String,
    required: false,
    default: '',
    trim: true
  }, // Ví dụ: 'mmol/L', 'U/L' - có thể rỗng nếu không có đơn vị (VD: pH, A/G ratio)

  reference_range: {
    male: { 
      min: { type: Number, default: null }, 
      max: { type: Number, default: null } 
    },
    female: { 
      min: { type: Number, default: null }, 
      max: { type: Number, default: null } 
    },
    text: { type: String, default: "" }
  }
}, {
  timestamps: true
});

export const Biomarker = model("Biomarker", biomarkerSchema, "biomarkers");
