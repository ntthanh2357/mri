import { get, post, put, del, postFormData } from '../client.js';

export const imagingApi = {
  getAllResults: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`/api/v1/imaging${query ? `?${query}` : ''}`);
  },
  getMyResults: () => get('/api/v1/imaging/my-results'),
  getResultById: (id) => get(`/api/v1/imaging/${id}`),
  getByPatientId: (patientId) => get(`/api/v1/imaging/by-patient/${patientId}`),
  updateResult: (id, data) => put(`/api/v1/imaging/${id}`, data),
  uploadScan: (formData) => postFormData('/api/v1/imaging/upload', formData),
  
  // AI Pipeline & Feedback
  analyzeAI: (data) => post('/api/v1/imaging/analyze-ai', data),
  feedbackAI: (data) => post('/api/v1/imaging/feedback-ai', data),
  approveAI: (data) => post('/api/v1/imaging/approve-ai', data),
  explainAI: (id) => post(`/api/v1/imaging/${id}/explain-ai`),
  
  // AI Job tracking
  triggerAiJob: (data) => post('/api/v1/ai-pipeline/trigger', data),
  getJobProgress: (jobId) => get(`/api/v1/ai-pipeline/jobs/${jobId}/progress`),
  getAiReport: (jobId) => get(`/api/v1/ai-pipeline/jobs/${jobId}/report`),
  retryAiJob: (jobId) => post(`/api/v1/ai-pipeline/jobs/${jobId}/retry`),

  // DICOM
  getStudiesByVisit: (visitId) => get(`/api/v1/dicom/studies/by-visit/${visitId}`),
  getStudyById: (id) => get(`/api/v1/dicom/studies/${id}`),
  validateStudy: (id) => post(`/api/v1/dicom/studies/${id}/validate`),
};

export default imagingApi;
