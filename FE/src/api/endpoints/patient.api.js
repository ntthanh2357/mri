import { get, post, put } from '../client.js';

export const patientApi = {
  getMyVisits: () => get('/api/v1/patient-b2c/my-visits'),
  getMriResult: (id) => get(`/api/v1/patient-b2c/imaging/${id}`),
  bookFollowUp: (data) => post('/api/v1/patient-b2c/book-followup', data),
  getVitalsTrend: (timeframe = '30d') => get(`/api/v1/personal-health/vitals-trend?timeframe=${timeframe}`),
  getMedicineReminders: () => get('/api/v1/personal-health/medicine-reminders'),
  getLabResultsWithExplanation: () => get('/api/v1/personal-health/lab-results'),
  getEmrSummary: () => get('/api/v1/personal-health/emr-summary'),
};

export default patientApi;
