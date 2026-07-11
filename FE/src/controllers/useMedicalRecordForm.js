import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createEmptyMedicalRecord, MEDICAL_RECORD_STORAGE_KEY } from '../models/medicalRecord.model';
import { get, post, put } from '../services/api.service';

// [BUG-05 FIX] Hook nhận patientId để kích hoạt server sync
// - Nếu có patientId: load từ server EMR, save lên server + AsyncStorage (offline cache)
// - Nếu không có patientId: chỉ lưu AsyncStorage (chế độ draft cục bộ)
export const useMedicalRecordForm = (patientId = null) => {
  const [formData, setFormData] = useState(createEmptyMedicalRecord());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Lưu id của record trên server (nếu đã tạo) để dùng PUT thay vì POST
  const serverRecordId = useRef(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // 1. Thử load từ server trước (nếu có patientId)
        if (patientId) {
          try {
            const serverRes = await get(`/api/v1/emr/records?patientId=${patientId}`);
            const records = serverRes?.data || [];
            if (records.length > 0) {
              // Lấy bệnh án mới nhất
              const latest = records[0];
              serverRecordId.current = latest._id;
              // Merge dữ liệu server vào form
              setFormData((prev) => ({
                ...prev,
                hanhChinh: {
                  ...prev.hanhChinh,
                  hoTen: latest.patientName || '',
                  ngayLamBenhAn: latest.createdAt
                    ? new Date(latest.createdAt).toLocaleString('vi-VN')
                    : '',
                },
                chanDoan: {
                  ...prev.chanDoan,
                  xacDinh: latest.diagnosis || '',
                },
                huongDieuTri: {
                  ...prev.huongDieuTri,
                  chuyenKhoa: latest.treatmentPlan || '',
                },
                _serverId: latest._id,
                updatedAt: latest.updatedAt,
              }));
              setLoading(false);
              return;
            }
          } catch (serverErr) {
            console.warn('[useMedicalRecordForm] Không thể load từ server, dùng local cache:', serverErr.message);
          }
        }

        // 2. Fallback: load từ AsyncStorage (offline cache)
        const storageKey = patientId
          ? `${MEDICAL_RECORD_STORAGE_KEY}_${patientId}`
          : MEDICAL_RECORD_STORAGE_KEY;
        const saved = await AsyncStorage.getItem(storageKey);
        if (saved) {
          setFormData({ ...createEmptyMedicalRecord(), ...JSON.parse(saved) });
        }
      } catch (err) {
        console.error('[useMedicalRecordForm] Load error:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [patientId]);

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

      // [BUG-05 FIX] Lưu lên server nếu có patientId
      if (patientId) {
        try {
          const payload = {
            patientId,
            patientName: formData.hanhChinh?.hoTen || '',
            gender: formData.hanhChinh?.gioiTinh || '',
            age: formData.hanhChinh?.tuoi || '',
            admissionType: 'Tự đến',
            department: 'Thần kinh',
            paymentMethod: 'BHYT',
            diagnosis: formData.chanDoan?.xacDinh || '',
            treatmentPlan: formData.huongDieuTri?.chuyenKhoa || '',
            doctorInCharge: formData.hanhChinh?.bacSi || '',
            status: 'Đang điều trị',
          };

          if (serverRecordId.current) {
            // Cập nhật bệnh án hiện có
            await put(`/api/v1/emr/records/${serverRecordId.current}`, payload);
          } else {
            // Tạo bệnh án mới
            const res = await post('/api/v1/emr/records', payload);
            if (res?.data?._id) {
              serverRecordId.current = res.data._id;
            }
          }
          console.log('[useMedicalRecordForm] ✅ Đã đồng bộ bệnh án lên server.');
        } catch (serverErr) {
          console.warn('[useMedicalRecordForm] ⚠️ Không thể lưu lên server:', serverErr.message);
          // Không throw — vẫn lưu local bên dưới
        }
      }

      // Luôn lưu local làm cache offline
      const storageKey = patientId
        ? `${MEDICAL_RECORD_STORAGE_KEY}_${patientId}`
        : MEDICAL_RECORD_STORAGE_KEY;
      await AsyncStorage.setItem(storageKey, JSON.stringify(dataToSave));
      setFormData(dataToSave);
      Alert.alert(
        'Đã lưu',
        patientId
          ? 'Thông tin bệnh án đã được đồng bộ lên hệ thống và lưu trên thiết bị.'
          : 'Thông tin bệnh án đã được lưu trên thiết bị (chưa liên kết bệnh nhân).'
      );
      return true;
    } catch (err) {
      console.error('[useMedicalRecordForm] Save error:', err);
      Alert.alert('Lỗi', 'Không thể lưu bệnh án. Vui lòng thử lại.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [formData, patientId]);

  const resetForm = useCallback(() => {
    Alert.alert('Xóa dữ liệu', 'Bạn có chắc muốn xóa toàn bộ thông tin đã nhập trong bệnh án này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          const storageKey = patientId
            ? `${MEDICAL_RECORD_STORAGE_KEY}_${patientId}`
            : MEDICAL_RECORD_STORAGE_KEY;
          await AsyncStorage.removeItem(storageKey);
          serverRecordId.current = null;
          setFormData(createEmptyMedicalRecord());
        },
      },
    ]);
  }, [patientId]);

  return { formData, loading, saving, updateField, saveForm, resetForm };
};
