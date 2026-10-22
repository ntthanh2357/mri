import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../../../plugins/tenancy.plugin.js";

const careSheetSchema = new Schema(
  {
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: 'Hospital',
      required: true,
      index: true
    },
    medicalRecordId: {
      type: Schema.Types.ObjectId,
      ref: "MedicalRecord",
      required: true,
    },
    careLevel: {
      type: Number,
      enum: [1, 2, 3],
      default: 3,
    },
    pulse: {
      type: Number, // Mạch (lần/phút)
      required: true,
    },
    bloodPressure: {
      type: String, // Huyết áp (mmHg), e.g. "120/80"
      required: true,
      trim: true,
    },
    temperature: {
      type: Number, // Nhiệt độ (°C)
      required: true,
    },
    respiratoryRate: {
      type: Number, // Nhịp thở (lần/phút)
      required: true,
    },
    spo2: {
      type: Number, // SpO2 (%)
      required: true,
    },
    // UC-NUR-04: Tri giác (Thang điểm hôn mê Glasgow - GCS)
    glasgow: {
      eye: { type: Number, min: 1, max: 4, default: 4 }, // Mở mắt (1-4)
      verbal: { type: Number, min: 1, max: 5, default: 5 }, // Lời nói (1-5)
      motor: { type: Number, min: 1, max: 6, default: 6 }, // Vận động (1-6)
      totalScore: { type: Number, min: 3, max: 15, default: 15 }, // Tổng điểm (3-15)
      classification: { type: String, default: "Tỉnh táo / Tri giác tốt" }
    },
    // UC-NUR-04: Phản xạ đồng tử
    pupils: {
      leftSize: { type: Number, default: 2.5 }, // Kích thước đồng tử mắt trái (mm)
      rightSize: { type: Number, default: 2.5 }, // Kích thước đồng tử mắt phải (mm)
      leftLightReflex: { type: String, default: "+" }, // +, chậm, -
      rightLightReflex: { type: String, default: "+" }, // +, chậm, -
      shape: { type: String, default: "Tròn đều 2 bên" },
      notes: { type: String, default: "" }
    },
    // UC-NUR-04: Đo lượng dịch dẫn lưu phẫu thuật sọ não
    surgicalDrainage: {
      site: { type: String, default: "" }, // Dẫn lưu não thất EVD, ngoài màng cứng, dưới màng cứng, hố mổ...
      volume: { type: Number, default: 0 }, // Lượng dịch (ml)
      color: { type: String, default: "" }, // Hồng nhạt, đỏ tươi, dịch não tủy trong, vàng chanh...
      condition: { type: String, default: "Chân ống khô ráo, cố định tốt" },
      notes: { type: String, default: "" }
    },
    // UC-NUR-04: Lịch truyền dịch
    fluidInfusions: [
      {
        fluidName: { type: String, default: "" }, // Mannitol 20%, NaCl 0.9%, Ringer Lactate...
        volume: { type: Number, default: 500 }, // ml
        rate: { type: String, default: "40 giọt/phút" },
        startTime: { type: String, default: "" },
        endTime: { type: String, default: "" },
        status: { type: String, enum: ["đang truyền", "đã hoàn thành", "tạm dừng"], default: "đang truyền" },
        notes: { type: String, default: "" }
      }
    ],
    // Kết quả đánh giá cảnh báo an toàn sinh hiệu
    vitalsEvaluation: {
      type: Schema.Types.Mixed,
      default: null
    },
    progressNotes: {
      type: String,
      required: true,
      default: "",
    },
    careActions: {
      type: String,
      required: true,
      default: "",
    },
    nurse: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

careSheetSchema.plugin(tenancyPlugin);

export const CareSheet = model("CareSheet", careSheetSchema);
export default CareSheet;
