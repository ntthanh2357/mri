import { get, post, del, postFormData } from "./api.service.js";

// ── Identity ──────────────────────────────────────────────────────────────────

const BASE = '/api/v1/patient';

export const fetchIdentity = () => get(`${BASE}/profile/identity`);
export const saveIdentity = (data) => post(`${BASE}/profile/identity`, data, 'PUT');

// ── Visits ────────────────────────────────────────────────────────────────────

export const fetchVisits = () => get(`${BASE}/records`);
export const fetchVisit = (visitId) => get(`${BASE}/records/${visitId}`);

export const createVisit = (data) => post(`${BASE}/records`, data);
export const updateVisit = (visitId, data) => post(`${BASE}/records/${visitId}`, data, 'PUT');
export const deleteVisit = (visitId) => del(`${BASE}/records/${visitId}`);

// ── Documents ─────────────────────────────────────────────────────────────────

export const uploadDocument = (visitId, { docKey, groupKey, label, file }) => {
  const form = new FormData();
  form.append('docKey', docKey);
  form.append('groupKey', groupKey);
  form.append('label', label);
  form.append('file', file);
  return postFormData(`${BASE}/records/${visitId}/documents/upload`, form);
};

export const saveManualDocument = (visitId, data) =>
  post(`${BASE}/records/${visitId}/documents/manual`, data);

export const deleteDocument = (visitId, docId) =>
  del(`${BASE}/records/${visitId}/documents/${docId}`);
