import { get, post } from '../client.js';

export const lisApi = {
  getOrdersByPatient: (patientId) => get(`/api/patients/${patientId}/lab-orders`),
  createOrder: (patientId, data) => post(`/api/patients/${patientId}/lab-orders`, data),
  collectSpecimen: (orderId, data = {}) => post(`/api/lis/orders/${orderId}/collect`, data),
  verifyResults: (orderId, data = {}) => post(`/api/lis/orders/${orderId}/verify`, data),
  getBiomarkers: (category) => get(`/api/lis/biomarkers${category ? `?category=${category}` : ''}`),
};

export default lisApi;
