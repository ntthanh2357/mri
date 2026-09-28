import { Schema, model } from "mongoose";
import { tenancyPlugin } from "../plugins/tenancy.plugin.js";

/**
 * EmergencyEvent / EmergencyAlert — Quản lý sự cố cấp cứu chuyên khoa U Não
 * Tích hợp chuẩn Bounded Context: Báo động 1-chạm nội viện, Bàn giao ISBAR từ ED,
 * Roster kíp trực đích danh, Y lệnh miệng, Pre-MRI Safety Gate và Timeline Audit.
 */
const emergencyAlertSchema = new Schema(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    visitId: { type: Schema.Types.ObjectId, ref: 'Visit', default: null, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    medicalRecordId: { type: Schema.Types.ObjectId, ref: 'MedicalRecord', default: null },
    imagingResultId: { type: Schema.Types.ObjectId, ref: 'ImagingResult', default: null },

    // Nguồn kích hoạt sự cố
    source: {
      type: String,
      enum: ['inpatient_crisis', 'ed_transfer', 'ai_suggestion', 'manual'],
      default: 'inpatient_crisis',
      index: true
    },

    // Vị trí xảy ra biến cố
    location: {
      department: { type: String, default: 'Khoa Ung Thư Não' },
      roomNumber: { type: String, default: '' },
      bedNumber: { type: String, default: '' }
    },

    // Bàn giao ISBAR (Dành cho ca tiếp nhận từ Khoa Cấp Cứu)
    isbarHandoff: {
      hisPatientCode: { type: String, default: '' },
      isUnidentifiedPatient: { type: Boolean, default: false },
      edDoctorName: { type: String, default: '' },
      situation: { type: String, default: '' },
      background: { type: String, default: '' },
      assessment: { type: String, default: '' },
      recommendation: { type: String, default: '' },
      pacsAccessionNumber: { type: String, default: '' }, // Ảnh CT đã chụp ở ED, kéo thẳng từ PACS
      acceptedByDoctorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      acceptedAt: { type: Date, default: null },
      clinicalResponsibility: {
        type: String,
        enum: ['with_ed', 'transferred_to_neuro'],
        default: 'with_ed'
      }
    },

    // Mức độ cảnh báo (RED: Tối khẩn đe dọa tính mạng, ORANGE: Đáp ứng khẩn / theo dõi sát)
    level: {
      type: String,
      enum: ['RED', 'ORANGE'],
      required: true,
      default: 'RED',
      index: true
    },

    // Nguồn kích hoạt
    triggeredBy: {
      type: String,
      enum: ['ai', 'manual'],
      required: true,
      default: 'manual'
    },
    triggeredByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    triggeredAt: { type: Date, default: Date.now, index: true },

    // Phân tầng lâm sàng bổ sung (Post-trigger enrichment)
    clinicalSeverity: {
      level: { type: String, enum: ['RED', 'ORANGE'], default: 'RED' },
      gcsScore: { type: Number, default: null }, // Điểm Glasgow
      news2Score: { type: Number, default: null }, // Thang NEWS2 (>=5 khẩn, >=7 tối khẩn)
      acuteSigns: [{ type: String }], // ['tụt kẹt não', 'co giật liên tục', 'hôn mê cấp']
      reasonNotes: { type: String, default: "" }
    },

    // Chỉ số y tế gợi ý từ AI SaMD (Chỉ xác thực trên MRI)
    midlineShiftMm: { type: Number, default: null },
    tumorVolumeCm3: { type: Number, default: null },
    triggerReason: { type: String, default: "" },

    // Kíp trực điều phối theo Roster (WorkSchedule & isOnCall)
    assignedRoster: [
      {
        role: {
          type: String,
          enum: ['neurosurgeon', 'neuro_icu', 'nurse_lead', 'radiology_tech']
        },
        staffId: { type: Schema.Types.ObjectId, ref: 'User' },
        staffName: { type: String, default: "" },
        isAcknowledged: { type: Boolean, default: false },
        acknowledgedAt: { type: Date, default: null }
      }
    ],

    // Danh sách người đã acknowledge (tương thích ngược)
    acknowledgedBy: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, default: "" },
        acknowledgedAt: { type: Date, default: Date.now }
      }
    ],

    // Trạng thái vòng đời sự kiện cấp cứu
    status: {
      type: String,
      enum: [
        'active',                // Tương thích ngược
        'triggered',             // Đã phát lệnh (1-chạm)
        'acknowledged',          // Kíp trực đã nhận
        'in_progress',           // Đang can thiệp / y lệnh miệng / CT / MRI
        'resolved',              // Tương thích ngược
        'closed',                // Đã đóng sự kiện an toàn
        'cancelled_false_alarm', // Hủy báo động nhầm (Stand-down)
        'escalated'              // Đã leo thang
      ],
      default: 'triggered',
      index: true
    },

    // Cơ chế Leo thang cảnh báo đa cấp
    escalation: {
      level1TriggeredAt: { type: Date, default: null }, // Quá 90s chưa có BS chuyên khoa ACK
      level2TriggeredAt: { type: Date, default: null }, // Quá 5-10m chưa xử lý
      escalatedToUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }]
    },

    // Hủy báo động nhầm (Stand-Down Protocol)
    cancellationDetails: {
      cancelledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      cancelledByName: { type: String, default: "" },
      cancelledAt: { type: Date, default: null },
      cancelReason: { type: String, default: "" }
    },

    // Đóng sự kiện & Kết cục lâm sàng (Clinical Outcomes)
    closureDetails: {
      closedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      closedByName: { type: String, default: "" },
      closedAt: { type: Date, default: null },
      outcome: {
        type: String,
        enum: [
          'emergency_or_transferred',   // Chuyển mổ cấp cứu (mở sọ giải áp / EVD)
          'neuro_icu_admitted',         // Nhập Đơn nguyên Hồi sức U Não (Neuro-ICU)
          'stabilized_in_ward',         // Điều trị nội khoa tích cực, ổn định tại buồng/HDU
          'transfer_higher_hospital',   // Chuyển viện tuyến trên
          'fatal',                      // Tử vong
          ''
        ],
        default: ''
      },
      summaryNotes: { type: String, default: "" },
      isBackfilled: { type: Boolean, default: false }, // Nhập bù mốc thời gian sau khi sập mạng
      backfillReason: { type: String, default: "" }
    },

    // Pre-MRI Safety Gate (Sàng lọc an toàn & vật liệu cấy ghép)
    preMriSafetyGate: {
      hemodynamicallyStable: { type: Boolean, default: false },
      respiratoryStable: { type: Boolean, default: false },
      implantScreeningPassed: { type: Boolean, default: false }, // Không kẹp phình mạch kim loại, van VP shunt an toàn, máy tạo nhịp
      mrConditionalEquipmentReady: { type: Boolean, default: false },
      verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      verifiedAt: { type: Date, default: null }
    },

    // Đề xuất chèn lịch MRI khẩn (Cần KTV trưởng CĐHA duyệt)
    mriOverrideProposal: {
      status: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
      requestedAt: { type: Date, default: null },
      requestedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      approvedAt: { type: Date, default: null },
      mriSlotId: { type: Schema.Types.ObjectId, ref: 'MriSlot', default: null },
      note: { type: String, default: "" }
    },

    // Đề xuất giữ giường Neuro-ICU (Cần BS trực ICU duyệt 4h)
    icuBedProposal: {
      requestedBedType: { type: String, default: 'KUTN-ICU' },
      status: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
      requestedAt: { type: Date, default: null },
      requestedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      approvedAt: { type: Date, default: null },
      bedId: { type: Schema.Types.ObjectId, ref: 'HospitalBed', default: null },
      note: { type: String, default: "" }
    },

    // Chuỗi mốc thời gian Audit Trail hoàn chỉnh
    timelineMilestones: [
      {
        action: { type: String, required: true },
        performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        performedByName: { type: String, default: "" },
        timestamp: { type: Date, default: Date.now },
        notes: { type: String, default: "" }
      }
    ],

    // Tương thích ngược E.4
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    resolutionNote: { type: String, default: "" },
    escalatedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

emergencyAlertSchema.index({ hospitalId: 1, status: 1, triggeredAt: -1 });
emergencyAlertSchema.plugin(tenancyPlugin);

export const EmergencyAlert = model("EmergencyAlert", emergencyAlertSchema);
export const EmergencyEvent = EmergencyAlert; // Alias tiêu chuẩn lâm sàng
export default EmergencyAlert;
