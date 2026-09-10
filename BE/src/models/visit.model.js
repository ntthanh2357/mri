import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../plugins/tenancy.plugin.js";

const visitSchema = new Schema(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    nurseId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    technicianId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    date: { type: Date, default: null },
    facility: { type: String, default: "" },
    visitType: { type: String, default: "" },
    documents: [
      {
        docKey: { type: String },
        groupKey: { type: String },
        label: { type: String },
        storageType: { type: String },
        fileUrl: { type: String },
        fileName: { type: String },
        fileType: { type: String },
        manualData: { type: Schema.Types.Mixed },
        uploadedAt: { type: Date, default: Date.now }
      }
    ],
    status: {
      type: String,
      enum: ['đang chờ', 'đang khám', 'chờ chụp', 'đang chụp', 'chờ chụp lại', 'đã hủy', 'chờ kết quả AI', 'chờ bác sĩ đọc', 'hoàn tất', 'đã đóng', 'lỗi AI'],
      default: 'đang chờ'
    },
    priority: { type: String, enum: ['thấp', 'trung bình', 'cao', 'khẩn cấp'], default: 'trung bình' },
    reason: { type: String, default: "" },
    vitals: {
      pulse: { type: Number, default: null },
      bloodPressure: { type: String, default: "" },
      temperature: { type: Number, default: null },
      spo2: { type: Number, default: null },
      respiratoryRate: { type: Number, default: null },
      measuredAt: { type: Date, default: null }
    },
    mriOrder: {
      region: { type: String, default: "" },
      brain_region: { type: String, default: null },
      instructions: { type: String, default: "" },
      requestAiAnalysis: { type: Boolean, default: false },
      imagingResultId: { type: Schema.Types.ObjectId, ref: 'ImagingResult', default: null },
      orderedAt: { type: Date, default: null }
    },
    // Bảng kiểm An toàn MRI (MRI Safety Screening Checklist) trước buồng máy
    mriSafetyChecklist: {
      hasPacemakerOrMetal: { type: Boolean, default: false }, // Chống chỉ định tuyệt đối
      hasClaustrophobia: { type: Boolean, default: false },   // Hội chứng sợ buồng kín
      hasKidneyDisease: { type: Boolean, default: false },    // Tiền sử suy thận mạn / eGFR < 30
      isPregnant: { type: Boolean, default: false },          // Đang mang thai
      metalDetails: { type: String, default: "" },            // Chi tiết dị vật kim loại
      isScreened: { type: Boolean, default: false },          // Đã hoàn thành bảng kiểm
      screenedBy: { type: String, default: "" },              // Họ tên người kiểm tra
      screenedAt: { type: Date, default: null },              // Thời gian kiểm tra
      passed: { type: Boolean, default: false },              // Đủ điều kiện vào buồng
      notes: { type: String, default: "" }
    },
    mriCancelReason: { type: String, default: "" },
    mriRescanReason: { type: String, default: "" },
    mriCancelledAt: { type: Date, default: null },
    mriCancelledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    mriRescanRequestedAt: { type: Date, default: null },
    mriRescanRequestedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    aiResultRef: { type: String, default: null },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', default: null },
    // [BUG-06 FIX] Flag để tránh gửi nhắc lịch MRI lặp vô hạn
    reminderSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

visitSchema.plugin(tenancyPlugin);

// Compound indexes tối ưu hiệu năng truy vấn hàng đợi bác sĩ và lượt khám trong ngày
visitSchema.index({ hospitalId: 1, status: 1, createdAt: -1 });
visitSchema.index({ hospitalId: 1, doctorId: 1, status: 1 });
visitSchema.index({ hospitalId: 1, patientId: 1, createdAt: -1 });

export const Visit = model("Visit", visitSchema);
export default Visit;

