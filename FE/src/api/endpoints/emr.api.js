import { get, post, put, del } from '../client.js';

export const emrApi = {
  getRecords: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`/emr/records${query ? `?${query}` : ''}`);
  },
  getRecordById: (id) => get(`/emr/records/${id}`),
  createRecord: (data) => post('/emr/records', data),
  updateRecord: (id, data) => put(`/emr/records/${id}`, data),
  getVersions: (recordId) => get(`/emr/records/${recordId}/versions`),
  
  // Các phần con của hồ sơ theo đúng route backend
  getCareSheets: (recordId) => get(`/emr/records/${recordId}/care-sheets`),
  createCareSheet: (recordId, data) => post(`/emr/records/${recordId}/care-sheets`, data),
  getConsultations: (recordId) => get(`/emr/records/${recordId}/consultations`),
  createConsultation: (recordId, data) => post(`/emr/records/${recordId}/consultations`, data),
  approveTumorBoard: (consultationId, data) => post(`/emr/consultations/${consultationId}/approve-tumor-board`, data),
  getConsentForms: (recordId) => get(`/emr/records/${recordId}/consents`),
  createConsentForm: (recordId, data) => post(`/emr/records/${recordId}/consents`, data),
  signConsentForm: (consentId, signatureData) => put(`/emr/consents/${consentId}/sign`, signatureData),
};

export default emrApi;
