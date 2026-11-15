// Kiem thu dong bo hang doi lay so online theo thoi gian thuc (SSE + tab sync + focus + polling nhanh)
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSseChunks } from '../utils/sseParser.js';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

let passed = 0;
let failed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`  ✔ ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`  ✖ ${name}\n    ${e.message}`);
  }
};

test('parseSseChunks tach dung frame hoan chinh, chunk bi cat doi va bo qua heartbeat', () => {
  const part1 = ': ping\n\nevent: connected\ndata: {"ok":true}\n\nevent: queue\ndata: {"type":"ticket.taken",';
  const r1 = parseSseChunks(part1);
  assert.strictEqual(r1.events.length, 1);
  assert.strictEqual(r1.events[0].event, 'connected');
  assert.deepStrictEqual(r1.events[0].data, { ok: true });
  assert.ok(r1.rest.includes('"ticket.taken"'));

  const part2 = `${r1.rest}"number":9}\r\n\r\nevent: queue\ndata: {"type":"ticket.called"}\r\n\r\n`;
  const r2 = parseSseChunks(part2);
  assert.strictEqual(r2.rest, '');
  assert.strictEqual(r2.events.length, 2);
  assert.deepStrictEqual(r2.events[0], { event: 'queue', data: { type: 'ticket.taken', number: 9 } });
  assert.deepStrictEqual(r2.events[1], { event: 'queue', data: { type: 'ticket.called' } });
});

test('queueSync ket noi SSE dung Bearer header, BroadcastChannel, focus va visibilitychange', () => {
  const syncSrc = read('utils/queueSync.js');
  assert.ok(syncSrc.includes('/api/v1/queue-tickets/stream'), 'Thieu endpoint SSE stream');
  assert.ok(syncSrc.includes('Authorization: `Bearer ${token}`'), 'SSE phai gui Bearer token qua header thay vi URL');
  assert.ok(syncSrc.includes('BroadcastChannel'), 'Thieu BroadcastChannel dong bo cung trinh duyet');
  assert.ok(syncSrc.includes('visibilitychange') && syncSrc.includes("'focus'"), 'Thieu tai lai khi quay lai tab/cua so');
  assert.ok(syncSrc.includes('AppState'), 'Thieu AppState cho mobile');
});

test('useQueueDesk & useQueueTicket su dung subscribeQueueSync, notifyQueueChanged va chong goi chong cheo', () => {
  const desk = read('controllers/useQueueDesk.js');
  assert.ok(desk.includes('POLL_MS = 5000'), 'POLL_MS cua useQueueDesk can <= 5s');
  assert.ok(desk.includes('subscribeQueueSync') && desk.includes('notifyQueueChanged'), 'useQueueDesk thieu subscribeQueueSync/notifyQueueChanged');
  assert.ok(desk.includes('inFlightRef') && desk.includes('mountedRef'), 'useQueueDesk thieu chong goi chong cheo / unmount guard');

  const ticket = read('controllers/useQueueTicket.js');
  assert.ok(ticket.includes('POLL_MS = 8000'), 'POLL_MS cua useQueueTicket can <= 8s');
  assert.ok(ticket.includes('subscribeQueueSync') && ticket.includes('notifyQueueChanged'), 'useQueueTicket thieu subscribeQueueSync/notifyQueueChanged');
});

test('NurseTriageScreen & NurseReceptionScreen tai lai so thu tu khi focus hoac chuyen tab', () => {
  const triage = read('screens/NurseTriageScreen.js');
  assert.ok(triage.includes('POLL_MS = 5000'), 'POLL_MS cua NurseTriageScreen can <= 5s');
  assert.ok(triage.includes('queueDesk.reload()'), 'NurseTriageScreen focus phai goi queueDesk.reload()');
  assert.ok(triage.includes('onSync: handleQueueSync'), 'NurseTriageScreen can dong bo visits khi nhan su kien SSE');

  const reception = read('screens/NurseReceptionScreen.js');
  assert.ok(reception.includes("activeTab === 'callQueue'") && reception.includes('queueDesk.reload()'), 'NurseReceptionScreen can reload queueDesk khi chuyen sang tab callQueue');
  assert.ok(reception.includes("navigation.addListener('focus'"), 'NurseReceptionScreen can reload khi focus lai man hinh');
});

console.log(`\nFE Queue Realtime Sync Tests: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);

