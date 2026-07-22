import { useState, useEffect, useCallback } from 'react';
import * as service from '../services/patientRecord.service.js';

// Chỉ đọc: bệnh nhân xem lượt khám/tài liệu do bệnh viện cung cấp,
// không có quyền tạo/sửa/xóa (khóa cả ở backend patientRecord.routes.js).
export const usePatientRecords = () => {
  const [visits, setVisits] = useState([]);
  const [identity, setIdentity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [visitsRes, identityRes] = await Promise.all([
        service.fetchVisits(),
        service.fetchIdentity(),
      ]);
      setVisits(visitsRes.data || []);
      setIdentity(identityRes.data || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return {
    visits,
    identity,
    loading,
    error,
    reload: load,
  };
};
