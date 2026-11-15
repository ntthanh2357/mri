import { useState, useEffect, useCallback } from 'react';
import * as service from '../services/patientRecord.service.js';

// Chỉ đọc: bệnh nhân xem lượt khám/tài liệu do bệnh viện cung cấp,
// không có quyền tạo/sửa/xóa (khóa cả ở backend patientRecord.routes.js).
export const usePatientRecords = () => {
  const [visits, setVisits] = useState([]);
  const [careSheets, setCareSheets] = useState([]);
  const [identity, setIdentity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [visitsRes, identityRes, careSheetsRes] = await Promise.all([
        service.fetchVisits(),
        service.fetchIdentity(),
        service.fetchCareSheets(),
      ]);
      setVisits(visitsRes.data || []);
      setIdentity(identityRes.data || null);
      setCareSheets(careSheetsRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return {
    visits,
    careSheets,
    identity,
    loading,
    error,
    reload: load,
  };
};
