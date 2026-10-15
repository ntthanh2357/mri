import mongoose from 'mongoose';
import { User } from '../models/user.model.js';
import { Visit } from '../models/visit.model.js';
import { Assignment } from '../models/assignment.model.js';
import {
  getMyAssignments,
  acknowledgeAssignment,
} from '../controllers/assignment.controller.js';

/**
 * [0013-MyAssignments] Test màn "Phân công của tôi" cho Bác sĩ:
 *  - GET /assignments/my trả kèm TÊN BỆNH NHÂN (populate 2 cấp visit → patient)
 *  - Lọc ?status=pending hoạt động đúng
 *  - Cô lập dữ liệu theo bác sĩ (không lộ ca của bác sĩ khác)
 *  - PUT /assignments/:id/acknowledge: pending → acknowledged đúng 1 lần,
 *    bác sĩ khác không thể ACK hộ.
 */
describe('Phân công của tôi — Bác sĩ xem & xác nhận nhận ca (My Assignments & Acknowledge)', () => {
  let mockHospitalId;
  let doctorA;
  let doctorB;
  let patient;
  let visitA;
  let visitB;
  let assignmentPending;
  let assignmentDone;
  let assignmentOtherDoctor;

  const makeRes = () => {
    const ctx = { statusCode: null, body: null };
    const res = {
      status(code) {
        ctx.statusCode = code;
        return {
          json(payload) {
            ctx.body = payload;
          },
        };
      },
    };
    return [res, ctx];
  };

  beforeAll(async () => {
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/neuroscan_test_logic';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    mockHospitalId = new mongoose.Types.ObjectId();
    const ts = Date.now();

    // Hai bác sĩ cùng bệnh viện
    const docA = await User.create({
      hospitalId: mockHospitalId,
      email: `myassign_doctor_a_${ts}@hospital.local`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789dummyhash',
      role: 'doctor',
      profile: { name: 'BS. Nguyễn Văn A (Test)', specialty: 'Ngoại Thần Kinh' },
    });
    const docB = await User.create({
      hospitalId: mockHospitalId,
      email: `myassign_doctor_b_${ts}@hospital.local`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789dummyhash',
      role: 'doctor',
      profile: { name: 'BS. Trần Văn B (Test)', specialty: 'Chẩn đoán Hình ảnh' },
    });
    doctorA = { id: docA._id.toString(), _id: docA._id, role: 'doctor', hospitalId: mockHospitalId, profile: docA.profile };
    doctorB = { id: docB._id.toString(), _id: docB._id, role: 'doctor', hospitalId: mockHospitalId, profile: docB.profile };

    // Bệnh nhân + 2 lượt khám
    patient = await User.create({
      hospitalId: mockHospitalId,
      email: `myassign_patient_${ts}@hospital.local`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789dummyhash',
      role: 'patient',
      profile: { name: 'Bệnh nhân Lê Thị Test (Glioma)' },
    });

    visitA = await Visit.create({
      hospitalId: mockHospitalId,
      patientId: patient._id,
      doctorId: docA._id,
      status: 'chờ bác sĩ đọc',
      priority: 'cao',
      reason: 'Đau đầu tăng dần 2 tuần — nghi u não',
    });
    visitB = await Visit.create({
      hospitalId: mockHospitalId,
      patientId: patient._id,
      doctorId: docA._id,
      status: 'đang khám',
      priority: 'khẩn cấp',
      reason: 'Khó nói, méo miệng nửa phải',
    });

    // 3 phân công: 1 pending (doctor A, read), 1 completed (doctor A, treat),
    // 1 pending của doctor B (để kiểm tra cô lập)
    assignmentPending = await Assignment.create({
      hospitalId: mockHospitalId,
      visitId: visitA._id,
      doctorId: docA._id,
      type: 'read',
      status: 'pending',
      priority: 2,
      deadlineAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
    });
    assignmentDone = await Assignment.create({
      hospitalId: mockHospitalId,
      visitId: visitB._id,
      doctorId: docA._id,
      type: 'treat',
      status: 'completed',
      priority: 1,
      completedAt: new Date(),
    });
    assignmentOtherDoctor = await Assignment.create({
      hospitalId: mockHospitalId,
      visitId: visitB._id,
      doctorId: docB._id,
      type: 'read',
      status: 'pending',
      priority: 3,
      deadlineAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
    });
  });

  afterAll(async () => {
    await Assignment.deleteMany({ hospitalId: mockHospitalId });
    await Visit.deleteMany({ hospitalId: mockHospitalId });
    await User.deleteMany({ hospitalId: mockHospitalId, email: /myassign_.*@hospital\.local/ });
  });

  test('1. GET /assignments/my trả kèm TÊN BỆNH NHÂN qua populate 2 cấp (visit → patient) — không còn ObjectId trơ', async () => {
    const req = { user: doctorA, query: {} };
    const [res, ctx] = makeRes();
    await getMyAssignments(req, res);

    expect(ctx.statusCode).toBe(200);
    expect(ctx.body.success).toBe(true);
    expect(Array.isArray(ctx.body.data)).toBe(true);

    const pendingItem = ctx.body.data.find((a) => a._id.toString() === assignmentPending._id.toString());
    expect(pendingItem).toBeTruthy();
    // Trước patch 0013: visitId.patientId là ObjectId string — không có profile.name
    expect(typeof pendingItem.visitId.patientId).toBe('object');
    expect(pendingItem.visitId.patientId.profile.name).toBe('Bệnh nhân Lê Thị Test (Glioma)');
    // Ngữ cảnh lâm sàng đi kèm
    expect(pendingItem.visitId.reason).toBe('Đau đầu tăng dần 2 tuần — nghi u não');
    expect(pendingItem.visitId.status).toBe('chờ bác sĩ đọc');
  });

  test('2. Lọc ?status=pending chỉ trả ca đang chờ xác nhận', async () => {
    const req = { user: doctorA, query: { status: 'pending' } };
    const [res, ctx] = makeRes();
    await getMyAssignments(req, res);

    expect(ctx.statusCode).toBe(200);
    expect(ctx.body.data.length).toBe(1);
    expect(ctx.body.data[0].status).toBe('pending');
    expect(ctx.body.data[0].type).toBe('read');
  });

  test('3. Cô lập theo bác sĩ: danh sách của A không chứa ca của B', async () => {
    const req = { user: doctorA, query: {} };
    const [res, ctx] = makeRes();
    await getMyAssignments(req, res);

    const ids = ctx.body.data.map((a) => a.doctorId?.toString?.() || String(a.doctorId));
    // Runner expect không hỗ trợ .not.toContain → assert positivo qua includes()
    expect(ids.includes(assignmentOtherDoctor.doctorId.toString())).toBe(false);
    expect(ctx.body.data.length).toBe(2); // pending + completed của A
  });

  test('4. Bác sĩ ACK ca pending: chuyển sang acknowledged, có mốc acknowledgedAt', async () => {
    const req = { user: doctorA, params: { id: assignmentPending._id.toString() } };
    const [res, ctx] = makeRes();
    await acknowledgeAssignment(req, res);

    expect(ctx.statusCode).toBe(200);
    expect(ctx.body.success).toBe(true);
    expect(ctx.body.data.assignment.status).toBe('acknowledged');
    expect(ctx.body.data.assignment.acknowledgedAt).toBeTruthy();

    const fresh = await Assignment.findById(assignmentPending._id);
    expect(fresh.status).toBe('acknowledged');
    expect(fresh.acknowledgedAt instanceof Date).toBe(true);
  });

  test('5. ACK lần hai bị từ chối (400) — ca đã được xác nhận trước đó', async () => {
    const req = { user: doctorA, params: { id: assignmentPending._id.toString() } };
    const [res, ctx] = makeRes();
    await acknowledgeAssignment(req, res);

    expect(ctx.statusCode).toBe(400);
    expect(ctx.body.success).toBe(false);
    expect(ctx.body.message).toContain('đã được xác nhận');
  });

  test('6. Bác sĩ khác không ACK hộ ca của A (404 — không tìm thấy hoặc không có quyền)', async () => {
    const req = { user: doctorB, params: { id: assignmentPending._id.toString() } };
    const [res, ctx] = makeRes();
    await acknowledgeAssignment(req, res);

    expect(ctx.statusCode).toBe(404);
    expect(ctx.body.success).toBe(false);
  });

  test('7. Chặn ObjectId sai định dạng sớm (400) — không lộ CastError 500', async () => {
    const req = { user: doctorA, params: { id: 'khong-phai-objectid' } };
    const [res, ctx] = makeRes();
    await acknowledgeAssignment(req, res);

    expect(ctx.statusCode).toBe(400);
    expect(ctx.body.success).toBe(false);
    expect(ctx.body.message).toContain('không hợp lệ');
  });
});
