import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import * as service from '../services/patientRecord.service.js';

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

  const addVisit = useCallback(async (data) => {
    try {
      const res = await service.createVisit(data);
      await load();
      return res.data;
    } catch (err) {
      Alert.alert('Lỗi', err.message);
      return null;
    }
  }, [load]);

  const removeVisit = useCallback(async (visitId) => {
    try {
      await service.deleteVisit(visitId);
      setVisits((prev) => prev.filter((v) => v._id !== visitId));
    } catch (err) {
      Alert.alert('Lỗi', err.message);
    }
  }, []);

  const uploadDoc = useCallback(async (visitId, payload) => {
    try {
      const res = await service.uploadDocument(visitId, payload);
      setVisits((prev) => prev.map((v) => (v._id === visitId ? res.data : v)));
      return true;
    } catch (err) {
      Alert.alert('Lỗi tải lên', err.message);
      return false;
    }
  }, []);

  const saveManualDoc = useCallback(async (visitId, payload) => {
    try {
      const res = await service.saveManualDocument(visitId, payload);
      setVisits((prev) => prev.map((v) => (v._id === visitId ? res.data : v)));
      return true;
    } catch (err) {
      Alert.alert('Lỗi lưu', err.message);
      return false;
    }
  }, []);

  const removeDoc = useCallback(async (visitId, docId) => {
    try {
      const res = await service.deleteDocument(visitId, docId);
      setVisits((prev) => prev.map((v) => (v._id === visitId ? res.data : v)));
      return true;
    } catch (err) {
      Alert.alert('Lỗi xóa', err.message);
      return false;
    }
  }, []);

  const saveIdentity = useCallback(async (data) => {
    try {
      const res = await service.saveIdentity(data);
      setIdentity(res.data);
      return true;
    } catch (err) {
      Alert.alert('Lỗi', err.message);
      return false;
    }
  }, []);

  return {
    visits,
    identity,
    loading,
    error,
    reload: load,
    addVisit,
    removeVisit,
    uploadDoc,
    saveManualDoc,
    removeDoc,
    saveIdentity,
  };
};
