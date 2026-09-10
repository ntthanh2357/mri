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

export const setAuthToken = async (token) => {
  await setToken(token);
};

export const request = async (endpoint, options = {}) => {
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

  if (response.status === 401) {
    await setToken(null);
    navigateTo('Welcome');
    throw new Error(data?.message || 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
  }

  if (!response.ok) throw new Error(data.message || `Request failed with status ${response.status}`);
  return data;
};

export const get = (endpoint) => request(endpoint);
export const post = (endpoint, body, method = 'POST') =>
  request(endpoint, { method, body: JSON.stringify(body) });
export const put = (endpoint, body) => request(endpoint, { method: 'PUT', body: JSON.stringify(body) });
export const del = (endpoint) => request(endpoint, { method: 'DELETE' });

export const postFormData = async (endpoint, formData) => {
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

  if (response.status === 401) {
    await setToken(null);
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
  setAuthToken,
  request,
};
