import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createEmptyMedicalRecord, MEDICAL_RECORD_STORAGE_KEY } from '../models/medicalRecord.model';

export const useMedicalRecordForm = () => {
  const [formData, setFormData] = useState(createEmptyMedicalRecord());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const saved = await AsyncStorage.getItem(MEDICAL_RECORD_STORAGE_KEY);
        if (saved) {
          setFormData({ ...createEmptyMedicalRecord(), ...JSON.parse(saved) });
        }
      } catch (err) {
        console.error('Load medical record error:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const updateField = useCallback((section, field, value) => {
    setFormData((prev) => {
      if (field === null) {
        return { ...prev, [section]: value };
      }
      return {
        ...prev,
        [section]: { ...prev[section], [field]: value },
      };
    });
  }, []);

  const saveForm = useCallback(async () => {
    setSaving(true);
    try {
      const dataToSave = { ...formData, updatedAt: new Date().toISOString() };
      await AsyncStorage.setItem(MEDICAL_RECORD_STORAGE_KEY, JSON.stringify(dataToSave));
      setFormData(dataToSave);
      Alert.alert('Đã lưu', 'Thông tin bệnh án của bạn đã được lưu trên thiết bị.');
      return true;
    } catch (err) {
      console.error('Save medical record error:', err);
      Alert.alert('Lỗi', 'Không thể lưu bệnh án. Vui lòng thử lại.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [formData]);

  const resetForm = useCallback(() => {
    Alert.alert('Xóa dữ liệu', 'Bạn có chắc muốn xóa toàn bộ thông tin đã nhập trong bệnh án này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(MEDICAL_RECORD_STORAGE_KEY);
          setFormData(createEmptyMedicalRecord());
        },
      },
    ]);
  }, []);

  return { formData, loading, saving, updateField, saveForm, resetForm };
};
