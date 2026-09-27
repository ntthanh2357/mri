import Config from '../constants/config.js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { navigateTo } from '../utils/navigationRef.js';

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
  if (refreshToken !== null) {
    await setRefreshToken(refreshToken);
  } else if (!token) {
    await setRefreshToken(null);
  }
};

// ── Silent Token Refresh Queue & Lock ──────────────────────────────────────────
let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (cb) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (token) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

export const refreshAccessToken = async () => {
  const currentRefreshToken = await getRefreshToken();
  if (!currentRefreshToken) {
    return null;
  }

  try {
    const res = await fetch(`${Config.API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: currentRefreshToken })
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
  const url = `${Config.API_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  const token = await getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
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
      const newToken = await refreshAccessToken();
      isRefreshing = false;

      if (newToken) {
        onRefreshed(newToken);
        return request(endpoint, options, true);
      } else {
        // Refresh token cũng đã hết hạn → bắt buộc đăng xuất
        await setAuthToken(null);
        navigateTo('Welcome');
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
    await setAuthToken(null);
    navigateTo('Welcome');
    throw new Error(data?.message || 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
  }

  // Xử lý mã 403 trên các endpoint xác thực cốt lõi (/auth/me): Tài khoản bị khóa hoặc gói bệnh viện hết hạn
  // Xóa token để giải phóng trạng thái zombie loop
  if (response.status === 403 && endpoint === '/auth/me') {
    await setAuthToken(null);
    navigateTo('Welcome');
    throw new Error(data?.message || 'Tài khoản hoặc bệnh viện của bạn đang bị khóa hoặc hết hạn dịch vụ.');
  }

  if (!response.ok) throw new Error(data.message || `Request failed with status ${response.status}`);
  return data;
};

export const get = (endpoint) => request(endpoint);
export const post = (endpoint, body, method = 'POST') =>
  request(endpoint, { method, body: JSON.stringify(body) });
export const put = (endpoint, body) => request(endpoint, { method: 'PUT', body: JSON.stringify(body) });
export const del = (endpoint) => request(endpoint, { method: 'DELETE' });

export const postFormData = async (endpoint, formData, isRetry = false) => {
  const url = `${Config.API_URL}${endpoint}`;
  const headers = {};
  const token = await getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(url, { method: 'POST', headers, body: formData });
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
    await setAuthToken(null);
    navigateTo('Welcome');
    throw new Error(data?.message || 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
  }

  if (response.status === 401) {
    await setAuthToken(null);
    navigateTo('Welcome');
    throw new Error(data?.message || 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
  }

  if (!response.ok) throw new Error(data.message || `Upload failed with status ${response.status}`);
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
