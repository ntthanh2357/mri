import router from '../routes/visit.routes.js';

// Middleware phân quyền của route (đứng sau `protect` trong route): trả 'next' nếu cho qua, mã HTTP nếu chặn
const authzOf = (method, path) => {
  const layer = router.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
  if (!layer) throw new Error(`Không tìm thấy route ${method.toUpperCase()} ${path}`);
  if (layer.route.stack.length < 3) throw new Error(`Route ${method.toUpperCase()} ${path} không có bước phân quyền role`);
  return layer.route.stack[1].handle;
};
const run = (mw, user) => new Promise((resolve) => {
  const res = { status(code) { this.code = code; return this; }, json() { resolve(this.code); return this; } };
  mw({ user, params: {} }, res, () => resolve('next'));
});

describe('Phân quyền route lượt khám (/api/v1/visits)', () => {
  it('bệnh nhân KHÔNG gọi được hàng đợi nhân viên (trước đây thấy toàn bộ lượt khám của bệnh viện)', async () => {
    expect(await run(authzOf('get', '/my-queue'), { id: 'p1', role: 'patient', hospitalId: 'h1' })).toBe(403);
  });

  it('các vai trò nhân viên vẫn xem được hàng đợi', async () => {
    for (const role of ['doctor', 'nurse', 'technician', 'receptionist', 'hospital_admin', 'admin']) {
      expect(await run(authzOf('get', '/my-queue'), { id: 's1', role, hospitalId: 'h1' })).toBe('next');
    }
  });
});
