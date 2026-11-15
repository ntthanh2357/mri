import Config from '../constants/config.js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { goToPortalLogin } from '../utils/navigationRef.js';
import { cancelScheduled } from '../services/localNotifications';
import { clearLocalClinicalData } from '../utils/localClinicalData.js';
import { recordSessionActivity } from '../utils/inactivityGuard.js';

// Helper functions for cross-platform token persistence (Web & Native Mobile)
export const getToken = async () => {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      const webToken = localStorage.getItem('token');
      if (webToken) return webToken;
    }
    return await AsyncStorage.getItem('token');
  } catch (err) {
    console.warn('[client.js] Lỗi đọc token từ storage:', err);
    return null;
  }
};

export const setToken = async (token) => {
  try {
    if (token) {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem('token', token);
      }
      await AsyncStorage.setItem('token', token);
    } else {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.removeItem('token');
      }
      await AsyncStorage.removeItem('token');
    }
  } catch (err) {
    console.warn('[client.js] Lỗi ghi token vào storage:', err);
  }
};

export const getRefreshToken = async () => {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      const webRefresh = localStorage.getItem('refreshToken');
      if (webRefresh) return webRefresh;
    }
    return await AsyncStorage.getItem('refreshToken');
  } catch (err) {
    console.warn('[client.js] Lỗi đọc refreshToken từ storage:', err);
    return null;
  }
};

export const setRefreshToken = async (refreshToken) => {
  try {
    if (refreshToken) {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem('refreshToken', refreshToken);
      }
      await AsyncStorage.setItem('refreshToken', refreshToken);
    } else {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.removeItem('refreshToken');
      }
      await AsyncStorage.removeItem('refreshToken');
    }
  } catch (err) {
    console.warn('[client.js] Lỗi ghi refreshToken vào storage:', err);
  }
};

export const setAuthToken = async (token, refreshToken = null) => {
  await setToken(token);
  if (token) {
    // Đăng nhập / cấp token mới → đặt lại đồng hồ phiên từ lúc này
    recordSessionActivity({ force: true });
  } else {
    // hết phiên trên máy này: huỷ thông báo nhắc thuốc / lịch khám đã hẹn (máy dùng chung không lộ thông tin người trước)
    await cancelScheduled().catch((err) => console.warn('[client.js] Lỗi huỷ thông báo đã hẹn:', err?.message));
  }
  if (refreshToken) {
    await setRefreshToken(refreshToken);
  } else if (!token || Platform.OS === 'web') {
    // Đăng xuất, hoặc web: refresh token nằm trong cookie HttpOnly → xoá bản cũ còn trong localStorage (QA-27)
    await setRefreshToken(null);
  }
};

// QA-27 Phase 1: trên web refresh token nằm trong cookie HttpOnly (path /auth) do BE đặt; JS không đọc/lưu nó.
// Header X-Client-Platform cho BE biết không trả refreshToken trong body cho web. App mobile giữ nguyên luồng cũ.
// Giai đoạn chuyển tiếp (1–2 sprint): refreshToken cũ còn trong localStorage vẫn được gửi kèm làm dự phòng.
const IS_WEB = Platform.OS === 'web';
export const clientPlatformHeaders = () => ({ 'X-Client-Platform': Platform.OS });
const credentialsFor = (endpoint) => (IS_WEB && String(endpoint).startsWith('/auth') ? { credentials: 'include' } : {});

// ── Silent Token Refresh Queue & Lock ──────────────────────────────────────────
let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (cb) => {
  refreshSubscribers.push(cb);
};

// Bị đăng xuất cưỡng bức (401 sau khi làm mới thất bại, 403 tài khoản/viện bị khóa): xóa token VÀ dữ liệu
// bệnh nhân lưu trên máy như đăng xuất thường (trước đây bản nháp bệnh án còn lại trên máy dùng chung)
const forceLogout = async () => {
  await setAuthToken(null);
  try { await clearLocalClinicalData(); } catch (_) { /* không chặn việc đăng xuất */ }
  goToPortalLogin();
};

const onRefreshed = (token) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

export const refreshAccessToken = async () => {
  const currentRefreshToken = await getRefreshToken();
  // Web: cookie HttpOnly tự đi kèm nên vẫn gọi khi không còn token trong storage. Mobile: cần token đã lưu.
  if (!currentRefreshToken && !IS_WEB) {
    return null;
  }

  try {
    const res = await fetch(`${Config.API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...clientPlatformHeaders() },
      ...credentialsFor('/auth/refresh'),
      body: JSON.stringify(currentRefreshToken ? { refreshToken: currentRefreshToken } : {})
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const newAccessToken = data.accessToken || data.token;
    if (newAccessToken) {
      await setToken(newAccessToken);
      if (data.refreshToken) {
        await setRefreshToken(data.refreshToken);
      }
      return newAccessToken;
    }
    return null;
  } catch (err) {
    console.warn('[client.js] Lỗi khi thực hiện silent refresh:', err);
    return null;
  }
};

export const request = async (endpoint, options = {}, isRetry = false) => {
  const method = String(options?.method || 'GET').toUpperCase();
  if (method !== 'GET' && endpoint !== '/auth/logout' && endpoint !== '/auth/refresh') {
    recordSessionActivity();
  }
  const url = `${Config.API_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...clientPlatformHeaders(),
    ...options.headers,
  };
  
  const token = await getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...credentialsFor(endpoint),
    ...options,
    headers,
    // [FIX 0014] no-store: tránh trình duyệt gửi conditional GET (If-None-Match)
    // khiến server trả 304 — fetch coi 304 là !ok → FE tưởng lỗi và mất dữ liệu
    // (dashboard hiển thị 0 im lặng). Với API đăng nhập theo token, cache vô nghĩa.
    cache: 'no-store',
  });
  let data;
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : {};
  } catch (err) {
    if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
    return {};
  }

  // Xử lý mã 401: Thử làm mới token ngầm (Silent Refresh) nếu chưa phải lần thử lại
  if (response.status === 401 && !isRetry && endpoint !== '/auth/refresh' && endpoint !== '/auth/login') {
    if (!isRefreshing) {
      isRefreshing = true;
      let newToken = null;
      try {
        newToken = await refreshAccessToken();
      } catch (_) {
        newToken = null;
      } finally {
        // luôn trả cờ, kể cả khi làm mới ném lỗi (trước đây kẹt true → mọi 401 sau đó treo)
        isRefreshing = false;
      }

      if (newToken) {
        onRefreshed(newToken);
        return request(endpoint, options, true);
      } else {
        // Refresh token cũng đã hết hạn → báo cho các request đang chờ (trước đây treo vĩnh viễn) rồi đăng xuất
        onRefreshed(null);
        await forceLogout();
        throw new Error(data?.message || 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
      }
    } else {
      // Đang có request refresh chạy ngầm → xếp hàng đợi token mới để thử lại
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh((newToken) => {
          if (newToken) {
            resolve(request(endpoint, options, true));
          } else {
            reject(new Error('Phiên làm việc đã hết hạn.'));
          }
        });
      });
    }
  }

  if (response.status === 401) {
    await forceLogout();
    throw new Error(data?.message || 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
  }

  // Xử lý mã 403 trên các endpoint xác thực cốt lõi (/auth/me): Tài khoản bị khóa hoặc gói bệnh viện hết hạn
  // Xóa token để giải phóng trạng thái zombie loop
  if (response.status === 403 && endpoint === '/auth/me') {
    await forceLogout();
    throw new Error(data?.message || 'Tài khoản hoặc bệnh viện của bạn đang bị khóa hoặc hết hạn dịch vụ.');
  }

  if (!response.ok) {
    // [FIX 0014] Gắn status + code để màn hình phân biệt 429 (hệ thống bận)
    // với 401/403 (phiên hết hạn) — xem utils/apiErrors.js
    const err = new Error(data.message || `Request failed with status ${response.status}`);
    err.status = response.status;
    if (data && data.code) err.code = data.code;
    throw err;
  }
  return data;
};

export const get = (endpoint) => request(endpoint);
export const post = (endpoint, body, method = 'POST') =>
  request(endpoint, { method, body: JSON.stringify(body) });
export const put = (endpoint, body) => request(endpoint, { method: 'PUT', body: JSON.stringify(body) });
export const del = (endpoint) => request(endpoint, { method: 'DELETE' });

export const postFormData = async (endpoint, formData, isRetry = false) => {
  recordSessionActivity();
  const url = `${Config.API_URL}${endpoint}`;
  const headers = {};
  const token = await getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(url, { method: 'POST', headers, body: formData, cache: 'no-store' });
  let data;
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : {};
  } catch (err) {
    if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
    return {};
  }

  if (response.status === 401 && !isRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return postFormData(endpoint, formData, true);
    }
    await forceLogout();
    throw new Error(data?.message || 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
  }

  if (response.status === 401) {
    await forceLogout();
    throw new Error(data?.message || 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
  }

  if (!response.ok) {
    throw Object.assign(new Error(data.message || `Upload failed with status ${response.status}`), {
      status: response.status,
      ...(data && data.code ? { code: data.code } : {}),
      errors: data.errors, // vd. POOR_QUALITY khi quét giấy tờ: giao diện cần mã lỗi, không đoán theo câu chữ
    });
  }
  return data;
};

export default {
  get,
  post,
  put,
  del,
  postFormData,
  getToken,
  setToken,
  getRefreshToken,
  setRefreshToken,
  setAuthToken,
  refreshAccessToken,
  request,
};
