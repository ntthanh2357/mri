import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SESSION_IDLE_TIMEOUT_MS,
  LAST_ACTIVITY_STORAGE_KEY,
  TRACKED_WINDOW_EVENTS,
  recordSessionActivity,
  installInactivityGuard,
  resetInactivityTrackerForTests,
} from '../utils/inactivityGuard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
const test = async (name, fn) => {
  resetInactivityTrackerForTests();
  try {
    await fn();
    passed++;
    console.log(`  ✔ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✘ ${name}: ${err?.stack || err?.message || err}`);
  }
};

const createFakeDom = () => {
  const winListeners = [];
  const docListeners = [];
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const win = {
    addEventListener: (type, fn, opts) => winListeners.push({ type, fn, opts }),
    removeEventListener: (type, fn) => {
      for (let i = winListeners.length - 1; i >= 0; i--) {
        if (winListeners[i].type === type && winListeners[i].fn === fn) winListeners.splice(i, 1);
      }
    },
    emit: (type, event = {}) => {
      winListeners.filter((l) => l.type === type).forEach((l) => l.fn(event));
    },
  };
  const doc = {
    visibilityState: 'visible',
    addEventListener: (type, fn) => docListeners.push({ type, fn }),
    removeEventListener: (type, fn) => {
      for (let i = docListeners.length - 1; i >= 0; i--) {
        if (docListeners[i].type === type && docListeners[i].fn === fn) docListeners.splice(i, 1);
      }
    },
    emit: (type) => docListeners.filter((l) => l.type === type).forEach((l) => l.fn()),
  };
  return { win, doc, storage, winListeners, docListeners };
};

await test('lắng nghe sự kiện ở capture phase (bắt được ScrollView/Modal) và đủ các loại tương tác', async () => {
  assert.strictEqual(SESSION_IDLE_TIMEOUT_MS, 15 * 60 * 1000);
  for (const ev of ['scroll', 'wheel', 'pointerdown', 'pointermove', 'mousemove', 'mousedown', 'keydown', 'input', 'touchstart', 'touchmove']) {
    assert.ok(TRACKED_WINDOW_EVENTS.includes(ev), `Thiếu sự kiện ${ev}`);
  }
  const { win, doc, storage, winListeners } = createFakeDom();
  const cleanup = installInactivityGuard({
    timeoutMs: 100,
    win,
    doc,
    storage,
    onTimeout: () => {},
  });
  const scrollListener = winListeners.find((l) => l.type === 'scroll');
  assert.strictEqual(scrollListener?.opts?.capture, true);
  assert.strictEqual(scrollListener?.opts?.passive, true);
  cleanup();
  assert.strictEqual(winListeners.length, 0);
});

await test('không đăng xuất sau mốc timeout ban đầu nếu người dùng vẫn tương tác hoặc tab khác đang hoạt động', async () => {
  const { win, doc, storage } = createFakeDom();
  let fakeNow = 1_000_000;
  let timedOut = 0;

  const cleanup = installInactivityGuard({
    timeoutMs: 80,
    win,
    doc,
    storage,
    nowFn: () => fakeNow,
    hasActiveSession: async () => true,
    onTimeout: () => { timedOut++; },
  });

  // Giả lập user cuộn trang (scroll) ở t+50ms, sau đó timer gốc 80ms thức dậy ở t+90ms → chưa quá hạn từ lúc scroll (40ms < 80ms)
  fakeNow += 50;
  win.emit('scroll');
  fakeNow += 40;
  await new Promise((r) => setTimeout(r, 95));
  assert.strictEqual(timedOut, 0, 'Không được logout khi vừa có tương tác scroll');

  // Giả lập hoạt động ở tab khác cập nhật localStorage → gia hạn thêm, timer vẫn không logout
  fakeNow += 30;
  win.emit('storage', { key: LAST_ACTIVITY_STORAGE_KEY, newValue: String(fakeNow) });
  fakeNow += 40;
  await new Promise((r) => setTimeout(r, 95));
  assert.strictEqual(timedOut, 0, 'Không được logout khi tab khác vẫn đang tương tác');

  cleanup();
});

await test('chỉ đăng xuất khi thật sự bất động quá timeout VÀ đang có phiên đăng nhập', async () => {
  const { win, doc, storage } = createFakeDom();
  let fakeNow = 5_000_000;
  let loggedIn = false;
  let timedOut = 0;

  const cleanup = installInactivityGuard({
    timeoutMs: 40,
    win,
    doc,
    storage,
    nowFn: () => fakeNow,
    hasActiveSession: async () => loggedIn,
    onTimeout: () => { timedOut++; },
  });

  // Hết 40ms nhưng chưa đăng nhập → không kích hoạt logout
  fakeNow += 50;
  await new Promise((r) => setTimeout(r, 60));
  assert.strictEqual(timedOut, 0, 'Chưa đăng nhập thì không được gọi onTimeout');

  // Đã đăng nhập và không tương tác trong suốt 50ms (>40ms) → gọi onTimeout
  loggedIn = true;
  fakeNow += 50;
  await new Promise((r) => setTimeout(r, 60));
  assert.strictEqual(timedOut, 1, 'Phải gọi onTimeout khi thật sự quá hạn mà không tương tác');

  cleanup();
});

await test('setAuthToken(token) làm mới đồng hồ phiên và cả AppNavigator/StaffPortal đều dùng installInactivityGuard', async () => {
  const clientCode = fs.readFileSync(path.join(SRC, 'api/client.js'), 'utf8');
  assert.match(clientCode, /recordSessionActivity\(\{ force: true \}\)/);

  const appNav = fs.readFileSync(path.join(SRC, 'navigation/AppNavigator.js'), 'utf8');
  const staffPortal = fs.readFileSync(path.join(SRC, 'navigation/StaffPortal.js'), 'utf8');
  assert.match(appNav, /installInactivityGuard\(/);
  assert.match(staffPortal, /installInactivityGuard\(/);

  // Kiểm tra recordSessionActivity cập nhật clock trực tiếp
  const { storage } = createFakeDom();
  const ts = recordSessionActivity({ force: true, now: 9_999_999, storage });
  assert.strictEqual(ts, 9_999_999);
  assert.strictEqual(storage.getItem(LAST_ACTIVITY_STORAGE_KEY), '9999999');
});

console.log(`\nSUMMARY: ${passed}/${passed + failed} INACTIVITY GUARD TESTS ${failed ? 'FAILED' : 'PASSED'}`);
if (failed) process.exit(1);
