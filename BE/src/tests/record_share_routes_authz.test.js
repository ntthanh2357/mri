import router from '../routes/patientRecord.routes.js';

// Middleware phân quyền của route (phần tử đầu, sau `router.use(protect)`)
const authzOf = (method, path) => {
  const layer = router.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
  if (!layer) throw new Error(`Không tìm thấy route ${method.toUpperCase()} ${path}`);
  return layer.route.stack[0].handle;
};
const run = (mw, role) => new Promise((resolve) => {
  const res = { status(code) { this.code = code; return this; }, json() { resolve(this.code); return this; } };
  mw({ user: { id: 'u1', role } }, res, () => resolve('next'));
});

describe('Phân quyền chia sẻ bệnh án qua QR (/api/v1/patient/record-shares)', () => {
  it('chỉ bệnh nhân được tạo, xem danh sách và thu hồi chia sẻ của mình', async () => {
    for (const [m, p] of [['post', '/record-shares'], ['get', '/record-shares'], ['delete', '/record-shares/:id']]) {
      expect(await run(authzOf(m, p), 'patient')).toBe('next');
      for (const role of ['doctor', 'nurse', 'receptionist', 'admin']) expect(await run(authzOf(m, p), role)).toBe(403);
    }
  });
});
