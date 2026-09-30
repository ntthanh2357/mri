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
  
  // Care Sheets
  getCareSheets: (visitId) => get(`/emr/care-sheets/${visitId}`),
  createCareSheet: (data) => post('/emr/care-sheets', data),

  // Vital Signs
  getVitalSigns: (patientId) => get(`/emr/vital-signs/${patientId}`),
  createVitalSign: (data) => post('/emr/vital-signs', data),

  // Consultations & Consents
  getConsultations: (visitId) => get(`/emr/consultations/${visitId}`),
  createConsultation: (data) => post('/emr/consultations', data),
  getConsentForms: (visitId) => get(`/emr/consent-forms/${visitId}`),
  signConsentForm: (id, signatureData) => post(`/emr/consent-forms/${id}/sign`, signatureData),
};

export default emrApi;
