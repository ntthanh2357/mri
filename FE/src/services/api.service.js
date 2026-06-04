import Config from '../constants/config';

const request = async (endpoint, options = {}) => {
  const url = `${Config.API_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
};

export const get = (endpoint) => request(endpoint);
export const post = (endpoint, body) => request(endpoint, { method: 'POST', body: JSON.stringify(body) });
export const put = (endpoint, body) => request(endpoint, { method: 'PUT', body: JSON.stringify(body) });
export const del = (endpoint) => request(endpoint, { method: 'DELETE' });
