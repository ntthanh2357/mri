/**
 * NeuroScan AI - Multi-Tenant Tenancy (BOLA/IDOR) & ACID Transaction Audit Tests
 * Validates checkPatientTenancy authorization boundaries and atomic inventory management.
 */

import mongoose from 'mongoose';
import { User } from '../models/user.model.js';
import { Hospital } from '../models/hospital.model.js';
import { TransferForm } from '../models/transferForm.model.js';
import { Drug } from '../modules/pharmacy/models/drug.model.js';
import { checkPatientTenancy } from '../utils/tenancy.util.js';
import { executeWithTransaction } from '../utils/transaction.util.js';

describe('Unit & Security Tests: Tenancy BOLA/IDOR & ACID Transaction Audit', () => {
  let hospA, hospB;
  let patientA, patientB;
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

    // 4. Tạo thuốc mẫu trong kho BV A
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
    if (patientA && patientB) {
      await User.deleteMany({ _id: { $in: [patientA._id, patientB._id, doctorA._id, doctorB._id, adminUser._id] } });
    }
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
});
