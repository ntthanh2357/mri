import router from '../routes/patient.routes.js';

// Lấy middleware phân quyền (phần tử đầu của route, sau `router.use(protect)`) cho method + path
const authzOf = (method, path) => {
  const layer = router.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
  if (!layer) throw new Error(`Không tìm thấy route ${method.toUpperCase()} ${path}`);
  return layer.route.stack[0].handle;
};

// Chạy middleware với user giả, trả về 'next' nếu cho qua hoặc mã HTTP nếu chặn
const run = (mw, user, patientId) => new Promise((resolve) => {
  const req = { user, params: { patientId } };
  const res = {
    status(code) { this.code = code; return this; },
    json() { resolve(this.code); return this; },
  };
  mw(req, res, () => resolve('next'));
});

describe('Phân quyền route dữ liệu lâm sàng bệnh nhân (/api/patients)', () => {
  it('bệnh nhân KHÔNG được tự thêm sinh hiệu cho chính mình (trước đây được phép)', async () => {
    const result = await run(authzOf('post', '/:patientId/vitals'), { id: 'p1', role: 'patient' }, 'p1');
    expect(result).toBe(403);
  });

  it('điều dưỡng vẫn thêm được sinh hiệu', async () => {
    const result = await run(authzOf('post', '/:patientId/vitals'), { id: 'n1', role: 'nurse' }, 'p1');
    expect(result).toBe('next');
  });

  it('bệnh nhân vẫn xem được sinh hiệu của chính mình, không xem được của người khác', async () => {
    const mw = authzOf('get', '/:patientId/vitals');
    expect(await run(mw, { id: 'p1', role: 'patient' }, 'p1')).toBe('next');
    expect(await run(mw, { id: 'p1', role: 'patient' }, 'p2')).toBe(403);
  });

  it('lễ tân xem được danh sách bệnh nhân (để tiếp nhận); bệnh nhân thì không', async () => {
    expect(await run(authzOf('get', '/'), { id: 'r1', role: 'receptionist' })).toBe('next');
    expect(await run(authzOf('get', '/'), { id: 'p1', role: 'patient' })).toBe(403);
  });

  it('các route ghi khác cũng chặn bệnh nhân', async () => {
    for (const path of ['/:patientId/lab-orders', '/:patientId/prescriptions', '/:patientId/discharge-papers', '/:patientId/transfer-forms']) {
      expect(await run(authzOf('post', path), { id: 'p1', role: 'patient' }, 'p1')).toBe(403);
    }
  });
});
