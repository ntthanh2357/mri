import router from '../routes/queueTicket.routes.js';

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

describe('Phân quyền route số thứ tự tiếp đón (/api/v1/queue-tickets)', () => {
  it('chỉ bệnh nhân được lấy/huỷ/xem số của mình', async () => {
    expect(await run(authzOf('post', '/'), 'patient')).toBe('next');
    expect(await run(authzOf('post', '/'), 'receptionist')).toBe(403);
    expect(await run(authzOf('put', '/me/cancel'), 'doctor')).toBe(403);
  });

  it('chỉ quầy tiếp đón (lễ tân, điều dưỡng, quản lý viện) được gọi số; bệnh nhân và bác sĩ bị chặn', async () => {
    for (const role of ['receptionist', 'nurse', 'hospital_admin']) expect(await run(authzOf('post', '/call-next'), role)).toBe('next');
    for (const role of ['patient', 'doctor']) expect(await run(authzOf('post', '/call-next'), role)).toBe(403);
    expect(await run(authzOf('put', '/:id/served'), 'patient')).toBe(403);
  });
});
