import { get, post, put, del } from '../client.js';

export const adminApi = {
  getUsers: () => get('/admin/users'),
  getUserById: (id) => get(`/admin/users/${id}`),
  toggleLock: (data) => post('/admin/users/lock', data),
  getStats: () => get('/admin/stats'),
  getHospitals: () => get('/admin/hospitals'),
  provisionHospital: (data) => post('/admin/hospitals/provision', data),
  getAuditLogs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`/admin/audit-logs${query ? `?${query}` : ''}`);
  },
  getAiModels: () => get('/admin/ai-models'),
  getRevenueReports: () => get('/admin/reports/revenue'),
};

export default adminApi;
