import { Platform } from 'react-native';

/**
 * An toàn đa nền tảng cho LocalStorage:
 * Chống lỗi ReferenceError: localStorage is not defined khi chạy trên thiết bị di động / tablet Native (iOS/Android)
 */
export const safeStorage = {
  getItem: (key) => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn('[safeStorage] getItem error:', e);
    }
    return null;
  },
  setItem: (key, value) => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        const valStr = typeof value === 'string' ? value : JSON.stringify(value);
        window.localStorage.setItem(key, valStr);
      }
    } catch (e) {
      console.warn('[safeStorage] setItem error:', e);
    }
  },
  removeItem: (key) => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('[safeStorage] removeItem error:', e);
    }
  }
};

export default safeStorage;
