import mongoose from 'mongoose';
import { User } from '../models/user.model.js';
import { AuditLog } from '../models/auditLog.model.js';
import {
  lockUserById,
  unlockUserById,
  lockUser,
} from '../modules/hospital/admin.controller.js';

/**
 * [0022-AdminLockRole] Regression test cho bug P1 "Khóa/mở khóa user luôn 403":
 * controller KHÔNG truyền req.user.role vào service → canModerateRole(undefined, ...)
 * luôn false → mọi admin đều bị chặn, kèm status 500 thay vì 403.
 *
 * Verifies:
 *  - admin (role 'admin') lock/unlock doctor qua controller → 200, DB đổi isLocked
 *  - hospital_admin lock doctor → 200
 *  - hospital_admin lock admin → 403 (đúng rank), KHÔNG phải 500
 *  - legacy POST /users/lock (toggleUserLock) cũng truyền role
 *  - ROLE_RANK đủ pharmacist/receptionist → admin lock pharmacist → 200
 */
describe('Admin Backoffice — Khóa/mở khóa tài khoản truyền đúng vai trò (Lock/Unlock actorRole)', () => {
  let admin, hospitalAdmin, doctor, pharmacist;
  const ts = Date.now();

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
    await User.deleteMany({ email: new RegExp(`^lockrole_.*_${ts}@`) });
    await AuditLog.deleteMany({});

    const mk = (email, role) => User.create({
      email,
      passwordHash: 'hash_placeholder',
      role,
      isVerified: true,
      isLocked: false,
      tokenVersion: 0,
      profile: { name: `Test ${role}` },
    });

    admin = await mk(`lockrole_admin_${ts}@hospital.local`, 'admin');
    hospitalAdmin = await mk(`lockrole_hadmin_${ts}@hospital.local`, 'hospital_admin');
    doctor = await mk(`lockrole_doctor_${ts}@hospital.local`, 'doctor');
    pharmacist = await mk(`lockrole_pharm_${ts}@hospital.local`, 'pharmacist');
  });

  afterAll(async () => {
    await User.deleteMany({ email: new RegExp(`^lockrole_.*_${ts}@`) });
    await AuditLog.deleteMany({});
  });

  it('admin khóa được doctor qua PUT /admin/users/:id/lock (trước đây luôn 403)', async () => {
    const [res, ctx] = makeRes();
    await lockUserById(
      { params: { id: doctor._id.toString() }, user: { id: admin._id.toString(), role: 'admin' } },
      res
    );
    expect(ctx.statusCode).toBe(200);
    expect(ctx.body.success).toBe(true);
    expect(ctx.body.user.isLocked).toBe(true);
    const dbUser = await User.findById(doctor._id).lean();
    expect(dbUser.isLocked).toBe(true);
  });

  it('admin mở khóa lại được doctor qua PUT /admin/users/:id/unlock', async () => {
    const [res, ctx] = makeRes();
    await unlockUserById(
      { params: { id: doctor._id.toString() }, user: { id: admin._id.toString(), role: 'admin' } },
      res
    );
    expect(ctx.statusCode).toBe(200);
    expect(ctx.body.user.isLocked).toBe(false);
    const dbUser = await User.findById(doctor._id).lean();
    expect(dbUser.isLocked).toBe(false);
  });

  it('hospital_admin khóa được doctor (rank 2 > 1)', async () => {
    const [res, ctx] = makeRes();
    await lockUserById(
      { params: { id: doctor._id.toString() }, user: { id: hospitalAdmin._id.toString(), role: 'hospital_admin' } },
      res
    );
    expect(ctx.statusCode).toBe(200);
    expect(ctx.body.user.isLocked).toBe(true);
  });

  it('hospital_admin KHÔNG khóa được admin — trả 403 (không phải 500 như trước)', async () => {
    const [res, ctx] = makeRes();
    await lockUserById(
      { params: { id: admin._id.toString() }, user: { id: hospitalAdmin._id.toString(), role: 'hospital_admin' } },
      res
    );
    expect(ctx.statusCode).toBe(403);
    expect(ctx.body.success).toBe(false);
    expect(ctx.body.message).toContain('không có quyền');
    // DB không đổi
    const dbUser = await User.findById(admin._id).lean();
    expect(dbUser.isLocked).toBe(false);
  });

  it('admin khóa được pharmacist — ROLE_RANK đã đủ role pharmacist (trước đây rơi rank 0)', async () => {
    const [res, ctx] = makeRes();
    await lockUserById(
      { params: { id: pharmacist._id.toString() }, user: { id: admin._id.toString(), role: 'admin' } },
      res
    );
    expect(ctx.statusCode).toBe(200);
    expect(ctx.body.user.isLocked).toBe(true);
  });

  it('legacy POST /admin/users/lock (toggleUserLock) cũng truyền role — admin unlock pharmacist', async () => {
    const [res, ctx] = makeRes();
    await lockUser(
      {
        body: { userId: pharmacist._id.toString(), isLocked: false },
        user: { id: admin._id.toString(), role: 'admin' },
      },
      res
    );
    expect(ctx.statusCode).toBe(200);
    expect(ctx.body.user.isLocked).toBe(false);
  });

  it('mỗi lần đổi trạng thái tạo đúng 1 AuditLog lock-user/unlock-user', async () => {
    const logs = await AuditLog.find({ entity: 'User', entityId: doctor._id.toString() }).lean();
    // doctor: lock (admin) + unlock (admin) + lock (hospital_admin) = 3 bản ghi
    expect(logs.filter((l) => l.action === 'lock-user').length).toBe(2);
    expect(logs.filter((l) => l.action === 'unlock-user').length).toBe(1);
  });
});
