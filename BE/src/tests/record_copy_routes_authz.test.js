import patientRouter from '../routes/patientRecord.routes.js';
import copyRouter from '../routes/recordCopy.routes.js';
import { protect } from '../middlewares/auth.middleware.js';

// Middleware phân quyền của route (phần tử đầu của route)
const authzOf = (router, method, path) => {
  const layer = router.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
  if (!layer) throw new Error(`Không tìm thấy route ${method.toUpperCase()} ${path}`);
  return layer.route.stack[0].handle;
};
const run = (mw, role) => new Promise((resolve) => {
  const res = { status(code) { this.code = code; return this; }, json() { resolve(this.code); return this; } };
  mw({ user: { id: 'u1', role } }, res, () => resolve('next'));
});
const at = (router, pred) => router.stack.findIndex(pred);

describe('Phân quyền bản sao bệnh án', () => {
  it('phía bệnh nhân (/api/v1/patient/record-copies, /chat): chỉ bệnh nhân', async () => {
    for (const [m, p] of [['post', '/record-copies'], ['get', '/record-copies'], ['put', '/record-copies/:id/cancel'], ['post', '/record-copies/:id/download'], ['post', '/chat'],
      ['get', '/chat/consent'], ['put', '/chat/consent'], ['delete', '/chat/consent']]) {
      expect(await run(authzOf(patientRouter, m, p), 'patient')).toBe('next');
      for (const role of ['doctor', 'nurse', 'receptionist', 'hospital_admin', 'admin']) expect(await run(authzOf(patientRouter, m, p), role)).toBe(403);
    }
  });

  it('phía bệnh viện (/api/v1/record-copies): chỉ lễ tân và quản lý bệnh viện, phải đăng nhập trước', async () => {
    const protectAt = at(copyRouter, (l) => !l.route && l.handle === protect);
    for (const [m, p] of [['get', '/'], ['put', '/:id/approve'], ['put', '/:id/reject']]) {
      expect(at(copyRouter, (l) => l.route && l.route.path === p && l.route.methods[m]) > protectAt).toBe(true);
      for (const role of ['receptionist', 'hospital_admin']) expect(await run(authzOf(copyRouter, m, p), role)).toBe('next');
      for (const role of ['patient', 'doctor', 'nurse', 'technician', 'admin']) expect(await run(authzOf(copyRouter, m, p), role)).toBe(403);
    }
  });

  it('tải file theo token là route công khai duy nhất, đứng trước bước đăng nhập', () => {
    const protectAt = at(copyRouter, (l) => !l.route && l.handle === protect);
    const fileAt = at(copyRouter, (l) => l.route && l.route.path === '/file/:token');
    expect(protectAt >= 0 && fileAt >= 0 && fileAt < protectAt).toBe(true);
    expect(copyRouter.stack.filter((l, i) => l.route && i < protectAt).length).toBe(1);
  });
});

describe('Giới hạn tải PDF đếm theo người được cấp link, không theo IP tự khai', () => {
  it('khoá đếm lấy uid trong token; token rác thì đếm theo IP', async () => {
    const { tokenUserKey } = await import('../middlewares/rateLimiter.middleware.js');
    const payload = Buffer.from(JSON.stringify({ uid: 'abc123', purpose: 'record-copy-pdf' })).toString('base64url');
    const key = tokenUserKey('record-copy-file');
    expect(key({ params: { token: `x.${payload}.y` } }, '1.2.3.4')).toBe('record-copy-file:abc123');
    expect(key({ params: { token: 'rac' } }, '1.2.3.4')).toBe('record-copy-file:1.2.3.4');
    expect(key({ params: {} }, '5.6.7.8')).toBe('record-copy-file:5.6.7.8');
  });
});
