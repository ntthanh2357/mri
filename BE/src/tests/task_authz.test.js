import { canUpdateTask } from '../controllers/task.controller.js';
import { User } from '../modules/auth/models/user.model.js';

const task = (overrides = {}) => ({
  roleRequired: 'doctor',
  assignedToUserId: null,
  ...overrides,
});

const user = (overrides = {}) => ({
  id: 'u1',
  role: 'doctor',
  hospitalId: 'h1',
  ...overrides,
});

describe('Phân quyền cập nhật task quy trình (P2-6)', () => {
  it('bác sĩ được tick bước yêu cầu bác sĩ', () => {
    expect(canUpdateTask(task(), user())).toBe(true);
  });

  it('lễ tân KHÔNG được tick "Đọc & ký báo cáo" của bác sĩ', () => {
    expect(canUpdateTask(task({ roleRequired: 'doctor' }), user({ role: 'receptionist' }))).toBe(false);
  });

  it('điều dưỡng KHÔNG được tick bước kỹ thuật viên', () => {
    expect(canUpdateTask(task({ roleRequired: 'technician' }), user({ role: 'nurse' }))).toBe(false);
  });

  it('task đã giao cho người khác thì đồng nghiệp cùng role không được tick thay', () => {
    const assigned = task({ assignedToUserId: 'other-doctor' });
    expect(canUpdateTask(assigned, user())).toBe(false);
  });

  it('người được giao trực tiếp được tick dù role khác bước', () => {
    const assigned = task({ roleRequired: 'nurse', assignedToUserId: 'u1' });
    expect(canUpdateTask(assigned, user({ role: 'nurse' }))).toBe(true);
  });

  it('quản trị bệnh viện được xử lý mọi bước trong viện', () => {
    for (const role of ['hospital_admin', 'admin', 'system_admin']) {
      expect(canUpdateTask(task(), user({ role }))).toBe(true);
    }
  });

  it('bước auto của hệ thống không cho nhân viên tự tick', () => {
    expect(canUpdateTask(task({ roleRequired: 'auto' }), user())).toBe(false);
  });

  it('thiếu task hoặc user thì từ chối', () => {
    expect(canUpdateTask(null, user())).toBe(false);
    expect(canUpdateTask(task(), null)).toBe(false);
  });
});

describe('Enum vai trò người dùng (P2-5)', () => {
  it('model User chấp nhận system_admin và cleaner — trước đây là quyền chết', () => {
    const roles = User.schema.path('role').enumValues;
    expect(roles.includes('system_admin')).toBe(true);
    expect(roles.includes('cleaner')).toBe(true);
    expect(roles.includes('pharmacist')).toBe(true);
  });

  it('model User có trường xóa mềm để giữ hồ sơ liên quan (P2-4)', () => {
    expect(User.schema.path('isDeleted')).toBeDefined();
    expect(User.schema.path('deletedAt')).toBeDefined();
    expect(User.schema.path('deletedBy')).toBeDefined();
  });
});
