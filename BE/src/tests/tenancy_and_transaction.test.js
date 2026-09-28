/**
 * NeuroScan AI - Multi-Tenant Tenancy (BOLA/IDOR) & ACID Transaction Audit Tests
 * Validates checkPatientTenancy authorization boundaries and atomic inventory management.
 */

import mongoose from 'mongoose';
import { User } from '../models/user.model.js';
import { Hospital } from '../models/hospital.model.js';
import { TransferForm } from '../models/transferForm.model.js';
import { Drug } from '../modules/pharmacy/models/drug.model.js';
import { Visit } from '../models/visit.model.js';
import { checkPatientTenancy } from '../utils/tenancy.util.js';
import { executeWithTransaction } from '../utils/transaction.util.js';
import { tenantStorage } from '../middlewares/tenant.middleware.js';
import { checkRole } from '../middlewares/auth.middleware.js';
import { authCache } from '../utils/authCache.util.js';
import { toggleUserLock } from '../services/user.service.js';

describe('Unit & Security Tests: Tenancy BOLA/IDOR & ACID Transaction Audit', () => {
  let hospA, hospB;
  let patientA, patientB, patientB2C;
  let doctorA, doctorB;
  let adminUser;
  let testDrug;

  beforeAll(async () => {
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/neuroscan_test_logic';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    // 1. Tạo 2 bệnh viện độc lập
    hospA = await Hospital.create({
      name: 'Bệnh viện Bạch Mai - Hà Nội',
      code: 'HOSP_BM_01',
      isActive: true
    });

    hospB = await Hospital.create({
      name: 'Bệnh viện Chợ Rẫy - TP.HCM',
      code: 'HOSP_CR_02',
      isActive: true
    });

    // 2. Tạo bệnh nhân thuộc BV A và BV B
    patientA = await User.create({
      email: 'patient.a@hospital.com',
      passwordHash: 'dummy_hash',
      role: 'patient',
      hospitalId: hospA._id,
      profile: { name: 'Nguyễn Văn Bệnh Nhân A', medicalId: 'PID_001' }
    });

    patientB = await User.create({
      email: 'patient.b@hospital.com',
      passwordHash: 'dummy_hash',
      role: 'patient',
      hospitalId: hospB._id,
      profile: { name: 'Trần Thị Bệnh Nhân B', medicalId: 'PID_002' }
    });

    // 3. Tạo bác sĩ thuộc BV A và BV B
    doctorA = await User.create({
      email: 'doctor.a@hospital.com',
      passwordHash: 'dummy_hash',
      role: 'doctor',
      hospitalId: hospA._id,
      profile: { name: 'BS. Lê Văn A' }
    });

    doctorB = await User.create({
      email: 'doctor.b@hospital.com',
      passwordHash: 'dummy_hash',
      role: 'doctor',
      hospitalId: hospB._id,
      profile: { name: 'BS. Phạm Văn B' }
    });

    adminUser = await User.create({
      email: 'admin.system@neuroscan.vn',
      passwordHash: 'dummy_hash',
      role: 'admin',
      profile: { name: 'Quản trị viên hệ thống' }
    });

    // 4. Tạo bệnh nhân tự do B2C (chưa gắn vào bệnh viện nào - hospitalId = null)
    patientB2C = await User.create({
      email: 'patient.b2c@gmail.com',
      passwordHash: 'dummy_hash',
      role: 'patient',
      hospitalId: null,
      profile: { name: 'Hoàng Văn Bệnh Nhân B2C', medicalId: 'PID_B2C_001' }
    });

    // 5. Tạo thuốc mẫu trong kho BV A
    testDrug = await Drug.create({
      hospitalId: hospA._id,
      name: 'Paracetamol 500mg',
      price: 5000,
      stock: {
        quantity: 20,
        unit: 'Viên',
        lastUpdated: new Date()
      }
    });
  });

  afterAll(async () => {
    if (hospA && hospB) {
      await Hospital.deleteMany({ _id: { $in: [hospA._id, hospB._id] } });
    }
    const userIds = [patientA?._id, patientB?._id, patientB2C?._id, doctorA?._id, doctorB?._id, adminUser?._id].filter(Boolean);
    if (userIds.length > 0) {
      await User.deleteMany({ _id: { $in: userIds } });
    }
    await Visit.deleteMany({ patientId: { $in: userIds } });
    if (testDrug) {
      await Drug.deleteMany({ _id: testDrug._id });
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  test('1. Bác sĩ BV A được phép truy xuất hồ sơ bệnh nhân BV A (Cùng viện)', async () => {
    const result = await checkPatientTenancy(patientA._id, {
      hospitalId: hospA._id,
      role: 'doctor',
      id: doctorA._id
    });
    expect(result).toBeDefined();
    expect(result._id.toString()).toBe(patientA._id.toString());
  });

  test('2. Chặn đứng BOLA/IDOR: Bác sĩ BV B không được phép xem bệnh nhân BV A (Khác viện)', async () => {
    const result = await checkPatientTenancy(patientA._id, {
      hospitalId: hospB._id,
      role: 'doctor',
      id: doctorB._id
    });
    expect(result).toBeNull();
  });

  test('3. Bác sĩ BV B chỉ được phép xem bệnh nhân BV A khi có Phiếu chuyển viện hợp lệ', async () => {
    // Tạo phiếu chuyển viện từ BV A sang BV B
    const transfer = await TransferForm.create({
      hospitalId: hospA._id,
      patient_id: patientA._id,
      targetHospitalId: hospB._id,
      doctor_name: 'BS. Lê Văn A',
      reason: '1',
      status: 'accepted'
    });

    const result = await checkPatientTenancy(patientA._id, {
      hospitalId: hospB._id,
      role: 'doctor',
      id: doctorB._id
    });
    expect(result).toBeDefined();
    expect(result._id.toString()).toBe(patientA._id.toString());

    // Dọn dẹp transfer
    await TransferForm.findByIdAndDelete(transfer._id);
  });

  test('4. Bệnh nhân A được phép xem chính hồ sơ của mình', async () => {
    const result = await checkPatientTenancy(patientA._id, {
      role: 'patient',
      id: patientA._id
    });
    expect(result).toBeDefined();
    expect(result._id.toString()).toBe(patientA._id.toString());
  });

  test('5. Chặn đứng BOLA/IDOR: Bệnh nhân A không thể xem trộm hồ sơ của Bệnh nhân B', async () => {
    const result = await checkPatientTenancy(patientB._id, {
      role: 'patient',
      id: patientA._id
    });
    expect(result).toBeNull();
  });

  test('6. Quản trị viên cấp cao (Admin) được phép xem hồ sơ giám sát hệ thống', async () => {
    const result = await checkPatientTenancy(patientA._id, {
      role: 'admin',
      id: adminUser._id
    });
    expect(result).toBeDefined();
    expect(result._id.toString()).toBe(patientA._id.toString());
  });

  test('7. Trừ kho nguyên tử với $inc và $gte: Thành công khi tồn kho đủ', async () => {
    let updateResult;
    await executeWithTransaction(async (session) => {
      const opts = session ? { session } : {};
      updateResult = await Drug.updateOne(
        { _id: testDrug._id, 'stock.quantity': { $gte: 5 } },
        { $inc: { 'stock.quantity': -5 }, $set: { 'stock.lastUpdated': new Date() } },
        opts
      );
    });

    expect(updateResult.modifiedCount).toBe(1);
    const updated = await Drug.findById(testDrug._id);
    expect(updated.stock.quantity).toBe(15);
  });

  test('8. Chặn đứng Race Condition / Âm kho: Thất bại khi yêu cầu vượt quá tồn kho', async () => {
    let updateResult;
    await executeWithTransaction(async (session) => {
      const opts = session ? { session } : {};
      updateResult = await Drug.updateOne(
        { _id: testDrug._id, 'stock.quantity': { $gte: 50 } }, // Hiện chỉ còn 15
        { $inc: { 'stock.quantity': -50 } },
        opts
      );
    });

    expect(updateResult.modifiedCount).toBe(0);
    const drugUnchanged = await Drug.findById(testDrug._id);
    expect(drugUnchanged.stock.quantity).toBe(15); // Số lượng không bị trừ sai lệch
  });

  test('9. Bệnh nhân tự do B2C: Bác sĩ chỉ xem được khi đã có lượt khám (Visit) tại viện', async () => {
    // a. Khi chưa có lượt khám, cả Bác sĩ A và Bác sĩ B đều không xem được hồ sơ của B2C
    const preCheckA = await checkPatientTenancy(patientB2C._id, {
      hospitalId: hospA._id,
      role: 'doctor',
      id: doctorA._id
    });
    expect(preCheckA).toBeNull();

    const preCheckB = await checkPatientTenancy(patientB2C._id, {
      hospitalId: hospB._id,
      role: 'doctor',
      id: doctorB._id
    });
    expect(preCheckB).toBeNull();

    // b. Bệnh nhân B2C đến tiếp đón và tạo lượt khám tại BV A
    const b2cVisit = await Visit.create({
      hospitalId: hospA._id,
      patientId: patientB2C._id,
      status: 'đang chờ'
    });

    // c. Giờ đây Bác sĩ BV A được phép truy xuất hồ sơ bệnh nhân B2C này
    const postCheckA = await checkPatientTenancy(patientB2C._id, {
      hospitalId: hospA._id,
      role: 'doctor',
      id: doctorA._id
    });
    expect(postCheckA).toBeDefined();
    expect(postCheckA._id.toString()).toBe(patientB2C._id.toString());

    // d. Bác sĩ BV B (vẫn chưa có lượt khám tại BV B) -> Vẫn bị chặn đứng tuyệt đối (403/null)
    const postCheckB = await checkPatientTenancy(patientB2C._id, {
      hospitalId: hospB._id,
      role: 'doctor',
      id: doctorB._id
    });
    expect(postCheckB).toBeNull();

    // e. Bệnh nhân B2C tự truy xuất hồ sơ của mình -> Thành công
    const selfCheck = await checkPatientTenancy(patientB2C._id, {
      role: 'patient',
      id: patientB2C._id
    });
    expect(selfCheck).toBeDefined();
    expect(selfCheck._id.toString()).toBe(patientB2C._id.toString());

    // Dọn dẹp
    await Visit.findByIdAndDelete(b2cVisit._id);
  });

  test('10. Fail-Safe Tenancy Plugin: Chống rò rỉ dữ liệu khi đứt gãy context (Context Loss)', async () => {
    const vA = await Visit.create({ hospitalId: hospA._id, patientId: patientA._id, status: 'đang chờ' });
    const vB = await Visit.create({ hospitalId: hospB._id, patientId: patientB._id, status: 'đang chờ' });

    // 1. Khi trong phiên bác sĩ BV A: Plugin tự động tiêm hospitalId của BV A
    await tenantStorage.run({ hospitalId: hospA._id.toString() }, async () => {
      const results = await Visit.find({ _id: { $in: [vA._id, vB._id] } });
      expect(results.length).toBe(1);
      expect(results[0]._id.toString()).toBe(vA._id.toString());
    });

    // 2. Khi mất context / không có hospitalId và không phải Super Admin:
    // Plugin kích hoạt Fail-Safe tự động tiêm { _id: null } -> Kết quả rỗng, không làm rò rỉ dữ liệu
    await tenantStorage.run({ hospitalId: null, isSuperAdmin: false }, async () => {
      const leakResults = await Visit.find({ _id: { $in: [vA._id, vB._id] } });
      expect(leakResults.length).toBe(0);
    });

    // Dọn dẹp
    await Visit.deleteMany({ _id: { $in: [vA._id, vB._id] } });
  });

  test('11. RBAC checkRole Integrity: Thẩm định mảng roles, rest params và chống Substring Bypass', () => {
    const mockRes = () => {
      let code = 200;
      let body = null;
      return {
        status: (c) => { code = c; return { json: (b) => { body = b; return b; } }; },
        getCode: () => code,
        getBody: () => body
      };
    };

    // Case 1: Mảng roles
    const mwArray = checkRole(['doctor', 'nurse']);
    let nextCalled = false;
    mwArray({ user: { role: 'doctor' } }, mockRes(), () => { nextCalled = true; });
    expect(nextCalled).toBe(true);

    const resForbidden = mockRes();
    nextCalled = false;
    mwArray({ user: { role: 'patient' } }, resForbidden, () => { nextCalled = true; });
    expect(nextCalled).toBe(false);
    expect(resForbidden.getCode()).toBe(403);

    // Case 2: Rest params
    const mwRest = checkRole('admin', 'hospital_admin');
    nextCalled = false;
    mwRest({ user: { role: 'hospital_admin' } }, mockRes(), () => { nextCalled = true; });
    expect(nextCalled).toBe(true);

    // Case 3: Chống substring match ("ad" không được bypass "admin")
    const mwStrict = checkRole('admin');
    const resSubstring = mockRes();
    nextCalled = false;
    mwStrict({ user: { role: 'ad' } }, resSubstring, () => { nextCalled = true; });
    expect(nextCalled).toBe(false);
    expect(resSubstring.getCode()).toBe(403);
  });

  test('12. Session Revocation: Thu hồi phiên tức thời và vô hiệu hóa Auth Cache khi khóa tài khoản', async () => {
    const targetUser = await User.create({
      email: 'staff.locked@hospital.com',
      passwordHash: 'dummy_hash',
      role: 'nurse',
      hospitalId: hospA._id,
      tokenVersion: 0,
      isLocked: false,
      profile: { name: 'Điều dưỡng Test Khóa' }
    });

    // Đưa vào authCache
    authCache.setUserAuth(targetUser._id.toString(), {
      tokenVersion: 0,
      isLocked: false,
      role: 'nurse',
      hospitalId: hospA._id.toString()
    }, 60000);

    expect(authCache.getUserAuth(targetUser._id.toString())).toBeDefined();

    // Admin khóa tài khoản
    await toggleUserLock(targetUser._id, true, adminUser._id);

    // Xác nhận cache bị xóa ngay lập tức
    expect(authCache.getUserAuth(targetUser._id.toString())).toBeNull();

    // Xác nhận DB đã đánh dấu isLocked = true và tăng tokenVersion
    const refreshed = await User.findById(targetUser._id);
    expect(refreshed.isLocked).toBe(true);
    expect(refreshed.tokenVersion).toBeGreaterThan(0);

    // Dọn dẹp
    await User.findByIdAndDelete(targetUser._id);
  });
});
