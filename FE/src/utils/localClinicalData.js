/**
 * Xóa dữ liệu bệnh nhân lưu trên máy (bản nháp bệnh án, phiếu khám, thông tin người dùng).
 * Tách riêng khỏi logout.js để api/client.js gọi được khi bị đăng xuất cưỡng bức (401/403)
 * mà không tạo vòng import (logout.js đã import client.js).
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Khóa lưu trên máy có dữ liệu bệnh nhân: bản nháp form bệnh án, bản nháp phiếu khám điều dưỡng, thông tin người dùng
export const LOCAL_CLINICAL_KEY_PREFIXES = ['@neuroscan_medical_record_form', 'emr_detail_'];
export const LOCAL_CLINICAL_KEYS = ['user'];
export const isLocalClinicalKey = (k) => LOCAL_CLINICAL_KEYS.includes(k) || LOCAL_CLINICAL_KEY_PREFIXES.some((p) => String(k).startsWith(p));

export const clearLocalClinicalData = async () => {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    Object.keys(localStorage).filter(isLocalClinicalKey).forEach((k) => localStorage.removeItem(k));
  }
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter(isLocalClinicalKey);
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch { /* AsyncStorage không có trên môi trường này */ }
};
