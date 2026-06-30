import Config from '../constants/config';
import { Platform } from 'react-native';

// AsyncStorage fallback for non-web
const asyncStorageNoOp = {
  getItem: () => Promise.resolve(null),
  setItem: () => Promise.resolve(),
  removeItem: () => Promise.resolve(),
};

// Helper functions for token
const getToken = async () => {
  if (Platform.OS === 'web') {
    return localStorage.getItem('token');
  }
  return asyncStorageNoOp.getItem('token');
};

const setToken = async (token) => {
  if (Platform.OS === 'web') {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  } else {
    if (token) {
      await asyncStorageNoOp.setItem('token', token);
    } else {
      await asyncStorageNoOp.removeItem('token');
    }
  }
};

export const setAuthToken = async (token) => {
  await setToken(token);
};

const request = async (endpoint, options = {}) => {
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

  if (!response.ok) throw new Error(data.message || `Upload failed with status ${response.status}`);
  return data;
};
