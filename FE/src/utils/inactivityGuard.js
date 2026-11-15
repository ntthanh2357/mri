// Theo dõi thời gian tương tác thực tế của người dùng trên Web (kể cả ScrollView không nổi bọt,
// modal có stopPropagation, wheel, pointer, input và đồng bộ nhiều tab qua localStorage).
// Trước đây chỉ lắng nghe bubble-phase trên window nên cuộn trong ScrollView/Modal hoặc mở tab thứ 2
// khiến bộ đếm 15 phút không reset và tự đăng xuất ngay cả khi người dùng đang thao tác.

export const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
export const LAST_ACTIVITY_STORAGE_KEY = 'neuroscan_last_activity_at';
export const ACTIVITY_WRITE_THROTTLE_MS = 1000;

export const TRACKED_WINDOW_EVENTS = [
  'pointerdown',
  'pointermove',
  'mousedown',
  'mousemove',
  'click',
  'keydown',
  'keyup',
  'input',
  'change',
  'touchstart',
  'touchmove',
  'wheel',
  'scroll',
  'focus',
  'popstate',
  'hashchange',
];

let inMemoryLastActivityAt = 0;
let lastStorageWriteAt = 0;
const activeResetHooks = new Set();

export const resetInactivityTrackerForTests = () => {
  inMemoryLastActivityAt = 0;
  lastStorageWriteAt = 0;
};

const getDefaultStorage = () => {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch (_) {
    return null;
  }
};

export const readStoredLastActivity = (storage = getDefaultStorage()) => {
  if (!storage) return 0;
  try {
    const raw = Number(storage.getItem(LAST_ACTIVITY_STORAGE_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  } catch (_) {
    return 0;
  }
};

export const recordSessionActivity = ({
  force = false,
  now = Date.now(),
  storage = getDefaultStorage(),
} = {}) => {
  if (now > inMemoryLastActivityAt) {
    inMemoryLastActivityAt = now;
  }
  if (storage && (force || now - lastStorageWriteAt >= ACTIVITY_WRITE_THROTTLE_MS)) {
    lastStorageWriteAt = now;
    try {
      storage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(inMemoryLastActivityAt));
    } catch (_) {
      // Bỏ qua lỗi quota / chế độ riêng tư
    }
  }
  if (force) {
    activeResetHooks.forEach((cb) => {
      try { cb(inMemoryLastActivityAt); } catch (_) { /* không chặn flow chính */ }
    });
  }
  return inMemoryLastActivityAt;
};

export const installInactivityGuard = ({
  timeoutMs = SESSION_IDLE_TIMEOUT_MS,
  hasActiveSession,
  onTimeout,
  win = typeof window !== 'undefined' ? window : null,
  doc = typeof document !== 'undefined' ? document : null,
  storage = getDefaultStorage(),
  nowFn = () => Date.now(),
} = {}) => {
  if (!win || typeof win.addEventListener !== 'function') {
    return () => {};
  }

  let timeoutId = null;
  let disposed = false;
  let handlingTimeout = false;
  let localLastActivity = Math.max(nowFn(), inMemoryLastActivityAt, readStoredLastActivity(storage));
  inMemoryLastActivityAt = localLastActivity;
  recordSessionActivity({ force: true, now: localLastActivity, storage });

  const getEffectiveLastActivity = () => {
    const now = nowFn();
    const stored = readStoredLastActivity(storage);
    // Bỏ qua timestamp tương lai bất thường (lệch đồng hồ hệ thống / dữ liệu hỏng)
    const validStored = stored <= now + 60_000 ? stored : 0;
    localLastActivity = Math.min(now, Math.max(localLastActivity, inMemoryLastActivityAt, validStored));
    return localLastActivity;
  };

  const scheduleNextCheck = (delayMs) => {
    if (disposed) return;
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = setTimeout(evaluateTimeout, Math.max(0, delayMs));
  };

  const evaluateTimeout = async () => {
    if (disposed || handlingTimeout) return;
    const now = nowFn();
    const elapsed = now - getEffectiveLastActivity();
    if (elapsed < timeoutMs) {
      scheduleNextCheck(timeoutMs - elapsed);
      return;
    }

    handlingTimeout = true;
    try {
      if (typeof hasActiveSession === 'function') {
        const active = await hasActiveSession();
        if (!active || disposed) {
          // Chưa đăng nhập hoặc đã đăng xuất: không bật cảnh báo hết phiên, bắt đầu chu kỳ chờ mới
          localLastActivity = nowFn();
          inMemoryLastActivityAt = Math.max(inMemoryLastActivityAt, localLastActivity);
          scheduleNextCheck(timeoutMs);
          return;
        }
      }

      // Kiểm tra lại lần cuối phòng trường hợp vừa có tương tác ở tab này hoặc tab khác trong lúc chờ
      const recheckElapsed = nowFn() - getEffectiveLastActivity();
      if (recheckElapsed < timeoutMs) {
        scheduleNextCheck(timeoutMs - recheckElapsed);
        return;
      }

      await onTimeout?.();
    } finally {
      handlingTimeout = false;
      if (!disposed) {
        localLastActivity = nowFn();
        inMemoryLastActivityAt = Math.max(inMemoryLastActivityAt, localLastActivity);
        scheduleNextCheck(timeoutMs);
      }
    }
  };

  const onUserActivity = () => {
    const now = nowFn();
    localLastActivity = Math.max(localLastActivity, now);
    recordSessionActivity({ force: false, now: localLastActivity, storage });
  };

  const onStorageChange = (e) => {
    if (e?.key === LAST_ACTIVITY_STORAGE_KEY && e.newValue) {
      const parsed = Number(e.newValue);
      if (Number.isFinite(parsed) && parsed > localLastActivity) {
        localLastActivity = parsed;
        inMemoryLastActivityAt = Math.max(inMemoryLastActivityAt, parsed);
      }
    }
  };

  const onVisibilityChange = () => {
    if (doc?.visibilityState === 'visible') {
      evaluateTimeout();
    }
  };

  const onForceReset = (ts) => {
    localLastActivity = Math.max(localLastActivity, ts || nowFn());
    scheduleNextCheck(timeoutMs);
  };
  activeResetHooks.add(onForceReset);

  const listenerOpts = { capture: true, passive: true };
  TRACKED_WINDOW_EVENTS.forEach((event) => {
    win.addEventListener(event, onUserActivity, listenerOpts);
  });
  win.addEventListener('storage', onStorageChange);
  doc?.addEventListener('visibilitychange', onVisibilityChange);

  scheduleNextCheck(timeoutMs);

  return () => {
    disposed = true;
    activeResetHooks.delete(onForceReset);
    if (timeoutId !== null) clearTimeout(timeoutId);
    TRACKED_WINDOW_EVENTS.forEach((event) => {
      win.removeEventListener(event, onUserActivity, listenerOpts);
    });
    win.removeEventListener('storage', onStorageChange);
    doc?.removeEventListener('visibilitychange', onVisibilityChange);
  };
};
