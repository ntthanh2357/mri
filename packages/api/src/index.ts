import { Config } from '@neuroscan/constants';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: any;
}

const request = async (endpoint: string, options: RequestOptions = {}) => {
  const url = `${Config.API_URL}${endpoint}`;
  const requestOptions: RequestInit = {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  };
  
  if (options.body) {
    requestOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, requestOptions);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
};

export const get = (endpoint: string) => request(endpoint);
export const post = (endpoint: string, body: any) => request(endpoint, { method: 'POST', body });
export const put = (endpoint: string, body: any) => request(endpoint, { method: 'PUT', body });
export const del = (endpoint: string) => request(endpoint, { method: 'DELETE' });
