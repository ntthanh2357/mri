import { EventEmitter } from 'node:events';
import router from '../routes/queueTicket.routes.js';
import { formatSseEvent, publishQueueEvent, subscribeQueueEvents } from '../services/queueEvents.service.js';
import { streamEvents } from '../controllers/queueTicket.controller.js';

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

  it('stream SSE /stream cho phép bệnh nhân và quầy tiếp đón; chặn bác sĩ/KTV/dược sĩ', async () => {
    for (const role of ['patient', 'receptionist', 'nurse', 'hospital_admin']) {
      expect(await run(authzOf('get', '/stream'), role)).toBe('next');
    }
    for (const role of ['doctor', 'technician', 'pharmacist']) {
      expect(await run(authzOf('get', '/stream'), role)).toBe(403);
    }
  });

  it('queueEvents pub/sub cách ly theo hospitalId và dọn dẹp listener sau unsubscribe', () => {
    const receivedA = [];
    const receivedB = [];
    const unsubA = subscribeQueueEvents('hosp-a', (ev) => receivedA.push(ev));
    const unsubB = subscribeQueueEvents('hosp-b', (ev) => receivedB.push(ev));

    publishQueueEvent('hosp-a', { type: 'ticket.taken', number: 12, dateKey: '2026-11-15' });
    expect(receivedA.length).toBe(1);
    expect(receivedA[0].type).toBe('ticket.taken');
    expect(receivedA[0].number).toBe(12);
    expect(receivedB.length).toBe(0);

    unsubA();
    unsubB();
    publishQueueEvent('hosp-a', { type: 'ticket.taken', number: 13 });
    expect(receivedA.length).toBe(1);

    const frame = formatSseEvent('queue', { type: 'ticket.taken', number: 5 });
    expect(frame.startsWith('event: queue\ndata: ')).toBe(true);
    expect(frame.endsWith('\n\n')).toBe(true);
  });

  it('streamEvents đẩy sự kiện lấy số sang y tá và lọc sự kiện visit.* khỏi luồng bệnh nhân', async () => {
    const makeMockStream = (role, hospitalId) => {
      const req = new EventEmitter();
      req.user = { id: 'u1', role, hospitalId };
      req.setTimeout = () => {};
      const res = new EventEmitter();
      res.headers = {};
      res.chunks = [];
      res.setTimeout = () => {};
      res.setHeader = (k, v) => { res.headers[k] = v; };
      res.flushHeaders = () => {};
      res.write = (c) => res.chunks.push(c);
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (body) => { res.body = body; return res; };
      return { req, res };
    };

    const nurseStream = makeMockStream('nurse', 'hosp-sse-1');
    const patientStream = makeMockStream('patient', 'hosp-sse-1');
    await streamEvents(nurseStream.req, nurseStream.res, () => {});
    await streamEvents(patientStream.req, patientStream.res, () => {});

    expect(nurseStream.res.headers['Content-Type']).toBe('text/event-stream; charset=utf-8');
    expect(nurseStream.res.chunks[0]).toContain('event: connected');

    publishQueueEvent('hosp-sse-1', { type: 'ticket.taken', number: 7, dateKey: '2026-11-15' });
    publishQueueEvent('hosp-sse-1', { type: 'visit.created' });

    const nurseText = nurseStream.res.chunks.join('');
    const patientText = patientStream.res.chunks.join('');
    expect(nurseText).toContain('ticket.taken');
    expect(nurseText).toContain('visit.created');
    expect(patientText).toContain('ticket.taken');
    expect(patientText.includes('visit.created')).toBe(false);

    const beforeCloseCount = nurseStream.res.chunks.length;
    nurseStream.req.emit('close');
    patientStream.req.emit('close');
    publishQueueEvent('hosp-sse-1', { type: 'ticket.taken', number: 8 });
    expect(nurseStream.res.chunks.length).toBe(beforeCloseCount);
  });
});
