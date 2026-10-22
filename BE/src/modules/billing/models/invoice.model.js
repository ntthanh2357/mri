import { Schema, model } from 'mongoose';
import { tenancyPlugin } from "../../../plugins/tenancy.plugin.js";

const invoiceItemSchema = new Schema({
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['exam', 'mri', 'ai', 'drug', 'bed', 'other', 'clinical_trial'], default: 'other' },
  // Khóa ngoại Dược phẩm có cấu trúc chuẩn hóa (Khắc phục hạn chế của Regex Parsing)
  drugId: { type: Schema.Types.ObjectId, ref: 'Drug', default: null, index: true },
  drugName: { type: String, default: null },
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, default: 0 },
  unit: { type: String, default: 'Viên' },
  dosage: { type: String, default: null },
  batchNumber: { type: String, default: null },
  // Nguồn lô thực tế đã xuất kho theo FEFO (UC-PHA-06/07): [{batchNumber, quantity}]
  // Ghi tại thời điểm trừ kho để hoàn tiền trước khi phát thuốc trả ĐÚNG lô cũ.
  batches: {
    type: [{ batchNumber: { type: String, default: null }, quantity: { type: Number, default: 0 } }],
    default: [],
  },
  // BHYT phân bổ cấp mặt hàng
  insuranceCoverage: {
    isCovered: { type: Boolean, default: false },
    coverageRate: { type: Number, default: 0 },
    insuranceAmount: { type: Number, default: 0 },
    patientCopayAmount: { type: Number, default: 0 },
    bhytDrugCode: { type: String, default: null }
  },
  // Trạng thái xuất kho vật lý tại quầy dược (Physical Pharmacy Dispensing Status)
  dispenseStatus: {
    type: String,
    enum: ['PENDING', 'DISPENSED', 'CANCELLED', 'PARTIALLY_DISPENSED'],
    default: 'PENDING'
  },
  dispensedAt: { type: Date, default: null },
  dispensedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  // Hoàn tiền từng phần (Partial Refund Tracking)
  isRefunded: { type: Boolean, default: false },
  refundedQuantity: { type: Number, default: 0 }
}, { _id: false });

const invoiceSchema = new Schema(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    visitId: { type: Schema.Types.ObjectId, ref: 'Visit', index: true },
    items: [invoiceItemSchema],
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ['chờ thanh toán', 'đang xử lý', 'đã thanh toán', 'hoàn trả', 'hủy'], default: 'chờ thanh toán' },
    stockDeductionStatus: {
      type: String,
      enum: ['PENDING', 'DEDUCTED', 'SHORTAGE_FLAGGED', 'PERMANENT_ERROR_FLAGGED', 'EXCEEDED_MAX_RETRIES'],
      default: 'PENDING'
    },
    dispenseStatus: {
      type: String,
      enum: ['PENDING', 'DISPENSED', 'CANCELLED', 'PARTIALLY_DISPENSED'],
      default: 'PENDING'
    },
    paymentMethod: { type: String, enum: ['tiền mặt', 'chuyển khoản', 'vietqr', 'BHYT chi trả', ''], default: '' }, // 'BHYT chi trả': BHYT trả 100%, bệnh nhân 0đ
    orderCode: { type: Number, unique: true, sparse: true }, // Mã VietQR PayOS đang dùng
    // Lịch sử mọi mã VietQR từng tạo cho hóa đơn — để tiền về muộn cho mã cũ vẫn khớp được đúng hóa đơn
    payosLinks: [
      {
        orderCode: { type: Number, required: true },
        amount: { type: Number, default: 0 },
        qrCode: { type: String, default: "" },
        checkoutUrl: { type: String, default: "" },
        expiresAt: { type: Date, default: null },
        status: { type: String, default: "PENDING" }, // PENDING | PAID | CANCELLED | EXPIRED | PROCESSING | UNDERPAID
        createdAt: { type: Date, default: Date.now },
      },
    ],
    paidOrderCode: { type: Number, default: null }, // Mã VietQR thực sự nhận tiền cho hóa đơn
    // Chuyển khoản lễ tân ghi nhận tay theo sao kê ngân hàng (vd. tiền chuyển vào mã VietQR đã hủy / hết hạn)
    bankTransfers: [
      {
        reference: { type: String, required: true }, // Mã giao dịch / số bút toán trên sao kê
        amount: { type: Number, required: true },
        note: { type: String, default: "" },
        recordedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
        recordedAt: { type: Date, default: Date.now },
      },
    ],
    dispenseWarning: { type: String, default: "" }, // Cảnh báo xuất kho thuốc (vd. trả VietQR nhưng kho không đủ)
    payLock: { type: Date, default: null }, // Khóa tạm khi đang thu tiền → chống bấm thu 2 lần cùng lúc
    // Phát hiện bệnh nhân trả 2 lần (tiền VietQR về sau khi hóa đơn đã được thu) → cần hoàn khoản dư
    duplicatePayment: {
      flagged: { type: Boolean, default: false },
      detectedAt: { type: Date, default: null },
      orderCode: { type: Number, default: null },
      amount: { type: Number, default: 0 },
      note: { type: String, default: "" },
    },
    paidAt: { type: Date, default: null },
    paymentNotes: { type: String, default: "" },
    // Phân loại thanh toán & Thử nghiệm lâm sàng (Clinical Trial)
    billingType: {
      type: String,
      enum: ['standard', 'clinical_trial', 'sponsored', 'charity'],
      default: 'standard'
    },
    clinicalTrialProtocol: {
      protocolId: { type: String, default: null },
      sponsorName: { type: String, default: null },
      sponsorContractId: { type: String, default: null },
      trialArm: {
        type: String,
        enum: ['investigational', 'control_placebo', 'standard_of_care', null],
        default: null
      },
      visitSchedule: {
        type: String,
        enum: ['screening', 'baseline', 'C1D1', 'C2D1', 'C3D1', 'end_of_study', null],
        default: null
      },
      coverageDetails: { type: String, default: null },
      sponsorCoveredAmount: { type: Number, default: 0 },
      patientPayAmount: { type: Number, default: 0 },
      ichGcpCompliant: { type: Boolean, default: true }
    },
    // M.5 — Hoàn tiền & Hoàn tiền từng phần (Partial Refund)
    refundReason: { type: String, default: null },
    refundedAt: { type: Date, default: null },
    refundedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    isPartialRefund: { type: Boolean, default: false },
    refundAmount: { type: Number, default: 0 },
    // Quy trình duyệt hoàn tiền 2 cấp cho hóa đơn giá trị cao (Dual Approval Workflow >= 10M)
    refundApproval: {
      requiresDualApproval: { type: Boolean, default: false },
      firstApproverId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      secondApproverId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      approvedAt: { type: Date, default: null },
      approvalStatus: { type: String, enum: ['none', 'pending_second_approval', 'approved', 'rejected'], default: 'none' }
    },
    // Cảnh báo phòng chống rửa tiền (AML - Anti-Money Laundering >= 300M VNĐ - TT35/2013/TT-NHNN)
    amlReport: {
      isFlagged: { type: Boolean, default: false },
      flaggedAt: { type: Date, default: null },
      reportedToAuthority: { type: Boolean, default: false },
      strReportId: { type: String, default: null },
      strDeadline: { type: Date, default: null },         // Hạn chót gửi báo cáo STR (48h)
      retentionUntil: { type: Date, default: null },      // Thời hạn lưu trữ hồ sơ AML tối thiểu 5 năm
      reason: { type: String, default: null },
      kycVerified: { type: Boolean, default: false },
      kycDetails: {
        idCardNumber: { type: String, default: null },
        fullName: { type: String, default: null },
        nationality: { type: String, default: 'Việt Nam' }
      }
    },
    // R.2 — BHYT đồng chi trả & Quản lý trần thanh toán / Trái tuyến
    bhytInfo: {
      bhytId: { type: Schema.Types.ObjectId, ref: 'BhytInfo', default: null },
      cardNumber: { type: String, default: null },        // Mã số thẻ BHYT (hoặc mã che 4 số cuối)
      cardExpiryDate: { type: Date, default: null },      // Hạn sử dụng thẻ BHYT
      isCardValid: { type: Boolean, default: true },      // Trạng thái thẻ qua cổng giám định BHXH
      treatmentCode: { type: String, default: null },     // Mã đợt điều trị KCB BHYT
      coverageRate: { type: Number, default: 0 },        // % BHYT chi trả
      bhytAmount: { type: Number, default: 0 },          // Số tiền BHYT chi trả
      patientCopayAmount: { type: Number, default: 0 },  // Bệnh nhân đồng chi trả
      annualCap: { type: Number, default: 72000000 },    // Trần chi trả BHYT (40 tháng lương cơ sở ~72M)
      usedThisYear: { type: Number, default: 0 },        // Lũy kế BHYT đã chi trả trong năm
      isOutOfNetwork: { type: Boolean, default: false },  // Cờ khám chữa bệnh trái tuyến
      priorAuthorization: { type: String, default: null }, // Giấy phê duyệt điều trị đặc biệt (Bevacizumab)
      appliedOnTotal: { type: Number, default: null },   // Tổng chi phí tại thời điểm áp BHYT (đổi dịch vụ → tính lại)
      autoApplied: { type: Boolean, default: false },    // Hệ thống tự áp khi phiếu thu chuyển sang quầy
    },
    // Phê duyệt trợ cấp từ thiện có cấu trúc (Structured Charity Approval)
    charityApproval: {
      isApproved: { type: Boolean, default: false },
      programCode: { type: String, default: null },       // Mã chương trình trợ cấp
      approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      approvedAt: { type: Date, default: null },
      documentRef: { type: String, default: null }
    },
    // Số lần webhook gửi lại (Webhook Retry Counter để chặn retry vô hạn)
    webhookRetryCount: { type: Number, default: 0 },
    patientPayAmount: { type: Number, default: null },   // Thực tế bệnh nhân trả (sau BHYT)
  },
  { timestamps: true }
);

invoiceSchema.plugin(tenancyPlugin);

// Compound indexes tối ưu hiệu năng lọc hóa đơn theo bệnh viện và trạng thái thanh toán
invoiceSchema.index({ hospitalId: 1, status: 1, createdAt: -1 });
invoiceSchema.index({ hospitalId: 1, patientId: 1, createdAt: -1 });

export const Invoice = model('Invoice', invoiceSchema);
export default Invoice;

