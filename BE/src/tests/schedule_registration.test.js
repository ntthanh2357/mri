import mongoose from 'mongoose';
import { getDayRangeVN, getWeekRangeVN } from '../utils/date.util.js';
import { WorkSchedule } from '../models/workSchedule.model.js';
import { User } from '../models/user.model.js';
import {
  registerSchedule,
  getShiftRegistrations,
  reviewShiftRegistration,
  cancelMyRegistration,
  getWeeklySchedules,
  getMySchedules,
} from '../controllers/schedule.controller.js';

describe('Đăng ký lịch làm việc & Phân ca nhân sự (Work Schedule Registration & Timezone Resilience)', () => {
  let mockHospitalId;
  let doctorUser;
  let adminUser;

  beforeAll(async () => {
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/neuroscan_test_logic';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    mockHospitalId = new mongoose.Types.ObjectId();
    
    // Tạo giả lập user bác sĩ và admin
    doctorUser = {
      id: new mongoose.Types.ObjectId().toString(),
      _id: new mongoose.Types.ObjectId(),
      role: 'doctor',
      hospitalId: mockHospitalId,
      profile: { name: 'BS. Lê Minh Trí' },
    };

    adminUser = {
      id: new mongoose.Types.ObjectId().toString(),
      _id: new mongoose.Types.ObjectId(),
      role: 'hospital_admin',
      hospitalId: mockHospitalId,
      profile: { name: 'Trưởng khoa Thần kinh' },
    };
  });

  test('1. Thuật toán getWeekRangeVN tính chính xác Thứ 2 đến Chủ nhật theo múi giờ VN (GMT+7), không bị trôi tuần khi dùng ISO string', () => {
    // Giả sử ngày gửi lên là Thứ Tư 2026-09-30T10:00:00Z
    const testDate = new Date('2026-09-30T10:00:00Z');
    const { start, end, mondayDateStr, sundayDateStr } = getWeekRangeVN(testDate);

    expect(mondayDateStr).toBe('2026-09-28');
    expect(sundayDateStr).toBe('2026-10-04');
    expect(start.getHours()).toBe(0);
    expect(end.getHours()).toBe(23);

    // Thử với Chủ Nhật lúc 23:30 tối tại VN (16:30Z cùng ngày)
    const sundayNight = new Date('2026-10-04T16:30:00Z');
    const sundayRes = getWeekRangeVN(sundayNight);
    expect(sundayRes.mondayDateStr).toBe('2026-09-28');
    expect(sundayRes.sundayDateStr).toBe('2026-10-04');

    // Thử với rạng sáng Thứ Hai lúc 01:00 sáng tại VN (18:00Z ngày Chủ Nhật trước đó)
    const mondayDawn = new Date('2026-09-27T18:00:00Z'); // 2026-09-28 01:00 VN
    const mondayRes = getWeekRangeVN(mondayDawn);
    expect(mondayRes.mondayDateStr).toBe('2026-09-28');
    expect(mondayRes.sundayDateStr).toBe('2026-10-04');
  });

  test('2. Nhân viên đăng ký ca làm: Tự động gán giờ mặc định chuẩn ca và đặt status là pending', async () => {
    const req = {
      user: doctorUser,
      body: {
        date: '2026-09-29',
        shift: 'sáng',
        notes: 'Đăng ký ca trực phòng máy MRI 3.0T',
      },
    };

    let responseData = null;
    let statusCode = null;

    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            responseData = data;
          },
        };
      },
    };

    await registerSchedule(req, res);

    expect(statusCode).toBe(201);
    expect(responseData.success).toBe(true);
    expect(responseData.data.schedule.shift).toBe('sáng');
    expect(responseData.data.schedule.startTime).toBe('07:00');
    expect(responseData.data.schedule.endTime).toBe('15:00');
    expect(responseData.data.schedule.status).toBe('pending');
  });

  test('3. Chặn đăng ký trùng ca trong cùng một ngày', async () => {
    const req = {
      user: doctorUser,
      body: {
        date: '2026-09-29',
        shift: 'sáng',
        notes: 'Cố tình đăng ký lặp ca',
      },
    };

    let responseData = null;
    let statusCode = null;

    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            responseData = data;
          },
        };
      },
    };

    await registerSchedule(req, res);

    expect(statusCode).toBe(409);
    expect(responseData.success).toBe(false);
  });

  test('4. Admin xem danh sách đăng ký ca (getShiftRegistrations) và duyệt ca trực (reviewShiftRegistration)', async () => {
    // 1. Get registrations as Admin
    const getReq = {
      user: adminUser,
      query: { status: 'pending' },
    };
    let getResult = null;
    const getRes = {
      status: (c) => ({
        json: (d) => { getResult = d; },
      }),
    };

    await getShiftRegistrations(getReq, getRes);
    expect(getResult.success).toBe(true);
    expect(getResult.data.registrations.length > 0).toBe(true);

    const pendingItem = getResult.data.registrations[0];
    expect(pendingItem.status).toBe('pending');

    // 2. Admin approves the registration
    const reviewReq = {
      user: adminUser,
      params: { id: pendingItem._id },
      body: {
        status: 'confirmed',
        reviewNotes: 'Đã duyệt ca trực sáng.',
      },
    };
    let reviewResult = null;
    const reviewRes = {
      status: (c) => ({
        json: (d) => { reviewResult = d; },
      }),
    };

    await reviewShiftRegistration(reviewReq, reviewRes);
    expect(reviewResult.success).toBe(true);
    expect(reviewResult.data.schedule.status).toBe('confirmed');
    expect(reviewResult.data.schedule.reviewNotes).toBe('Đã duyệt ca trực sáng.');
  });

  test('5. Hủy phiếu đăng ký ca trực (cancelMyRegistration): Bác sĩ có thể hủy khi ca đang pending', async () => {
    // Tạo một ca trực pending mới
    const schedule = new WorkSchedule({
      hospitalId: mockHospitalId,
      staffId: doctorUser.id,
      date: new Date('2026-09-30T00:00:00.000+07:00'),
      shift: 'chiều',
      startTime: '14:00',
      endTime: '22:00',
      status: 'pending',
    });
    await schedule.save();

    const cancelReq = {
      user: doctorUser,
      params: { id: schedule._id.toString() },
    };
    let cancelResult = null;
    const cancelRes = {
      status: (c) => ({
        json: (d) => { cancelResult = d; },
      }),
    };

    await cancelMyRegistration(cancelReq, cancelRes);
    expect(cancelResult.success).toBe(true);

    const check = await WorkSchedule.findById(schedule._id);
    expect(check).toBe(null);
  });
});
