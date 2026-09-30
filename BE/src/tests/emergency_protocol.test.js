import mongoose from 'mongoose';
import { EmergencyAlert } from '../models/emergencyAlert.model.js';
import { User } from '../models/user.model.js';
import { Visit } from '../models/visit.model.js';
import { MedicalRecord } from '../modules/emr/models/medicalRecord.model.js';
import {
  inpatientTrigger,
  postEnrich,
  edHandoff,
  edAccept,
  acknowledgeByRole,
  cancelStandDown,
  createVerbalOrder,
  requestMriOverride,
  requestIcuBed,
  closeEmergencyEvent,
  getActiveEvents,
} from '../controllers/emergency.controller.js';

describe('Quy trình Cấp cứu U Não Chuẩn Y Khoa (Neuro-Oncology Emergency Protocol & Bounded Context)', () => {
  let mockHospitalId;
  let mockPatient;
  let mockVisit;
  let mockRecord;
  let doctorUser;
  let nurseUser;
  let createdEventId;

  // Mock response helper
  const createMockRes = () => {
    const res = {
      statusCode: 200,
      data: null,
      message: null,
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (payload) {
        this.data = payload.data || payload;
        this.message = payload.message;
        return this;
      },
    };
    return res;
  };

  beforeAll(async () => {
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/neuroscan_test_logic';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    mockHospitalId = new mongoose.Types.ObjectId();

    doctorUser = {
      id: new mongoose.Types.ObjectId().toString(),
      _id: new mongoose.Types.ObjectId(),
      role: 'doctor',
      hospitalId: mockHospitalId,
      profile: { name: 'BS. Lê Minh Trí (Ngoại Thần Kinh)', specialty: 'Ngoại Thần Kinh' },
    };

    nurseUser = {
      id: new mongoose.Types.ObjectId().toString(),
      _id: new mongoose.Types.ObjectId(),
      role: 'nurse',
      hospitalId: mockHospitalId,
      profile: { name: 'ĐD. Nguyễn Thị Thảo', department: 'Khoa Ung Thư Não' },
    };

    // Dọn dẹp dữ liệu cũ nếu có
    await User.deleteMany({ email: /emergency_patient_test/ });

    // Tạo bệnh nhân nội trú mẫu
    mockPatient = await User.create({
      hospitalId: mockHospitalId,
      email: `emergency_patient_test_${Date.now()}@hospital.local`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789dummyhashforpatient',
      role: 'patient',
      profile: {
        patientId: 'BN-EMERGENCY-01',
        name: 'Trần Văn Nam',
        age: 52,
        gender: 'Nam',
        phone: '0901234567',
      },
      inpatientDetails: {
        department: 'Khoa Ung Thư Não',
        room: 'P.302',
        bed: 'G.04',
      },
    });

    mockVisit = await Visit.create({
      hospitalId: mockHospitalId,
      patientId: mockPatient._id,
      visitType: 'Nội trú',
      priority: 'trung bình',
      status: 'đang khám',
      reason: 'Theo dõi Glioblastoma sau xạ trị',
    });

    mockRecord = await MedicalRecord.create({
      hospitalId: mockHospitalId,
      patientId: String(mockPatient._id),
      patientName: mockPatient.profile.name,
      age: 52,
      gender: 'Nam',
      admissionType: 'Nội trú',
      department: 'Khoa Ung Thư Não',
      diagnosis: 'Glioblastoma Grade 4',
      status: 'Đang điều trị',
      doctorInCharge: doctorUser.profile.name,
      retentionCategory: 'neuro_oncology_malignant',
    });
  });

  afterAll(async () => {
    if (mockHospitalId) {
      await EmergencyAlert.deleteMany({ hospitalId: mockHospitalId });
      await User.deleteMany({ hospitalId: mockHospitalId });
      await Visit.deleteMany({ hospitalId: mockHospitalId });
      await MedicalRecord.deleteMany({ hospitalId: mockHospitalId });
    }
  });

  test('1. [1-Touch Inpatient Trigger]: Kích hoạt 1-chạm không rào cản, tự động đẩy Visit priority = khẩn cấp và sinh Timeline Milestone', async () => {
    const req = {
      user: nurseUser,
      body: {
        patientId: mockPatient._id,
        bedNumber: 'G.04',
        roomNumber: 'P.302',
        level: 'RED',
        reason: 'Bệnh nhân đột ngột co giật toàn thể liên tục, dọa tụt kẹt não',
      },
    };
    const res = createMockRes();

    await inpatientTrigger(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.data.event).toBeTruthy();
    expect(res.data.event.status).toBe('triggered');
    expect(res.data.event.source).toBe('inpatient_crisis');
    expect(res.data.event.timelineMilestones.length).toBe(1);
    expect(res.data.event.timelineMilestones[0].action).toContain('Báo động 1-chạm');

    createdEventId = res.data.event._id;

    // Kiểm tra Visit priority được tự động chuyển thành 'khẩn cấp'
    const updatedVisit = await Visit.findById(mockVisit._id);
    expect(updatedVisit.priority).toBe('khẩn cấp');
  });

  test('2. [Post-Trigger Enrichment]: Bổ sung thông số lâm sàng (GCS, NEWS2, dấu thần kinh khu trú) sau khi đã phát lệnh mà không làm trễ báo động', async () => {
    const req = {
      user: nurseUser,
      params: { id: createdEventId },
      body: {
        gcsScore: 8,
        news2Score: 7, // Cấp cứu
        acuteSigns: ['đồng tử giãn một bên', 'co giật kháng trị', 'hôn mê cấp'],
        reasonNotes: 'GCS tụt từ 13 xuống 8 điểm trong 15 phút',
      },
    };
    const res = createMockRes();

    await postEnrich(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.data.event.clinicalSeverity.gcsScore).toBe(8);
    expect(res.data.event.clinicalSeverity.news2Score).toBe(7);
    expect(res.data.event.clinicalSeverity.acuteSigns).toContain('co giật kháng trị');
    expect(res.data.event.timelineMilestones.length).toBe(2);
  });

  test('3. [Role-Specific ACK]: Bác sĩ Ngoại Thần Kinh trực bấm Acknowledge, ghi nhận đúng vai trò và chuyển trạng thái sang acknowledged', async () => {
    const req = {
      user: doctorUser,
      params: { id: createdEventId },
      body: { role: 'neurosurgeon' },
    };
    const res = createMockRes();

    await acknowledgeByRole(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.data.event.status).toBe('acknowledged');
    expect(res.data.event.acknowledgedBy.length).toBe(1);
    expect(res.data.event.timelineMilestones.length).toBe(3);
  });

  test('4. [Verbal Order & 24h Countersign]: Ra y lệnh miệng cấp cứu, gắn cờ thuốc hướng thần và đặt hạn ký số EMR 24 giờ', async () => {
    const req = {
      user: doctorUser,
      body: {
        emergencyEventId: createdEventId,
        medicalRecordId: mockRecord._id,
        orderText: 'Tiêm tĩnh mạch chậm Diazepam 10mg cắt cơn giật + Truyền tĩnh mạch nhanh Mannitol 20% 250ml trong 30 phút',
        isControlledSubstance: true, // Thuốc hướng thần / gây nghiện (TT 20/2017)
        countersignHours: 24,
      },
    };
    const res = createMockRes();

    await createVerbalOrder(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.data.verbalOrder.isControlledSubstance).toBe(true);
    expect(res.data.verbalOrder.status).toBe('pending_countersign');
    expect(res.data.verbalOrder.isReadBackConfirmed).toBe(true);

    // Kiểm tra đã lưu vào MedicalRecord
    const updatedRecord = await MedicalRecord.findById(mockRecord._id);
    expect(updatedRecord.verbalOrders.length).toBe(1);
    expect(updatedRecord.verbalOrders[0].isControlledSubstance).toBe(true);
  });

  test('5. [Pre-MRI Safety Gate]: Chặn đề xuất chụp MRI nếu bệnh nhân chưa ổn định hoặc có dị vật từ tính chưa sàng lọc', async () => {
    // Trường hợp chưa ổn định sinh hiệu
    const reqFail = {
      user: doctorUser,
      body: {
        emergencyEventId: createdEventId,
        preMriSafetyGate: {
          hemodynamicallyStable: false,
          respiratoryStable: false,
          implantScreeningPassed: false,
        },
      },
    };
    const resFail = createMockRes();

    await requestMriOverride(reqFail, resFail);
    expect(resFail.statusCode).toBe(422);

    // Trường hợp đã ổn định và sàng lọc an toàn vật liệu cấy ghép
    const reqPass = {
      user: doctorUser,
      body: {
        emergencyEventId: createdEventId,
        preMriSafetyGate: {
          hemodynamicallyStable: true,
          respiratoryStable: true,
          implantScreeningPassed: true, // Không có clip phình mạch, van VP shunt an toàn
          mrConditionalEquipmentReady: true,
        },
        note: 'Chụp MRI sọ não 3.0T khẩn cấp đánh giá chèn ép khối u',
      },
    };
    const resPass = createMockRes();

    await requestMriOverride(reqPass, resPass);
    expect(resPass.statusCode).toBe(200);
    expect(resPass.data.event.mriOverrideProposal.status).toBe('pending');
    expect(resPass.data.event.preMriSafetyGate.implantScreeningPassed).toBe(true);
  });

  test('6. [Neuro-ICU Bed Proposal]: Gửi đề xuất giữ giường Hồi sức U Não (Neuro-ICU) 4 giờ cho BS trực ICU duyệt', async () => {
    const req = {
      user: doctorUser,
      body: {
        emergencyEventId: createdEventId,
        requestedBedType: 'KUTN-ICU',
        note: 'Giữ 1 giường Neuro-ICU đón bệnh nhân sau xử trí hạ áp lực nội sọ',
      },
    };
    const res = createMockRes();

    await requestIcuBed(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.data.event.icuBedProposal.status).toBe('pending');
    expect(res.data.event.icuBedProposal.requestedBedType).toBe('KUTN-ICU');
  });

  test('7. [ED Inbound ISBAR Handoff]: Tiếp nhận ca từ Khoa Cấp Cứu, trách nhiệm lâm sàng thuộc ED cho đến khi BS Ngoại TK Accept', async () => {
    const reqHandoff = {
      user: doctorUser,
      body: {
        hisPatientCode: 'HIS-ED-9921',
        isUnidentifiedPatient: false,
        patientName: 'Vũ Quốc Bảo',
        age: 48,
        gender: 'Nam',
        edDoctorName: 'BS. Cấp Cứu Hoàng',
        situation: 'Hôn mê đột ngột GCS 9, đồng tử P 4mm, T 2mm',
        background: 'Nghi ngờ khối u não đỉnh P xuất huyết',
        assessment: 'Tăng áp lực nội sọ cấp dọa tụt kẹt não',
        recommendation: 'Cần chuyển Khoa Ung Thư Não & Phẫu thuật mở sọ giải áp',
        pacsAccessionNumber: 'CT_BRAIN_STAT_88219', // Đã chụp CT ở ED, không chụp lại
      },
    };
    const resHandoff = createMockRes();

    await edHandoff(reqHandoff, resHandoff);

    expect(resHandoff.statusCode).toBe(201);
    const edEvent = resHandoff.data.event;
    expect(edEvent.source).toBe('ed_transfer');
    expect(edEvent.isbarHandoff.pacsAccessionNumber).toBe('CT_BRAIN_STAT_88219');
    expect(edEvent.isbarHandoff.clinicalResponsibility).toBe('with_ed'); // Trách nhiệm vẫn ở ED

    // Bác sĩ Ngoại Thần Kinh chấp thuận nhận bệnh
    const reqAccept = {
      user: doctorUser,
      params: { id: edEvent._id },
    };
    const resAccept = createMockRes();

    await edAccept(reqAccept, resAccept);

    expect(resAccept.statusCode).toBe(200);
    expect(resAccept.data.event.isbarHandoff.clinicalResponsibility).toBe('transferred_to_neuro');
    expect(resAccept.data.event.isbarHandoff.acceptedByDoctorId.toString()).toBe(doctorUser.id);
  });

  test('8. [Stand-Down False Alarm]: Hủy báo động nhầm bắt buộc lý do giải trình, không xóa record và kích hoạt Stand-Down', async () => {
    // Tạo 1 event test riêng để hủy
    const tempEvent = await EmergencyAlert.create({
      hospitalId: mockHospitalId,
      patientId: mockPatient._id,
      source: 'inpatient_crisis',
      level: 'ORANGE',
      status: 'triggered',
      clinicalSeverity: { level: 'ORANGE', reasonNotes: 'Nghi co giật' },
      triggeredByUserId: nurseUser.id,
    });

    // Thử hủy không có lý do -> Bị từ chối
    const reqFail = {
      user: doctorUser,
      params: { id: tempEvent._id },
      body: { cancelReason: '' },
    };
    const resFail = createMockRes();
    await cancelStandDown(reqFail, resFail);
    expect(resFail.statusCode).toBe(400);

    // Hủy có lý do hợp lệ
    const reqPass = {
      user: doctorUser,
      params: { id: tempEvent._id },
      body: { cancelReason: 'Bệnh nhân chỉ bị ngất do hạ đường huyết, đã hồi phục sau uống nước đường.' },
    };
    const resPass = createMockRes();
    await cancelStandDown(reqPass, resPass);

    expect(resPass.statusCode).toBe(200);
    expect(resPass.data.event.status).toBe('cancelled_false_alarm');
    expect(resPass.data.event.cancellationDetails.cancelReason).toContain('hạ đường huyết');
  });

  test('9. [Event Closure & Timeline Audit]: Đóng sự kiện cấp cứu với kết cục lâm sàng (chuyển mổ / ICU), chốt mốc thời gian hoàn chỉnh', async () => {
    const req = {
      user: doctorUser,
      params: { id: createdEventId },
      body: {
        outcome: 'emergency_or_transferred', // Chuyển phòng mổ cấp cứu mở sọ giải áp
        summaryNotes: 'Đã hoàn tất tiêm cắt cơn giật, truyền Mannitol hạ áp lực nội sọ và chuyển BN vào buồng mổ cấp cứu số 2.',
        isBackfilled: false,
      },
    };
    const res = createMockRes();

    await closeEmergencyEvent(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.data.event.status).toBe('closed');
    expect(res.data.event.closureDetails.outcome).toBe('emergency_or_transferred');
    expect(res.data.event.timelineMilestones.length).toBeGreaterThan(4);
  });
});
