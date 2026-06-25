import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { get } from '../services/api.service';
import ResponsiveLayout from '../components/ResponsiveLayout';
import styles from './ImagingHistoryScreen.styles';

const ImagingHistoryScreen = ({ route, navigation }) => {
  const { patientMedicalId, patientName } = route.params || {};
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : {};

      let endpoint = '/api/v1/imaging/my-results';
      if (patientMedicalId) {
        endpoint = `/api/v1/imaging/patient/${patientMedicalId}`;
      } else if (user.role && user.role !== 'patient') {
        endpoint = '/api/v1/imaging';
      }

      const response = await get(endpoint);
      if (response.success) {
        setResults(response.data);
      } else {
        setError(response.message || 'Không thể tải lịch sử chẩn đoán hình ảnh.');
      }
    } catch (err) {
      console.error('Fetch imaging history error:', err);
      setError('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [patientMedicalId]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} lúc ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const renderItem = ({ item }) => {
    const isMRI = item.imagingType === 'MRI';
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ImagingResult', { resultId: item._id })}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.badge, isMRI ? styles.mriBadge : styles.ctBadge]}>
            <Text style={[styles.badgeText, isMRI ? styles.mriBadgeText : styles.ctBadgeText]}>
              {item.imagingType}
            </Text>
          </View>
          <Text style={styles.dateText}>{formatDate(item.reportDate)}</Text>
        </View>

        <Text style={styles.procedureTitle}>{item.procedure}</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Bác sĩ chuyên khoa:</Text>
          <Text style={styles.infoValue}>{item.radiologist}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Chẩn đoán lâm sàng:</Text>
          <Text style={styles.infoValue}>{item.diagnosis || 'Chưa cập nhật'}</Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.conclusionLabel}>Kết luận:</Text>
        <Text style={styles.conclusionText} numberOfLines={2}>
          {item.conclusion}
        </Text>

        <View style={styles.cardFooter}>
          <Text style={styles.footerLink}>Xem chi tiết bệnh án & phim →</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="PatientRecords">
      <SafeAreaView style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitleRow}>
            {patientMedicalId && (
              <TouchableOpacity style={styles.backArrowBtn} onPress={() => navigation.goBack()}>
                <Text style={styles.backArrowText}>←</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.title}>
              {patientName ? `Lịch sử phim: ${patientName}` : 'Lịch sử Chẩn đoán Hình ảnh'}
            </Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchHistory}>
            <Text style={styles.refreshBtnText}>🔄 Làm mới</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#15803D" />
            <Text style={styles.loadingText}>Đang tải lịch sử phim chụp...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchHistory}>
              <Text style={styles.retryButtonText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyText}>Chưa có kết quả chẩn đoán hình ảnh nào được lưu trữ cho bệnh án này.</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            contentContainerStyle={[
              styles.listContainer,
              isDesktop && styles.listContainerDesktop
            ]}
          />
        )}
      </SafeAreaView>
    </ResponsiveLayout>
  );
};

export default ImagingHistoryScreen;
