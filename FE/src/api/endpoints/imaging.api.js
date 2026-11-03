import { get, post, put, del, postFormData } from '../client.js';

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

export const imagingApi = {
  getAllResults: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`/api/v1/imaging${query ? `?${query}` : ''}`);
  },
  getMyResults: () => get('/api/v1/imaging/my-results'),
  getResultById: (id) => get(`/api/v1/imaging/${id}`),
  getByPatientId: (patientId) => get(`/api/v1/imaging/by-patient/${patientId}`),
  getByVisitId: (visitId) => get(`/api/v1/imaging/by-visit/${visitId}`),
  submitKtvResult: (data) => post('/api/v1/imaging-results', data),
  updateResult: (id, data) => put(`/api/v1/imaging/${id}`, data),
  uploadScan: (formData) => postFormData('/api/v1/imaging/upload', formData),

  // Native Chunked Upload (Băm nhỏ file lớn 5MB/mảnh, không cần AWS S3) & Queue Status
  getQueueStatus: () => get('/api/v1/storage/queue-status'),
  initChunkedUpload: (data) => post('/api/v1/storage/chunked/init', data),
  uploadChunkPart: (data) => post('/api/v1/storage/chunked/part', data),
  completeChunkedUpload: (data) => post('/api/v1/storage/chunked/complete', data),

  /**
   * Tự động băm nhỏ tệp lớn (DICOM .zip / ảnh lớn) thành từng mảnh 5MB đẩy lên PACS Server
   * Hỗ trợ thử lại từng mảnh nếu rớt mạng giữa chừng và báo cáo tiến độ thực tế.
   */
  uploadFileInChunks: async (
    file,
    {
      chunkSizeBytes = 5 * 1024 * 1024,
      category = 'pacs',
      studyId = null,
      sequenceName = null,
      patientId = null,
      expectedSha256 = null,
      onProgress = null,
    } = {}
  ) => {
    const totalSizeBytes = file.size || 0;
    const totalChunks = Math.max(1, Math.ceil(totalSizeBytes / chunkSizeBytes));

    const initRes = await post('/api/v1/storage/chunked/init', {
      fileName: file.name || `scan_${Date.now()}.zip`,
      totalChunks,
      totalSizeBytes,
      mimeType: file.type || 'application/octet-stream',
      category,
      studyId,
      sequenceName,
      patientId,
      expectedSha256,
    });

    if (initRes?.instantDedup && initRes?.data) {
      if (typeof onProgress === 'function') onProgress(100);
      return initRes.data;
    }

    const uploadSessionId = initRes?.data?.uploadSessionId;
    if (!uploadSessionId) {
      throw new Error('Không thể khởi tạo phiên tải lên phân mảnh (uploadSessionId).');
    }

    for (let idx = 0; idx < totalChunks; idx++) {
      const start = idx * chunkSizeBytes;
      const end = Math.min(totalSizeBytes, start + chunkSizeBytes);
      const chunkBlob = file.slice(start, end);
      const chunkBase64 = await blobToBase64(chunkBlob);

      let attempt = 0;
      while (attempt < 3) {
        try {
          await post('/api/v1/storage/chunked/part', {
            uploadSessionId,
            chunkIndex: idx,
            chunkBase64,
          });
          break;
        } catch (err) {
          attempt++;
          if (attempt >= 3) throw err;
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }

      if (typeof onProgress === 'function') {
        onProgress(Math.round(((idx + 1) / totalChunks) * 100));
      }
    }

    const completeRes = await post('/api/v1/storage/chunked/complete', {
      uploadSessionId,
      expectedSha256,
    });

    return completeRes?.data || completeRes;
  },

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
