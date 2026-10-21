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

  it('giấy tờ tự quét: chỉ bệnh nhân được quét, xem, sửa, xoá — kiểm quyền trước khi nhận file', async () => {
    for (const [m, p] of [['post', '/scanned-documents'], ['get', '/scanned-documents'], ['put', '/scanned-documents/:id'], ['delete', '/scanned-documents/:id'],
      ['get', '/scanned-documents/consent'], ['put', '/scanned-documents/consent'], ['delete', '/scanned-documents/consent']]) {
      expect(await run(authzOf(m, p), 'patient')).toBe('next');
      for (const role of ['doctor', 'nurse', 'receptionist', 'admin']) expect(await run(authzOf(m, p), role)).toBe(403);
    }
  });

  it('route "/scanned-documents/consent" đứng trước "/:id" (không thì "consent" bị hiểu là mã giấy tờ)', () => {
    const at = (method, path) => router.stack.findIndex((l) => l.route && l.route.path === path && l.route.methods[method]);
    for (const m of ['put', 'delete']) expect(at(m, '/scanned-documents/consent') < at(m, '/scanned-documents/:id')).toBe(true);
  });
});

describe('Phân quyền nhân viên quét mã chia sẻ trong app (/api/v1/shared-records/redeem-staff)', () => {
  it('chỉ bác sĩ, điều dưỡng, lễ tân, kỹ thuật viên; bệnh nhân và quản trị không dùng được; phải đăng nhập trước', async () => {
    const { default: shared } = await import('../routes/sharedRecord.routes.js');
    const { protect } = await import('../middlewares/auth.middleware.js');
    const stack = shared.stack.find((l) => l.route && l.route.path === '/redeem-staff' && l.route.methods.post).route.stack;
    expect(stack[0].handle).toBe(protect); // xác thực đứng trước
    const authz = stack[1].handle;
    for (const role of ['doctor', 'nurse', 'receptionist', 'technician']) expect(await run(authz, role)).toBe('next');
    for (const role of ['patient', 'admin', 'hospital_admin']) expect(await run(authz, role)).toBe(403);
  });
});

describe('Giới hạn tần suất của quét giấy tờ và ảnh chia sẻ', () => {
  // Gọi 1 middleware giới hạn tần suất với IP / tài khoản cho trước
  const hit = (mw, { ip, userId, baseUrl = '' }) => new Promise((resolve) => {
    const res = { setHeader() {}, status(code) { this.code = code; return this; }, json() { resolve(this.code); return this; } };
    mw({ headers: { 'x-forwarded-for': ip }, baseUrl, body: {}, user: userId ? { id: userId } : undefined }, res, () => resolve('next'));
  });
  let saved;
  beforeAll(() => { saved = process.env.ENABLE_RATE_LIMIT; process.env.ENABLE_RATE_LIMIT = 'true'; });
  afterAll(() => { if (saved === undefined) delete process.env.ENABLE_RATE_LIMIT; else process.env.ENABLE_RATE_LIMIT = saved; });

  it('quét giấy tờ đếm theo tài khoản: đổi header X-Forwarded-For không lách được; người khác cùng Wi-Fi không bị vạ lây', async () => {
    const limiter = router.stack.find((l) => l.route && l.route.path === '/scanned-documents' && l.route.methods.post).route.stack[1].handle;
    const userId = `rl-${Date.now()}`;
    const results = [];
    for (let i = 0; i < 7; i += 1) results.push(await hit(limiter, { ip: `10.0.0.${i}`, userId })); // mỗi lần 1 IP giả khác nhau
    expect(results.slice(0, 6).every((r) => r === 'next')).toBe(true);
    expect(results[6]).toBe(429);
    expect(await hit(limiter, { ip: '10.0.0.6', userId: `${userId}-nguoi-khac` })).toBe('next');
  });

  it('tải nhiều ảnh giấy tờ không ăn vào hạn mức mở bệnh án (redeem/view) của cùng địa chỉ IP', async () => {
    const { default: shared } = await import('../routes/sharedRecord.routes.js');
    const imageLimiter = shared.stack.find((l) => l.route && l.route.path === '/document-image/:token').route.stack[0].handle;
    const viewLimiter = shared.stack.find((l) => !l.route).handle; // router.use(...) cho redeem/view
    const ip = `172.16.${Date.now() % 250}.9`;
    const baseUrl = '/api/v1/shared-records';
    for (let i = 0; i < 40; i += 1) expect(await hit(imageLimiter, { ip, baseUrl })).toBe('next');
    expect(await hit(viewLimiter, { ip, baseUrl })).toBe('next');
  });
});
