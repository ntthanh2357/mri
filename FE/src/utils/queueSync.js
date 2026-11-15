import { AppState, Platform } from 'react-native';
import Config from '../constants/config.js';
import { clientPlatformHeaders, getToken } from '../api/client.js';
import { parseSseChunks } from './sseParser.js';

export { parseSseChunks };

const CHANNEL_NAME = 'neuroscan:queue';
const STORAGE_KEY = 'neuroscan:queue_ping';
const RECONNECT_DELAYS_MS = [1500, 3000, 5000, 8000, 10000];

const isTabHidden = () =>
  Platform.OS === 'web' && typeof document !== 'undefined' && Boolean(document.hidden);

/** Phát tín hiệu giữa các tab cùng trình duyệt ngay khi bệnh nhân lấy/huỷ số hoặc quầy thao tác. */
export const notifyQueueChanged = (type = 'queue.updated') => {
  if (Platform.OS !== 'web') return;
  const payload = { type, ts: Date.now() };
  try {
    const ChannelCtor = typeof globalThis !== 'undefined' ? globalThis.BroadcastChannel : null;
    if (typeof ChannelCtor === 'function') {
      const ch = new ChannelCtor(CHANNEL_NAME);
      ch.postMessage(payload);
      ch.close();
    }
  } catch {
    // Một số trình duyệt/ngữ cảnh hạn chế không hỗ trợ BroadcastChannel
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, `${payload.ts}:${type}`);
    }
  } catch {
    // Bỏ qua nếu private mode chặn localStorage
  }
};

/**
 * Đồng bộ hàng đợi thời gian thực:
 * 1) SSE từ BE (/api/v1/queue-tickets/stream) qua fetch + Bearer token
 * 2) BroadcastChannel + storage giữa các tab cùng trình duyệt
 * 3) window focus / visibilitychange / AppState active khi người dùng quay lại màn hình
 * 4) Fallback polling nhanh (mặc định 5s) khi stream chưa khả dụng
 */
export const subscribeQueueSync = ({
  query = '',
  onSync,
  pollMs = 5000,
  streamEnabled = true,
} = {}) => {
  let active = true;
  let controller = null;
  let reconnectTimer = null;
  let throttleTimer = null;
  let lastSyncAt = 0;
  let attempt = 0;

  const triggerSync = () => {
    if (!active || typeof onSync !== 'function') return;
    const now = Date.now();
    const wait = Math.max(0, 180 - (now - lastSyncAt));
    if (wait === 0) {
      lastSyncAt = now;
      Promise.resolve(onSync()).catch(() => {});
      return;
    }
    if (throttleTimer) return;
    throttleTimer = setTimeout(() => {
      throttleTimer = null;
      if (!active) return;
      lastSyncAt = Date.now();
      Promise.resolve(onSync()).catch(() => {});
    }, wait);
  };

  const scheduleReconnect = () => {
    if (!active || !streamEnabled) return;
    const delay = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
    attempt += 1;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectSse, delay);
  };

  const connectSse = async () => {
    if (!active || !streamEnabled) return;
    if (typeof fetch !== 'function' || typeof AbortController === 'undefined') return;
    if (isTabHidden()) return;

    const token = await getToken().catch(() => null);
    if (!active || !token) {
      scheduleReconnect();
      return;
    }

    controller = new AbortController();
    try {
      const res = await fetch(`${Config.API_URL}/api/v1/queue-tickets/stream${query}`, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${token}`,
          ...clientPlatformHeaders(),
        },
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!active) return;

      if (res.status === 401) {
        // Kích hoạt reload chuẩn (api/client.js) để silent refresh token rồi nối lại stream
        triggerSync();
        scheduleReconnect();
        return;
      }

      // Chưa chọn bệnh viện hoặc không đủ quyền: dừng tự nối lại để tránh lặp lỗi
      if (res.status === 400 || res.status === 403) return;

      if (!res.ok || !res.body || typeof res.body.getReader !== 'function') {
        scheduleReconnect();
        return;
      }

      attempt = 0;
      const reader = res.body.getReader();
      const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;
      let buffer = '';

      while (active) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder ? decoder.decode(value, { stream: true }) : String(value || '');
        buffer += chunk;
        const parsed = parseSseChunks(buffer);
        buffer = parsed.rest;
        for (const frame of parsed.events) {
          if (frame.event === 'queue') triggerSync();
        }
      }

      if (active) scheduleReconnect();
    } catch (err) {
      if (active && err?.name !== 'AbortError') {
        scheduleReconnect();
      }
    }
  };

  if (streamEnabled) connectSse();

  const pollTimer = pollMs > 0
    ? setInterval(() => {
        if (!isTabHidden()) triggerSync();
      }, pollMs)
    : null;

  let bc = null;
  let onFocus = null;
  let onVisibility = null;
  let onStorage = null;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    onFocus = () => {
      triggerSync();
      if (streamEnabled && (!controller || controller.signal.aborted)) {
        attempt = 0;
        connectSse();
      }
    };
    window.addEventListener('focus', onFocus);

    onStorage = (e) => {
      if (e?.key === STORAGE_KEY) triggerSync();
    };
    window.addEventListener('storage', onStorage);

    if (typeof document !== 'undefined') {
      onVisibility = () => {
        if (!document.hidden) {
          triggerSync();
          if (streamEnabled) {
            clearTimeout(reconnectTimer);
            controller?.abort();
            attempt = 0;
            connectSse();
          }
        }
      };
      document.addEventListener('visibilitychange', onVisibility);
    }

    try {
      const ChannelCtor = typeof globalThis !== 'undefined' ? globalThis.BroadcastChannel : null;
      if (typeof ChannelCtor === 'function') {
        bc = new ChannelCtor(CHANNEL_NAME);
        bc.onmessage = () => triggerSync();
      }
    } catch {
      bc = null;
    }
  }

  const appStateSub = AppState?.addEventListener
    ? AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active') triggerSync();
      })
    : null;

  return () => {
    active = false;
    clearTimeout(reconnectTimer);
    clearTimeout(throttleTimer);
    if (pollTimer) clearInterval(pollTimer);
    try { controller?.abort(); } catch {}
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (onFocus) window.removeEventListener('focus', onFocus);
      if (onStorage) window.removeEventListener('storage', onStorage);
      if (onVisibility && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    }
    try { bc?.close(); } catch {}
    try { appStateSub?.remove?.(); } catch {}
  };
};
