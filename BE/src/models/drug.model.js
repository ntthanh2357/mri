import { Schema, model } from "mongoose";

const drugSchema = new Schema(
  {
    // ── Tenant isolation ──────────────────────────────────────────────────────
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },

    // ── Thông tin cơ bản ──────────────────────────────────────────────────────
    name: {
      type: String,
      required: true,
      trim: true,
    },
    activeIngredient: {
      type: String,
      default: "", // Hoạt chất chính (generic name)
      trim: true,
    },
    category: {
      type: String,
      enum: ["anticonvulsant", "corticosteroid", "psychotropic", "pain_reliever", "antibiotic", "cardiovascular", "other"],
      default: "other",
    },
    manufacturer: {
      type: String,
      default: "",
      trim: true,
    },
    dosageInstructions: {
      type: String,
      default: "",
    },

    // ── Tồn kho ───────────────────────────────────────────────────────────────
    stock: {
      quantity: { type: Number, default: 0, min: 0 },      // Số lượng hiện có
      unit: { type: String, default: "Viên" },              // Đơn vị: Viên/Lọ/Ống/Gói
      minStock: { type: Number, default: 10 },              // Ngưỡng cảnh báo hết hàng
      lastUpdated: { type: Date, default: Date.now },
    },

    // ── Giá & Hạn sử dụng ────────────────────────────────────────────────────
    price: {
      type: Number,
      default: 0,
      min: 0,
    }, // VND
    expiryDate: {
      type: Date,
      default: null,
    },

    // ── Thông tin lâm sàng ────────────────────────────────────────────────────
    bmiWarningThreshold: {
      min: { type: Number, default: 18.5 },
      max: { type: Number, default: 25.0 },
    },
    interactions: [
      {
        type: String, // Tên hoạt chất/thuốc gây tương tác có hại
      },
    ],

    // ── Trạng thái ────────────────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index tìm kiếm theo bệnh viện + tên thuốc
drugSchema.index({ hospitalId: 1, name: 1 });
// Index cảnh báo tồn kho thấp
drugSchema.index({ hospitalId: 1, "stock.quantity": 1 });

export const Drug = model("Drug", drugSchema);
export default Drug;
