import { get, post } from '../client.js';

export const lisApi = {
  getOrders: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`/api/v1/lis/orders${query ? `?${query}` : ''}`);
  },
  getOrdersByVisit: (visitId) => get(`/api/v1/lis/visit/${visitId}`),
  getOrderById: (id) => get(`/api/v1/lis/orders/${id}`),
  createOrder: (data) => post('/api/v1/lis/orders', data),
  getBiomarkers: () => get('/api/v1/lis/biomarkers'),
};

export default lisApi;
