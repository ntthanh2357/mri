import { useCallback, useEffect, useState } from 'react';
import { get } from '../services/api.service';

/** Danh sách phim: của chính bệnh nhân, hoặc của 1 bệnh nhân khi bác sĩ truyền patientMedicalId. */
export function useImagingHistory(patientMedicalId) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = patientMedicalId ? `/api/v1/imaging/patient/${patientMedicalId}` : '/api/v1/imaging/my-results';
      const response = await get(endpoint);
      if (response.success) {
        setResults(response.data || []);
      } else {
        setError(response.message || 'Không tải được danh sách phim.');
      }
    } catch (err) {
      console.error('Fetch imaging history error:', err);
      setError('Không kết nối được máy chủ. Kiểm tra mạng rồi bấm “Thử lại”.');
    } finally {
      setLoading(false);
    }
  }, [patientMedicalId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { results, loading, error, refresh: fetchHistory };
}
