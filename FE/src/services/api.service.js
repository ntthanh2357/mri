import Config from '../constants/config';

let authToken = '';

export const setAuthToken = (token) => {
  authToken = token;
};

const request = async (endpoint, options = {}) => {
  const url = `${Config.API_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
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
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const response = await fetch(url, { method: 'POST', headers, body: formData });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Upload failed');
  return data;
};
